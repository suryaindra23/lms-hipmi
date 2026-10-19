import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { redactSensitive } from '../utils/security.utils';

export interface AuditLogData {
  organizationId?: string;
  schoolId?: string;
  actorId?: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  /**
   * Catat aktivitas user ke database audit_logs.
   * Proses ini sebaiknya tidak memblokir main thread (asynchronous).
   */
  async log(data: AuditLogData) {
    try {
      // Filter data sensitif sebelum simpan
      const sanitizedDetails = redactSensitive(data.details) as any;

      await this.prisma.auditLog.create({
        data: {
          organizationId: data.organizationId,
          schoolId: data.schoolId,
          actorId: data.actorId,
          userId: data.userId,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          details: sanitizedDetails,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          correlationId: data.correlationId,
        },
      });
    } catch (error) {
      // Jangan throw error agar tidak mengganggu transaksi utama
      console.error('Failed to create audit log:', error);
    }
  }

  async logRequired(data: AuditLogData) {
    const sanitizedDetails = redactSensitive(data.details) as any;
    await this.prisma.auditLog.create({
      data: {
        organizationId: data.organizationId,
        schoolId: data.schoolId,
        actorId: data.actorId,
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        details: sanitizedDetails,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        correlationId: data.correlationId,
      },
    });
  }

}
