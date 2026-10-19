import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InvitationStatus, Prisma, UserStatus } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../common/services/email.service';

export interface CreateInvitationInput {
  email: string;
  firstName: string;
  lastName: string;
  roleSlug: string;
  schoolId?: string;
  profileData?: Record<string, unknown>;
}

export interface ListInvitationsInput {
  query?: string;
  status?: InvitationStatus;
  page: number;
  pageSize: number;
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly email: EmailService,
  ) {}

  async create(input: CreateInvitationInput, actor: any) {
    const organizationId = actor.organizationId;
    if (!organizationId) throw new BadRequestException('Organization context is required');
    const organizationWide = actor.schoolAccess?.organizationWide === true;
    const schoolId = input.schoolId || actor.schoolId;

    const role = await this.prisma.role.findFirst({
      where: { organizationId, slug: input.roleSlug, isActive: true },
    });
    if (!role) throw new NotFoundException('Role not found in this organization');
    if (!actor.roles?.includes('super-admin') && !['student', 'teacher', 'parent'].includes(role.slug)) {
      throw new ForbiddenException('Admin sekolah hanya dapat menambahkan siswa, guru, atau orang tua/wali');
    }
    if (!organizationWide && !schoolId) {
      throw new ForbiddenException('Pilih konteks sekolah sebelum membuat undangan');
    }

    if (schoolId) {
      const school = await this.prisma.school.count({ where: { id: schoolId, organizationId, isActive: true } });
      if (school !== 1) throw new NotFoundException('School not found in this organization');
    }
    const safeProfile = { ...(input.profileData || {}) };
    delete safeProfile.nik;
    delete safeProfile.nisn;
    if (typeof safeProfile.phone === 'string') safeProfile.phone = safeProfile.phone.trim().slice(0, 30);
    if (typeof safeProfile.fullName === 'string') safeProfile.fullName = safeProfile.fullName.trim().slice(0, 200);
    if (typeof safeProfile.studentNumber === 'string') safeProfile.studentNumber = safeProfile.studentNumber.trim().slice(0, 50);
    await this.validateProfile(input.roleSlug, schoolId, safeProfile);

    const existingActiveUser = await this.prisma.user.findFirst({
      where: { email: input.email.toLowerCase(), status: 'ACTIVE' },
    });
    if (existingActiveUser) throw new ConflictException('Pengguna aktif dengan email tersebut sudah tersedia');
    if (process.env.NODE_ENV === 'production' && !this.email.isConfigured()) {
      throw new ServiceUnavailableException('Pengiriman email aktivasi belum dikonfigurasi. Hubungi pengelola sistem.');
    }

    await this.prisma.invitation.updateMany({
      where: { organizationId, email: input.email.toLowerCase(), status: 'PENDING' },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });

    const token = randomBytes(32).toString('base64url');
    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId,
        schoolId,
        roleId: role.id,
        invitedById: actor.userId,
        email: input.email.toLowerCase(),
        firstName: input.firstName,
        lastName: input.lastName,
        tokenHash: this.hashToken(token),
        profileData: safeProfile as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
      select: { id: true, email: true, status: true, expiresAt: true, createdAt: true },
    });

    if (this.email.isConfigured()) {
      try {
        await this.email.sendInvitation({
          to: invitation.email,
          firstName: input.firstName,
          token,
          expiresAt: invitation.expiresAt,
        });
      } catch {
        await this.prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: 'REVOKED', revokedAt: new Date() },
        }).catch(() => undefined);
        throw new ServiceUnavailableException('Email aktivasi belum dapat dikirim. Undangan dibatalkan agar dapat dicoba kembali.');
      }
    }

    return {
      ...invitation,
      ...(process.env.NODE_ENV !== 'production' ? { activationToken: token } : {}),
    };
  }

  async list(actor: any, options: ListInvitationsInput) {
    if (!actor.schoolId && actor.schoolAccess?.organizationWide !== true) {
      throw new ForbiddenException('Pilih konteks sekolah sebelum melihat undangan');
    }
    const contains = options.query?.trim()
      ? { contains: options.query.trim(), mode: 'insensitive' as const }
      : undefined;
    const where: Prisma.InvitationWhereInput = {
      organizationId: actor.organizationId,
      ...(actor.schoolId ? { schoolId: actor.schoolId } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(contains ? { OR: [{ email: contains }, { firstName: contains }, { lastName: contains }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.invitation.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          expiresAt: true,
          acceptedAt: true,
          createdAt: true,
          school: { select: { id: true, name: true } },
          role: { select: { slug: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
      }),
      this.prisma.invitation.count({ where }),
    ]);
    return {
      items,
      page: options.page,
      pageSize: options.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / options.pageSize)),
    };
  }

  async revoke(id: string, actor: any) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id, organizationId: actor.organizationId, ...(actor.schoolId ? { schoolId: actor.schoolId } : {}) },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== 'PENDING') throw new BadRequestException('Invitation is no longer pending');
    return this.prisma.invitation.update({
      where: { id },
      data: { status: 'REVOKED', revokedAt: new Date() },
      select: { id: true, status: true, revokedAt: true },
    });
  }

  async accept(token: string, password: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { role: true },
    });
    if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt <= new Date()) {
      throw new BadRequestException('Undangan tidak valid atau sudah kedaluwarsa');
    }

    const profile = (invitation.profileData || {}) as Record<string, any>;
    const passwordHash = await this.auth.hashPassword(password);
    const user = await this.prisma.$transaction(async (tx) => {
      let target = await tx.user.findUnique({ where: { email: invitation.email } });
      if (target?.organizationId && target.organizationId !== invitation.organizationId) {
        throw new ConflictException('Email sudah terikat pada organisasi lain');
      }
      if (target && !['DRAFT', 'PENDING_ACTIVATION', 'INACTIVE'].includes(target.status)) {
        throw new ConflictException('Akun sudah aktif. Hubungi admin untuk perubahan akses.');
      }
      target = target
        ? await tx.user.update({
            where: { id: target.id },
            data: {
              firstName: invitation.firstName,
              lastName: invitation.lastName,
              phone: typeof profile.phone === 'string' && profile.phone ? profile.phone : target.phone,
              passwordHash,
              status: UserStatus.ACTIVE,
              activatedAt: new Date(),
            },
          })
        : await tx.user.create({
            data: {
              organizationId: invitation.organizationId,
              email: invitation.email,
              passwordHash,
              firstName: invitation.firstName,
              lastName: invitation.lastName,
              phone: typeof profile.phone === 'string' && profile.phone ? profile.phone : null,
              status: UserStatus.ACTIVE,
              activatedAt: new Date(),
            },
          });

      const existingRole = await tx.userRole.findFirst({
        where: { userId: target.id, roleId: invitation.roleId, schoolId: invitation.schoolId },
      });
      if (!existingRole) {
        await tx.userRole.create({
          data: { userId: target.id, roleId: invitation.roleId, schoolId: invitation.schoolId },
        });
      }

      await this.createProfile(tx, invitation.role.slug, invitation.schoolId, target.id, profile, invitation.invitedById);
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date(), userId: target.id },
      });
      return target;
    });

    return { message: 'Akun berhasil diaktifkan. Silakan masuk.', userId: user.id };
  }

  private async validateProfile(role: string, schoolId: string | undefined, profile: Record<string, unknown>) {
    if (['student', 'teacher', 'school-admin', 'parent'].includes(role) && !schoolId) {
      throw new BadRequestException('School is required for this role');
    }
    if (role === 'student') {
      if (!profile.studentNumber || !profile.fullName) throw new BadRequestException('Student number and full name are required');
      if (profile.classId) {
        const validClass = await this.prisma.class.count({ where: { id: String(profile.classId), schoolId } });
        if (!validClass) throw new BadRequestException('Class is outside invitation school');
      }
    }
    if (role === 'parent' && profile.studentId) {
      const validStudent = await this.prisma.student.count({ where: { id: String(profile.studentId), schoolId } });
      if (!validStudent) throw new BadRequestException('Student is outside invitation school');
    }
  }

  private async createProfile(
    tx: Prisma.TransactionClient,
    role: string,
    schoolId: string | null,
    userId: string,
    profile: Record<string, any>,
    verifierId: string,
  ) {
    if (role === 'student' && schoolId) {
      const existingStudent = await tx.student.findUnique({ where: { userId }, select: { schoolId: true } });
      if (existingStudent && existingStudent.schoolId !== schoolId) {
        throw new ConflictException('Profil siswa sudah terikat pada sekolah lain');
      }
      const student = await tx.student.upsert({
        where: { userId },
        update: {
          classId: profile.classId || null,
          studentNumber: profile.studentNumber,
          fullName: profile.fullName,
          phone: profile.phone || null,
          status: 'ACTIVE',
        },
        create: {
          userId,
          schoolId,
          classId: profile.classId,
          studentNumber: profile.studentNumber,
          fullName: profile.fullName,
          phone: profile.phone || null,
          status: 'ACTIVE',
          activatedAt: new Date(),
        },
      });
      if (profile.classId) {
        const enrollment = await tx.classEnrollment.findFirst({
          where: { studentId: student.id, classId: profile.classId, schoolId, status: 'ACTIVE' },
        });
        if (!enrollment) {
          await tx.classEnrollment.create({
            data: { studentId: student.id, classId: profile.classId, schoolId, effectiveFrom: new Date() },
          });
        }
      }
    } else if (role === 'teacher' && schoolId) {
      const existingTeacher = await tx.teacher.findUnique({ where: { userId }, select: { schoolId: true } });
      if (existingTeacher && existingTeacher.schoolId !== schoolId) {
        throw new ConflictException('Profil guru sudah terikat pada sekolah lain');
      }
      await tx.teacher.upsert({
        where: { userId },
        update: { nip: profile.nip || null, fullName: profile.fullName || 'Guru', phone: profile.phone || null, isActive: true },
        create: { userId, schoolId, nip: profile.nip, fullName: profile.fullName || `${profile.firstName || ''}`.trim() || 'Guru', phone: profile.phone || null },
      });
    } else if (role === 'parent' && schoolId) {
      const parent = await tx.parent.upsert({
        where: { userId },
        update: { fullName: profile.fullName || 'Orang Tua/Wali', phone: profile.phone || null, isActive: true },
        create: { userId, fullName: profile.fullName || 'Orang Tua/Wali', phone: profile.phone },
      });
      if (profile.studentId) {
        await tx.studentParent.upsert({
          where: { studentId_parentId: { studentId: profile.studentId, parentId: parent.id } },
          update: { verificationStatus: 'VERIFIED', verifiedAt: new Date(), verifiedBy: verifierId, revokedAt: null },
          create: {
            studentId: profile.studentId,
            parentId: parent.id,
            relationship: profile.relationship || 'WALI',
            verificationStatus: 'VERIFIED',
            verifiedAt: new Date(),
            verifiedBy: verifierId,
          },
        });
      }
    }
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
