import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../common/guards/permissions.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { QueueService } from '../infrastructure/queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { ObservabilityService } from './observability.service';

const QUEUES = ['system', 'student-import', 'affiliate-metric-import', 'identity-scan', 'store-file-scan', 'report-export', 'helpdesk-attachment-scan', 'notification-delivery', 'certificate-generation'];

@Controller('operations')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class OperationsController {
  constructor(
    private readonly metrics: ObservabilityService,
    private readonly queues: QueueService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('overview')
  @RequirePermissions({ resource: 'monitoring', action: 'read' })
  async overview(@Request() request: any) {
    const schoolId = request.user.schoolId;
    const organizationId = request.user.organizationId;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [queueStats, failedImports, failedExports, unsafeIdentityFiles, unsafeSubmissionFiles, deadLetters] = await Promise.all([
      this.queues.getStats(QUEUES),
      this.prisma.importJob.count({ where: { organizationId, ...(schoolId ? { schoolId } : {}), status: 'FAILED', createdAt: { gte: since } } }),
      this.prisma.exportJob.count({ where: { organizationId, ...(schoolId ? { schoolId } : {}), status: 'FAILED', createdAt: { gte: since } } }),
      this.prisma.identityDocument.count({ where: { scanStatus: { in: ['FAILED', 'INFECTED'] }, createdAt: { gte: since }, student: { school: { organizationId }, ...(schoolId ? { schoolId } : {}) } } }),
      this.prisma.studentStoreFile.count({ where: { scanStatus: { in: ['FAILED', 'INFECTED'] }, createdAt: { gte: since }, submission: { organizationId, ...(schoolId ? { schoolId } : {}) } } }),
      this.prisma.notificationDelivery.count({ where: { status: 'DEAD_LETTER', createdAt: { gte: since }, notification: { organizationId, ...(schoolId ? { schoolId } : {}) } } }),
    ]);
    const http = this.metrics.snapshot(15);
    const queueBacklog = queueStats.reduce((sum, queue) => sum + queue.waiting + queue.delayed, 0);
    const alerts = [
      ...(http.errorRate >= Number(process.env.ALERT_HTTP_ERROR_RATE || 0.05) ? [{ severity: 'CRITICAL', code: 'HTTP_ERROR_RATE', message: 'Tingkat error API melewati ambang.' }] : []),
      ...(http.latencyMs.p95 >= Number(process.env.ALERT_HTTP_P95_MS || 1500) ? [{ severity: 'WARNING', code: 'HTTP_LATENCY', message: 'Latensi p95 API melewati ambang.' }] : []),
      ...(queueBacklog >= Number(process.env.ALERT_QUEUE_BACKLOG || 100) ? [{ severity: 'WARNING', code: 'QUEUE_BACKLOG', message: 'Antrean pekerjaan menumpuk.' }] : []),
      ...(deadLetters > 0 ? [{ severity: 'WARNING', code: 'DEAD_LETTER', message: 'Ada notifikasi yang masuk dead letter.' }] : []),
    ];
    return {
      generatedAt: new Date().toISOString(),
      scope: { organizationId, schoolId: schoolId || null },
      http,
      queues: queueStats,
      jobs24h: { failedImports, failedExports, deadLetters },
      uploads24h: { unsafeIdentityFiles, unsafeSubmissionFiles },
      alerts,
      status: alerts.some((alert) => alert.severity === 'CRITICAL') ? 'critical' : alerts.length ? 'warning' : 'healthy',
    };
  }
}
