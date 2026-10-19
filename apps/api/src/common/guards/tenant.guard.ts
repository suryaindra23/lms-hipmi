import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

export const TENANT_KEY = 'tenant_context';

export interface TenantContext {
  organizationId?: string;
  schoolId?: string;
}

/**
 * Guard untuk memastikan user hanya mengakses data dari tenant yang diizinkan.
 * Cek organizationId dan schoolId dari request user, params, query, atau body.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as any;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Ambil organizationId dan schoolId dari berbagai sumber
    const organizationId =
      request.params.organizationId ||
      (typeof request.query.organizationId === 'string' ? request.query.organizationId : undefined) ||
      request.body?.organizationId ||
      user.organizationId;

    const schoolId =
      request.params.schoolId ||
      (typeof request.query.schoolId === 'string' ? request.query.schoolId : undefined) ||
      request.body?.schoolId ||
      user.schoolId;

    // Jika user punya organizationId, harus match dengan request
    if (user.organizationId && organizationId) {
      if (user.organizationId !== organizationId) {
        throw new ForbiddenException('Access denied to this organization');
      }
    }

    if (user.schoolId && schoolId && user.schoolId !== schoolId) {
      throw new ForbiddenException('Access denied to this school');
    }

    if (
      schoolId &&
      !user.schoolId &&
      user.schoolAccess?.organizationWide !== true &&
      !user.schoolAccess?.schoolIds?.includes(schoolId)
    ) {
      throw new ForbiddenException('Access denied to this school');
    }

    if (schoolId && user.organizationId) {
      const belongsToOrganization = await this.prisma.school.count({
        where: { id: schoolId, organizationId: user.organizationId, isActive: true },
      });
      if (belongsToOrganization !== 1) {
        throw new ForbiddenException('Access denied to this school');
      }
    }

    // Simpan tenant context di request untuk digunakan oleh service
    (request as any)[TENANT_KEY] = {
      organizationId: user.organizationId || organizationId,
      schoolId,
    } as TenantContext;
    user.schoolId = schoolId;

    return true;
  }
}

/**
 * Decorator untuk skip tenant guard (hanya untuk super admin endpoints)
 */
export const SkipTenantGuard = () => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('skipTenantGuard', true, descriptor.value);
    return descriptor;
  };
};
