import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SupportingService, SupportingContext } from './supporting.service';

function makeService(prisma: any, access: any = { assertEntitlement: async () => ({}) }) {
  return new SupportingService(prisma, { add: async () => ({}) } as any, {} as any, access);
}

const teacherContext: SupportingContext = {
  userId: 'user-teacher', organizationId: 'org-1', schoolId: 'school-1',
  teacherId: 'teacher-1', roles: ['teacher'],
};

test('advanced entitlement is checked before certificate data is queried', async () => {
  let certificateQueryCalled = false;
  const service = makeService({ certificate: { findMany: async () => { certificateQueryCalled = true; } } }, {
    assertEntitlement: async () => { throw new ForbiddenException('Advanced required'); },
  });
  await assert.rejects(() => service.listCertificates(teacherContext), ForbiddenException);
  assert.equal(certificateQueryCalled, false);
});

test('teacher portfolio scope only includes students in assigned active classes', async () => {
  let portfolioWhere: any;
  const service = makeService({
    teacherAssignment: { findMany: async () => [{ classId: 'class-a' }] },
    classEnrollment: { findMany: async () => [{ studentId: 'student-a' }, { studentId: 'student-b' }] },
    portfolioItem: { findMany: async (query: any) => { portfolioWhere = query.where; return []; } },
  });
  await service.listPortfolio(teacherContext);
  assert.deepEqual(portfolioWhere.studentId.in, ['student-a', 'student-b']);
});

test('teacher is a helpdesk requester and cannot browse school tickets', async () => {
  let where: any;
  const service = makeService({ helpdeskTicket: { findMany: async (query: any) => { where = query.where; return []; } } });
  await service.listHelpdeskTickets(teacherContext);
  assert.equal(where.requesterId, teacherContext.userId);
  assert.equal(where.OR, undefined);
});

test('resolving a helpdesk ticket requires a resolution summary', async () => {
  const service = makeService({ helpdeskTicket: { update: async () => ({}) } });
  service.getHelpdeskTicket = async () => ({ id: 'ticket-1', requesterId: 'requester', status: 'OPEN', resolution: null, satisfaction: null, schoolId: 'school-1' } as any);
  await assert.rejects(
    () => service.updateHelpdeskTicket({ ...teacherContext, roles: ['support'] }, 'ticket-1', { status: 'RESOLVED' }),
    BadRequestException,
  );
});
