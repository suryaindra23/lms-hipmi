import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrivacyService } from './privacy.service';

describe('PrivacyService governance', () => {
  it('does not allow identity consent to be forged through the generic consent endpoint', async () => {
    const service = new PrivacyService({} as any);
    await assert.rejects(
      service.grant(
        { userId: 'student-user', studentId: 'student-a', organizationId: 'org-a' },
        { documentId: 'doc-a', type: 'IDENTITY', method: 'AUTHENTICATED_CHECKBOX' },
      ),
      BadRequestException,
    );
  });

  it('uses the child school and an effective verified relation for a parent request', async () => {
    let relationWhere: any;
    let createdData: any;
    const prisma = {
      student: {
        findFirst: async () => ({ id: 'student-a', userId: 'student-user', schoolId: 'school-a', birthDate: null }),
      },
      studentParent: {
        count: async (args: any) => {
          relationWhere = args.where;
          return 1;
        },
      },
      dataSubjectRequest: {
        count: async () => 0,
        create: async (args: any) => {
          createdData = args.data;
          return { id: 'request-a' };
        },
      },
    };
    const service = new PrivacyService(prisma as any);

    await service.createRequest(
      { userId: 'parent-user', parentId: 'parent-a', organizationId: 'org-a', schoolId: 'school-b' },
      { type: 'ACCESS', studentId: 'student-a' },
    );

    assert.equal(relationWhere.studentId, 'student-a');
    assert.ok(relationWhere.effectiveFrom?.lte instanceof Date);
    assert.equal(relationWhere.OR[0].effectiveUntil, null);
    assert.equal(createdData.schoolId, 'school-a');
    assert.equal(createdData.studentId, 'student-a');
  });

  it('rejects reopening a completed data subject request', async () => {
    const prisma = {
      dataSubjectRequest: {
        findFirst: async () => ({ id: 'request-a', status: 'COMPLETED' }),
        update: async () => assert.fail('terminal request must not be updated'),
      },
    };
    const service = new PrivacyService(prisma as any);

    await assert.rejects(
      service.updateRequest(
        { userId: 'admin-a', organizationId: 'org-a', schoolId: 'school-a', roles: ['school-admin'] },
        'request-a',
        { status: 'IN_REVIEW' },
      ),
      BadRequestException,
    );
  });

  it('requires an active guardian relationship for another student', async () => {
    const prisma = {
      student: {
        findFirst: async () => ({ id: 'student-a', userId: 'student-user', schoolId: 'school-a', birthDate: null }),
      },
      studentParent: { count: async () => 0 },
    };
    const service = new PrivacyService(prisma as any);
    await assert.rejects(
      service.createRequest(
        { userId: 'parent-user', parentId: 'parent-a', organizationId: 'org-a' },
        { type: 'ACCESS', studentId: 'student-a' },
      ),
      ForbiddenException,
    );
  });
});
