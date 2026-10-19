import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { StudentStoreService } from './student-store.service';

describe('student store tenant isolation', () => {
  it('scopes submission reads to school and student', async () => {
    let where: any;
    const prisma = { studentStoreSubmission: { findFirst: async (query: any) => { where = query.where; return null; } } };
    const service = new StudentStoreService(prisma as any, {} as any, {} as any, {} as any);
    await assert.rejects(() => service.getSubmission('submission-b', { schoolId: 'school-a', studentId: 'student-a' }), NotFoundException);
    assert.deepEqual(where, { id: 'submission-b', schoolId: 'school-a', studentId: 'student-a' });
  });

  it('scopes clean file access to teacher ownership and school', async () => {
    let where: any;
    const prisma = { studentStoreFile: { findFirst: async (query: any) => { where = query.where; return null; } } };
    const service = new StudentStoreService(prisma as any, {} as any, {} as any, {} as any);
    await assert.rejects(() => service.accessFile('file-b', { schoolId: 'school-a', teacherId: 'teacher-a' }), NotFoundException);
    assert.equal(where.submission.schoolId, 'school-a');
    assert.equal(where.submission.assignment.teacherId, 'teacher-a');
    assert.equal(where.scanStatus, 'CLEAN');
  });

  it('filters draft reviews and internal fraud flags from student detail', async () => {
    let query: any;
    let assignmentChecked = false;
    const prisma = {
      studentStoreSubmission: {
        findFirst: async (input: any) => {
          query = input;
          return { id: 'submission-a', assignmentId: 'assignment-a', reviews: [], fraudFlags: [{ id: 'flag-a' }] };
        },
      },
    };
    const access = { assertAssignmentAccess: async () => { assignmentChecked = true; }, assertEntitlement: async () => undefined };
    const service = new StudentStoreService(prisma as any, {} as any, {} as any, access as any);
    const result: any = await service.getSubmission('submission-a', {
      organizationId: 'org-a', schoolId: 'school-a', userId: 'user-a', studentId: 'student-a',
    });
    assert.deepEqual(query.include.reviews.where, { isPublished: true });
    assert.deepEqual(result.fraudFlags, []);
    assert.equal(assignmentChecked, true);
  });
});
