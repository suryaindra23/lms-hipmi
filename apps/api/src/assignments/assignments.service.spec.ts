import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AssignmentsService } from './assignments.service';

describe('assignment package scoping', () => {
  it('combines enrollment, enabled feature types, and accessible modules for student lists', async () => {
    let where: any;
    const prisma = {
      assignment: {
        findMany: async (query: any) => { where = query.where; return []; },
        count: async () => 0,
      },
    };
    const access = {
      getAccessiblePublishedModuleIds: async () => new Set(['module-1']),
      getEnabledAssignmentTypes: async () => ['WRITTEN', 'PROJECT'],
      assertAssignmentFeatureEntitlement: async () => undefined,
    };
    const service = new AssignmentsService(prisma as any, {} as any, access as any);

    await service.findAll({
      schoolId: 'school-a', studentId: 'student-a', activeOnly: true,
      accessContext: { organizationId: 'org-a', schoolId: 'school-a', userId: 'user-a', studentId: 'student-a' },
    });
    assert.deepEqual(where.moduleId, { in: ['module-1'] });
    assert.deepEqual(where.type, { in: ['WRITTEN', 'PROJECT'] });
    assert.deepEqual(where.course.enrollments, { some: { studentId: 'student-a', status: 'ACTIVE' } });
  });
});
