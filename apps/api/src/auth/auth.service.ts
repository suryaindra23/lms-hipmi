import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto, AuthResponseDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { EncryptionService } from '../common/services/encryption.service';
import { generateTotpSecret, verifyTotp } from './totp.util';
import { resolveSchoolAccess } from './school-access';
import { EmailService } from '../common/services/email.service';

export interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private encryption: EncryptionService,
    private email: EmailService,
  ) {}

  async register(dto: RegisterDto, metadata: SessionMetadata = {}): Promise<AuthResponseDto> {
    if (process.env.ALLOW_PUBLIC_REGISTRATION !== 'true') {
      throw new BadRequestException('Pendaftaran akun dilakukan melalui undangan sekolah');
    }
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Check if organization exists
    const organization = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
    });

    if (!organization || !organization.isActive) {
      throw new BadRequestException('Invalid organization');
    }

    // Hash password
    const passwordHash = await this.hashPassword(dto.password);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        organizationId: dto.organizationId,
        status: 'PENDING_ACTIVATION',
      },
    });

    // Generate tokens
    const tokens = await this.issueSession(
      user.id,
      user.email,
      user.organizationId ?? undefined,
      metadata,
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
      },
    };
  }

  async login(dto: LoginDto, metadata: SessionMetadata = {}): Promise<AuthResponseDto> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account is locked. Try again later.');
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      // Increment failed login count
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: { increment: 1 },
          // Lock account after 5 failed attempts for 30 minutes
          ...(user.failedLoginCount >= 4 && {
            lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
          }),
        },
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordCost = Number(process.env.PASSWORD_BCRYPT_COST || 12);
    const upgradedPasswordHash = bcrypt.getRounds(user.passwordHash) < passwordCost
      ? await this.hashPassword(dto.password)
      : undefined;

    // Check user status
    if (!['ACTIVE', 'PENDING_ACTIVATION'].includes(user.status)) {
      throw new UnauthorizedException('Account is not active');
    }

    if (user.mfaEnabled) {
      if (!user.mfaSecret || !dto.otp || !verifyTotp(dto.otp, this.encryption.decrypt(user.mfaSecret))) {
        throw new UnauthorizedException('Kode verifikasi diperlukan atau tidak valid');
      }
    }

    // Update last login and reset failed count
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
        ...(upgradedPasswordHash ? { passwordHash: upgradedPasswordHash } : {}),
        // Auto-activate user on first successful login if pending
        ...(user.status === 'PENDING_ACTIVATION' && {
          status: 'ACTIVE',
          activatedAt: new Date(),
        }),
      },
    });

    // Generate tokens
    const tokens = await this.issueSession(
      user.id,
      user.email,
      user.organizationId ?? undefined,
      metadata,
      user.mfaEnabled,
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status === 'PENDING_ACTIVATION' ? 'ACTIVE' : user.status,
      },
    };
  }

  async refreshToken(
    refreshToken: string,
    metadata: SessionMetadata = {},
  ): Promise<AuthResponseDto> {
    const tokenHash = this.hashToken(refreshToken);
    const current = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });

    if (!current) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (current.revokedAt) {
      const concurrentRotation = current.revokeReason === 'ROTATED'
        && current.rotatedAt
        && Date.now() - current.rotatedAt.getTime() < 10_000;
      if (concurrentRotation) throw new UnauthorizedException('Refresh token was already rotated');
      await this.prisma.userSession.updateMany({
        where: { familyId: current.familyId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'REFRESH_TOKEN_REUSE' },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (current.expiresAt <= new Date() || current.user.status !== 'ACTIVE') {
      await this.revokeSession(current.id, 'EXPIRED_OR_INACTIVE');
      throw new UnauthorizedException('Invalid refresh token');
    }

    const nextRefreshToken = randomBytes(48).toString('base64url');
    const nextSessionId = await this.prisma.$transaction(async (tx) => {
      const rotated = await tx.userSession.updateMany({
        where: { id: current.id, revokedAt: null },
        data: {
          revokedAt: new Date(),
          rotatedAt: new Date(),
          lastUsedAt: new Date(),
          revokeReason: 'ROTATED',
        },
      });
      if (rotated.count !== 1) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const next = await tx.userSession.create({
        data: {
          userId: current.userId,
          familyId: current.familyId,
          refreshTokenHash: this.hashToken(nextRefreshToken),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent?.slice(0, 500),
          mfaVerifiedAt: current.mfaVerifiedAt,
        },
      });
      return next.id;
    });

    const accessToken = await this.signAccessToken(
      current.user.id,
      current.user.email,
      current.user.organizationId ?? undefined,
      nextSessionId,
      Boolean(current.mfaVerifiedAt),
    );

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      user: {
        id: current.user.id,
        email: current.user.email,
        firstName: current.user.firstName,
        lastName: current.user.lastName,
        status: current.user.status,
      },
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: this.hashToken(refreshToken) },
      select: { id: true },
    });
    if (session) await this.revokeSession(session.id, 'LOGOUT');
  }

  async logoutAll(userId: string): Promise<{ revokedSessions: number }> {
    const result = await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: 'LOGOUT_ALL' },
    });
    return { revokedSessions: result.count };
  }

  async getAccount(userId: string) {
    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        emailVerified: true,
        mfaEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        organization: { select: { name: true } },
      },
    });
    if (!account) throw new NotFoundException('Akun tidak ditemukan');
    return account;
  }

  async updateAccount(
    userId: string,
    input: { firstName: string; lastName: string; phone?: string },
  ) {
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const phone = input.phone?.trim() || null;
    if (firstName.length < 2 || lastName.length < 2) {
      throw new BadRequestException('Nama depan dan nama belakang wajib diisi');
    }
    const fullName = `${firstName} ${lastName}`;
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { firstName, lastName, phone } });
      await Promise.all([
        tx.student.updateMany({ where: { userId }, data: { fullName, phone } }),
        tx.teacher.updateMany({ where: { userId }, data: { fullName, phone } }),
        tx.parent.updateMany({ where: { userId }, data: { fullName, phone } }),
      ]);
    });
    return this.getAccount(userId);
  }

  async changePassword(userId: string, currentSessionId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user || !await this.verifyPassword(currentPassword, user.passwordHash)) {
      throw new UnauthorizedException('Kata sandi saat ini tidak sesuai');
    }
    if (await this.verifyPassword(newPassword, user.passwordHash)) {
      throw new BadRequestException('Kata sandi baru harus berbeda dari kata sandi saat ini');
    }

    const now = new Date();
    const [, revoked] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash: await this.hashPassword(newPassword),
          failedLoginCount: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.userSession.updateMany({
        where: { userId, id: { not: currentSessionId }, revokedAt: null },
        data: { revokedAt: now, revokeReason: 'PASSWORD_CHANGED' },
      }),
      this.prisma.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: now },
      }),
    ]);
    return { message: 'Kata sandi berhasil diperbarui', revokedOtherSessions: revoked.count };
  }

  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        expiresAt: true,
        lastUsedAt: true,
        mfaVerifiedAt: true,
        createdAt: true,
      },
    });
    return sessions.map((session) => ({ ...session, current: session.id === currentSessionId }));
  }

  async revokeOwnSession(userId: string, currentSessionId: string, sessionId: string) {
    if (sessionId === currentSessionId) {
      throw new BadRequestException('Gunakan tombol keluar untuk mengakhiri perangkat yang sedang dipakai');
    }
    const result = await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: 'USER_REVOKED_DEVICE' },
    });
    if (result.count !== 1) throw new NotFoundException('Sesi tidak ditemukan atau sudah berakhir');
    return { revoked: true };
  }

  async getAccessibleSchools(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        organizationId: true,
        student: { select: { schoolId: true } },
        teacher: { select: { schoolId: true } },
        userRoles: {
          select: { schoolId: true, role: { select: { slug: true } } },
        },
      },
    });
    if (!user?.organizationId) return [];

    const access = resolveSchoolAccess(
      user.userRoles,
      [user.student?.schoolId, user.teacher?.schoolId],
    );
    if (!access.organizationWide && access.schoolIds.length === 0) return [];

    return this.prisma.school.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
        ...(access.organizationWide ? {} : { id: { in: access.schoolIds } }),
      },
      select: {
        id: true,
        name: true,
        code: true,
        level: true,
        status: true,
        city: true,
        province: true,
      },
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
    });
  }

  async beginMfaSetup(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, mfaEnabled: true } });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.mfaEnabled) throw new BadRequestException('MFA sudah aktif');
    const secret = generateTotpSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecret: this.encryption.encrypt(secret) } });
    const issuer = encodeURIComponent('Sunrise Academy');
    const label = encodeURIComponent(`Sunrise Academy:${user.email}`);
    return { secret, otpauthUri: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&digits=6&period=30` };
  }

  async confirmMfa(userId: string, sessionId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { mfaSecret: true } });
    if (!user?.mfaSecret || !verifyTotp(code, this.encryption.decrypt(user.mfaSecret))) throw new BadRequestException('Kode verifikasi tidak valid');
    const verifiedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } }),
      this.prisma.userSession.update({ where: { id: sessionId }, data: { mfaVerifiedAt: verifiedAt } }),
    ]);
    return { enabled: true, verifiedAt };
  }

  async disableMfa(userId: string, password: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, mfaSecret: true, mfaEnabled: true } });
    if (!user?.mfaEnabled || !user.mfaSecret) throw new BadRequestException('MFA belum aktif');
    if (!await this.verifyPassword(password, user.passwordHash) || !verifyTotp(code, this.encryption.decrypt(user.mfaSecret))) {
      throw new UnauthorizedException('Kredensial MFA tidak valid');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecret: null } }),
      this.prisma.userSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'MFA_DISABLED' } }),
    ]);
    return { enabled: false, sessionsRevoked: true };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    let developmentToken: string | undefined;
    if (user) {
      if (process.env.NODE_ENV === 'production' && !this.email.isConfigured()) {
        this.logger.error('Password reset email provider is not configured');
        return { message: 'Jika akun tersedia, petunjuk reset kata sandi akan dikirim.' };
      }
      const token = randomBytes(32).toString('base64url');
      const resetToken = await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(token),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
      if (this.email.isConfigured()) {
        try {
          await this.email.sendPasswordReset({ to: user.email, firstName: user.firstName, token });
        } catch {
          await this.prisma.passwordResetToken.delete({ where: { id: resetToken.id } }).catch(() => undefined);
          this.logger.error('Password reset email delivery failed');
        }
      } else if (process.env.NODE_ENV !== 'production') {
        developmentToken = token;
      }
    }
    return {
      message: 'Jika akun tersedia, petunjuk reset kata sandi akan dikirim.',
      ...(developmentToken ? { developmentToken } : {}),
    };
  }

  async resetPassword(token: string, password: string) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new BadRequestException('Token reset tidak valid atau sudah kedaluwarsa');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash: await this.hashPassword(password),
          failedLoginCount: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.userSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'PASSWORD_RESET' },
      }),
    ]);
    return { message: 'Kata sandi berhasil diperbarui. Silakan masuk kembali.' };
  }

  private async issueSession(
    userId: string,
    email: string,
    organizationId?: string,
    metadata: SessionMetadata = {},
    mfaVerified = false,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const refreshToken = randomBytes(48).toString('base64url');
    const session = await this.prisma.userSession.create({
      data: {
        userId,
        familyId: randomUUID(),
        refreshTokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent?.slice(0, 500),
        mfaVerifiedAt: mfaVerified ? new Date() : null,
      },
    });
    const accessToken = await this.signAccessToken(userId, email, organizationId, session.id, mfaVerified);
    return { accessToken, refreshToken };
  }

  private signAccessToken(
    userId: string,
    email: string,
    organizationId: string | undefined,
    sessionId: string,
    mfaVerified = false,
  ) {
    return this.jwtService.signAsync(
      { sub: userId, email, organizationId, sid: sessionId, mfa: mfaVerified },
      {
        secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
        expiresIn: '15m',
      },
    );
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async revokeSession(id: string, reason: string) {
    await this.prisma.userSession.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: reason },
    });
  }

  public async hashPassword(password: string): Promise<string> {
    const configured = Number(process.env.PASSWORD_BCRYPT_COST || 12);
    const cost = Number.isInteger(configured) ? Math.max(12, Math.min(configured, 15)) : 12;
    const salt = await bcrypt.genSalt(cost);
    return bcrypt.hash(password, salt);
  }

  public async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
