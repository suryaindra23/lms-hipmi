import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';

const schoolContext = {
  userId: 'admin-a',
  organizationId: 'org-a',
  schoolId: 'school-a',
  roles: ['school-admin'],
};

function service(prisma: any, access: any = { assertEntitlement: async () => undefined }, storage: any = {}) {
  return new MonitoringService(prisma, { add: async () => undefined } as any, storage, access);
}

describe('MonitoringService package and privacy boundaries', () => {
  it('requires the report entitlement before returning report options', async () => {
    const keys: string[] = [];
    const monitoring = service({}, {
      assertEntitlement: async (_context: any, key: string) => { keys.push(key); },
    });

    await monitoring.getReportOptions(schoolContext);

    assert.deepEqual(keys, ['reports.export']);
  });

  it('limits teacher export history to exports they requested', async () => {
    let where: any;
    const prisma = {
      exportJob: {
        updateMany: async () => ({ count: 0 }),
        findMany: async (args: any) => { where = args.where; return []; },
      },
    };
    const monitoring = service(prisma);

    await monitoring.listExports({ ...schoolContext, userId: 'teacher-user', teacherId: 'teacher-a', roles: ['teacher'] });

    assert.equal(where.organizationId, 'org-a');
    assert.equal(where.schoolId, 'school-a');
    assert.equal(where.requestedById, 'teacher-user');
  });

  it('keeps governance report types unavailable to teachers', async () => {
    const monitoring = service({});

    await assert.rejects(
      monitoring.createExport(
        { ...schoolContext, userId: 'teacher-user', teacherId: 'teacher-a', roles: ['teacher'] },
        { reportType: 'AUDIT_SUMMARY', periodDays: 30, format: 'CSV', timezone: 'Asia/Jakarta' } as any,
      ),
      ForbiddenException,
    );
  });

  it('records every successful private export download', async () => {
    let event: any;
    const prisma = {
      exportJob: {
        findFirst: async () => ({
          id: 'export-a', organizationId: 'org-a', schoolId: 'school-a', requestedById: 'admin-a',
          status: 'COMPLETED', storageKey: 'org-a/export.csv', fileName: 'export.csv', expiresAt: new Date(Date.now() + 60_000),
        }),
      },
      exportDownloadEvent: { create: async (args: any) => { event = args.data; } },
    };
    const monitoring = service(prisma, undefined, { createDownloadUrl: async () => 'signed-url' });

    const result = await monitoring.getExportDownload(schoolContext, 'export-a');

    assert.equal(result.url, 'signed-url');
    assert.deepEqual(event, { exportJobId: 'export-a', organizationId: 'org-a', schoolId: 'school-a', actorId: 'admin-a' });
  });

  it('prevents a creator from approving their own public statistic', async () => {
    const prisma = {
      publicStatistic: {
        findFirst: async () => ({ id: 'stat-a', status: 'PENDING_APPROVAL', createdById: 'admin-a', cohortSize: 30, minimumCohort: 10 }),
      },
    };
    const monitoring = service(prisma);

    await assert.rejects(
      monitoring.reviewPublicStatistic(schoolContext, 'stat-a', { decision: 'APPROVED' }),
      ForbiddenException,
    );
  });

  it('does not expose internal warning evidence or actions to a parent', async () => {
    const prisma = {
      student: { findMany: async () => [{ id: 'student-a', schoolId: 'school-a' }] },
      earlyWarning: {
        findMany: async () => [{
          id: 'warning-a', severity: 'INFO', status: 'OPEN', title: 'Dukungan', message: 'Hubungi siswa.',
          triggeredAt: new Date(), evidence: { internal: true }, student: { id: 'student-a' }, rule: { code: 'RULE' },
          assignedTo: { id: 'staff-a' }, actions: [{ note: 'internal' }],
        }],
      },
    };
    const monitoring = service(prisma);

    const result: any[] = await monitoring.listEarlyWarnings(
      { userId: 'parent-user', organizationId: 'org-a', schoolId: 'school-a', parentId: 'parent-a', roles: ['parent'] },
      {},
    );

    assert.equal(result[0].evidence, undefined);
    assert.deepEqual(result[0].actions, []);
    assert.equal(result[0].assignedTo, null);
  });

  it('keeps final early-warning decisions immutable', async () => {
    const prisma = {
      earlyWarning: { findFirst: async () => ({ id: 'warning-a', status: 'RESOLVED', studentId: 'student-a' }) },
    };
    const monitoring = service(prisma);

    await assert.rejects(
      monitoring.updateEarlyWarning(schoolContext, 'warning-a', { status: 'DISMISSED', note: 'Keputusan akhir.' }),
      BadRequestException,
    );
  });
});
