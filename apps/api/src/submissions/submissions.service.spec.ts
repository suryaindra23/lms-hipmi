import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';

describe('submission package and grade boundaries', () => {
  it('checks current assignment entitlement before allowing a draft write', async () => {
    let studentQueried = false;
    const prisma = { student: { findFirst: async () => { studentQueried = true; return { id: 'student-a' }; } } };
    const access = { assertAssignmentAccess: async () => { throw new ForbiddenException('Paket tidak aktif'); } };
    const service = new SubmissionsService(prisma as any, {} as any, access as any);

    await assert.rejects(
      () => service.createOrUpdate(
        { assignmentId: 'assignment-a', studentId: 'student-a', content: 'draft' },
        { organizationId: 'org-a', schoolId: 'school-a', userId: 'user-a', studentId: 'student-a' },
      ),
      ForbiddenException,
    );
    assert.equal(studentQueried, true);
  });

  it('does not expose unpublished review rows to a student', async () => {
    const queries: any[] = [];
    const prisma = {
      submission: {
        findFirst: async (query: any) => {
          queries.push(query);
          if (queries.length === 1) return { assignmentId: 'assignment-a' };
          return { id: 'submission-a', reviews: [] };
        },
      },
    };
    const access = { assertAssignmentAccess: async () => ({ id: 'assignment-a' }), assertAssignmentFeatureEntitlement: async () => undefined };
    const service = new SubmissionsService(prisma as any, {} as any, access as any);

    await service.findOne('submission-a', {
      schoolId: 'school-a', studentId: 'student-a',
      accessContext: { organizationId: 'org-a', schoolId: 'school-a', userId: 'user-a', studentId: 'student-a' },
    });
    assert.deepEqual(queries[1].include.reviews.where, { isPublished: true });
  });

  it('keeps a draft grade under review and does not notify the student', async () => {
    let updateData: any;
    let notified = false;
    const submission = {
      id: 'submission-a', status: 'SUBMITTED', student: { userId: 'student-user' },
      assignment: {
        maxScore: 100, rubricId: null, rubric: null, title: 'Tugas',
        course: { organizationId: 'org-a', schoolId: 'school-a' },
      },
    };
    const prisma = {
      submission: { findFirst: async () => submission },
      $transaction: async (callback: any) => callback({
        submissionReview: { create: async () => ({ id: 'review-a' }) },
        submission: { update: async ({ data }: any) => { updateData = data; return {}; } },
      }),
    };
    const supporting = { createNotification: async () => { notified = true; } };
    const service = new SubmissionsService(prisma as any, supporting as any, {} as any);

    await service.review('submission-a', 'teacher-a', 'school-a', { status: 'APPROVED', score: 90, publishGrade: false });
    assert.equal(updateData.status, 'UNDER_REVIEW');
    assert.equal(updateData.score, null);
    assert.equal(updateData.gradePublishedAt, null);
    assert.equal(notified, false);
  });

  it('requires human resolution of content flags before affiliate approval', async () => {
    const submission = {
      id: 'submission-a', status: 'SUBMITTED', student: { userId: 'student-user' }, affiliateVideos: [{ id: 'video-a' }],
      assignment: {
        type: 'AFFILIATE', maxScore: 100, rubricId: null, rubric: null, title: 'Konten Affiliate',
        course: { organizationId: 'org-a', schoolId: 'school-a' },
      },
    };
    const prisma = {
      submission: { findFirst: async () => submission },
      affiliateFraudFlag: { count: async () => 1 },
    };
    const service = new SubmissionsService(prisma as any, {} as any, {} as any);
    await assert.rejects(
      () => service.review('submission-a', 'teacher-a', 'school-a', { status: 'APPROVED', score: 90, publishGrade: true }),
      BadRequestException,
    );
  });
});
