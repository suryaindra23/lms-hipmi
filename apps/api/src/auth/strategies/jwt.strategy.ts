import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { Request } from 'express';
import { resolveSchoolAccess } from '../school-access';

export interface JwtPayload {
  sub: string;
  email: string;
  organizationId?: string;
  sid: string;
  mfa?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      passReqToCallback: true,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    });
  }

  async validate(request: Request, payload: JwtPayload) {
    if (!payload.sid) throw new UnauthorizedException('Session is not valid');
    const session = await this.prisma.userSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, mfaVerifiedAt: true },
    });
    if (!session) throw new UnauthorizedException('Session is not valid');

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        student: { select: { id: true, schoolId: true } },
        teacher: { select: { id: true, schoolId: true } },
        parent: { select: { id: true } },
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Flatten permissions for easy checking
    const permissions = user.userRoles.flatMap((ur: any) =>
      ur.role.rolePermissions.map((rp: any) => ({
        resource: rp.permission.resource,
        action: rp.permission.action,
      })),
    );

    const schoolAccess = resolveSchoolAccess(
      user.userRoles,
      [user.student?.schoolId, user.teacher?.schoolId],
    );

    let schoolId = user.student?.schoolId || user.teacher?.schoolId;
    if (!schoolId && schoolAccess.schoolIds.length === 1) {
      schoolId = schoolAccess.schoolIds[0];
    }

    const requestedSchoolId = request.get('x-school-id')?.trim();
    if (requestedSchoolId) {
      const schoolIsActive = user.organizationId
        ? await this.prisma.school.count({
            where: {
              id: requestedSchoolId,
              organizationId: user.organizationId,
              isActive: true,
            },
          })
        : 0;
      const mayAccessSchool =
        schoolAccess.organizationWide || schoolAccess.schoolIds.includes(requestedSchoolId);
      if (schoolIsActive !== 1 || !mayAccessSchool) {
        throw new ForbiddenException('Anda tidak memiliki akses ke sekolah yang dipilih');
      }
      schoolId = requestedSchoolId;
    } else if (!schoolId && user.organizationId && schoolAccess.organizationWide) {
      const organizationSchools = await this.prisma.school.findMany({
        where: { organizationId: user.organizationId, isActive: true },
        select: { id: true },
        take: 2,
      });
      if (organizationSchools.length === 1) {
        schoolId = organizationSchools[0].id;
      }
    }

    return {
      userId: user.id,
      email: user.email,
      organizationId: user.organizationId,
      schoolId,
      studentId: user.student?.id,
      teacherId: user.teacher?.id,
      parentId: user.parent?.id,
      roles: user.userRoles.map((ur: any) => ur.role.slug),
      permissions,
      schoolAccess,
      sessionId: payload.sid,
      mfaVerified: Boolean(session.mfaVerifiedAt),
      mfaEnabled: user.mfaEnabled,
    };
  }
}
