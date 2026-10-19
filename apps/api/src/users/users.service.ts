import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, UserStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

export interface UserAccessScope {
  organizationId: string;
  schoolId?: string;
  organizationWide: boolean;
}

export interface UserListOptions extends UserAccessScope {
  query?: string;
  status?: UserStatus;
  page: number;
  pageSize: number;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(options: UserListOptions) {
    const scope = this.buildScope(options);
    const contains = options.query?.trim()
      ? { contains: options.query.trim(), mode: 'insensitive' as const }
      : undefined;
    const where: Prisma.UserWhereInput = {
      AND: [
        scope,
        {
          ...(options.status ? { status: options.status } : {}),
          ...(contains
            ? { OR: [{ email: contains }, { firstName: contains }, { lastName: contains }, { username: contains }] }
            : {}),
        },
      ],
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          status: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          userRoles: { select: { schoolId: true, role: { select: { slug: true, name: true } } } },
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items,
      page: options.page,
      pageSize: options.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / options.pageSize)),
    };
  }

  async findOne(id: string, access: UserAccessScope) {
    const user = await this.prisma.user.findFirst({
      where: { id, ...this.buildScope(access) },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        userRoles: { select: { schoolId: true, role: { select: { slug: true, name: true } } } },
        student: { select: { id: true, schoolId: true, studentNumber: true, fullName: true } },
        teacher: { select: { id: true, schoolId: true, fullName: true } },
        parent: { select: { id: true, fullName: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({ data });
  }

  async update(id: string, data: Prisma.UserUpdateInput) {
    try {
      return await this.prisma.user.update({ where: { id }, data });
    } catch {
      throw new NotFoundException('User not found');
    }
  }

  async delete(id: string) {
    try {
      return await this.prisma.user.delete({ where: { id } });
    } catch {
      throw new NotFoundException('User not found');
    }
  }

  async updateStatus(id: string, access: UserAccessScope, status: UserStatus, actorId: string) {
    if (id === actorId && ['SUSPENDED', 'DEACTIVATED', 'ARCHIVED', 'INACTIVE'].includes(status)) {
      throw new BadRequestException('Anda tidak dapat menonaktifkan akun sendiri');
    }
    const user = await this.prisma.user.findFirst({ where: { id, ...this.buildScope(access) } });
    if (!user) throw new NotFoundException('User not found');
    const shouldRevoke = status !== 'ACTIVE' && status !== 'PENDING_ACTIVATION';
    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { status, ...(status === 'ACTIVE' ? { lockedUntil: null, failedLoginCount: 0 } : {}) },
        select: { id: true, email: true, status: true, updatedAt: true },
      }),
      this.prisma.userSession.updateMany({
        where: { userId: id, revokedAt: null, ...(shouldRevoke ? {} : { id: '__none__' }) },
        data: { revokedAt: new Date(), revokeReason: 'USER_STATUS_CHANGED' },
      }),
    ]);
    return updated;
  }

  private buildScope(access: UserAccessScope): Prisma.UserWhereInput {
    if (!access.schoolId && !access.organizationWide) {
      throw new ForbiddenException('Pilih konteks sekolah sebelum mengakses pengguna');
    }
    return {
      organizationId: access.organizationId,
      ...(access.schoolId
        ? {
            OR: [
              { userRoles: { some: { schoolId: access.schoolId } } },
              { student: { is: { schoolId: access.schoolId } } },
              { teacher: { is: { schoolId: access.schoolId } } },
              {
                parent: {
                  is: {
                    studentParents: {
                      some: { student: { schoolId: access.schoolId }, revokedAt: null },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
  }
}
