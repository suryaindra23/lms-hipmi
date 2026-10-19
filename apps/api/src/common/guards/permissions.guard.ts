import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator untuk menandai endpoint dengan required permissions.
 * Contoh: @RequirePermissions('users', 'read')
 */
export const RequirePermissions = (...permissions: Array<{ resource: string; action: string }>) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(PERMISSIONS_KEY, permissions, descriptor.value);
    return descriptor;
  };
};

/**
 * Guard untuk memeriksa apakah user memiliki permission yang diperlukan.
 * Permission diambil dari JWT payload (sudah diflatten di JwtStrategy).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Ambil required permissions dari decorator
    const requiredPermissions = this.reflector.getAllAndOverride<Array<{ resource: string; action: string }>>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Jika tidak ada permission requirement, allow
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as any;

    if (!user || !user.permissions) {
      throw new ForbiddenException('Anda tidak memiliki izin untuk mengakses fitur ini');
    }

    const sensitiveActions = new Set(['create', 'update', 'delete', 'verify', 'approve', 'manage', 'export', 'import']);
    const requiresSensitiveRead = requiredPermissions.some((permission) => permission.resource === 'identity.document');
    const isPrivileged = user.roles?.some((role: string) => ['super-admin', 'school-admin', 'program-manager', 'identity-verifier'].includes(role));
    if (
      process.env.REQUIRE_ADMIN_MFA === 'true' &&
      isPrivileged &&
      (requiresSensitiveRead || requiredPermissions.some((permission) => sensitiveActions.has(permission.action))) &&
      user.mfaVerified !== true
    ) {
      throw new ForbiddenException('Verifikasi dua langkah diperlukan untuk tindakan sensitif');
    }

    // Super admin memiliki semua permission
    if (user.roles?.includes('super-admin')) {
      return true;
    }

    // Cek setiap required permission
    const hasAllPermissions = requiredPermissions.every((required) =>
      user.permissions.some(
        (p: any) => p.resource === required.resource && p.action === required.action,
      ),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException('Anda tidak memiliki izin untuk mengakses fitur ini');
    }

    return true;
  }
}

/**
 * Decorator untuk skip permission check (hanya untuk public endpoints)
 */
export const Public = () => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('isPublic', true, descriptor.value);
    return descriptor;
  };
};

/**
 * Guard untuk allow public endpoints tanpa authentication.
 */
@Injectable()
export class PublicGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Jika tidak public, lanjut ke guard berikutnya (JwtAuthGuard)
    return true;
  }
}
