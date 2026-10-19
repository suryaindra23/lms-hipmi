import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LearningService } from './learning.service';

describe('learning material progress', () => {
  it('keeps the furthest slide and completed state when a student revisits an earlier slide', async () => {
    let upsertInput: any;
    const completedAt = new Date('2026-09-24T10:00:00.000Z');
    const startedAt = new Date('2026-09-24T09:00:00.000Z');
    const prisma = {
      lesson: { findFirst: async () => ({ id: 'lesson-a', moduleId: 'module-a' }) },
      lessonProgress: {
        findUnique: async () => ({
          state: 'COMPLETED', progressPercent: 100, lastPosition: 5, startedAt, completedAt,
        }),
        upsert: async (input: any) => { upsertInput = input; return input.update; },
      },
    };
    const access = { assertPublishedModuleAccess: async () => undefined };
    const service = new LearningService(prisma as any, access as any);

    await service.updateProgress(
      'lesson-a',
      'school-a',
      'student-a',
      { state: 'IN_PROGRESS', progressPercent: 20, lastPosition: 1 },
      { organizationId: 'org-a', schoolId: 'school-a', userId: 'user-a', studentId: 'student-a' },
    );

    assert.equal(upsertInput.update.state, 'COMPLETED');
    assert.equal(upsertInput.update.progressPercent, 100);
    assert.equal(upsertInput.update.lastPosition, 5);
    assert.equal(upsertInput.update.startedAt, startedAt);
    assert.equal(upsertInput.update.completedAt, completedAt);
  });

  it('derives progress and completion from the furthest viewed slide', async () => {
    let upsertInput: any;
    const prisma = {
      lesson: { findFirst: async () => ({ id: 'lesson-a', moduleId: 'module-a' }) },
      lessonProgress: {
        findUnique: async () => ({
          state: 'IN_PROGRESS', progressPercent: 40, lastPosition: 2, startedAt: new Date(), completedAt: null,
        }),
        upsert: async (input: any) => { upsertInput = input; return input.update; },
      },
    };
    const access = { assertPublishedModuleAccess: async () => undefined };
    const service = new LearningService(prisma as any, access as any);

    await service.updateProgress(
      'lesson-a',
      'school-a',
      'student-a',
      { state: 'COMPLETED', progressPercent: 100, lastPosition: 5 },
      { organizationId: 'org-a', schoolId: 'school-a', userId: 'user-a', studentId: 'student-a' },
    );

    assert.equal(upsertInput.update.state, 'COMPLETED');
    assert.equal(upsertInput.update.progressPercent, 100);
    assert.equal(upsertInput.update.lastPosition, 5);
    assert.ok(upsertInput.update.completedAt instanceof Date);
  });

  it('rejects a direct jump to the last slide', async () => {
    const prisma = {
      lesson: { findFirst: async () => ({ id: 'lesson-a', moduleId: 'module-a' }) },
      material: { findFirst: async () => ({ previewSlideCount: 5 }) },
      lessonProgress: {
        findUnique: async () => ({
          state: 'IN_PROGRESS', progressPercent: 20, lastPosition: 1, startedAt: new Date(), completedAt: null,
        }),
        upsert: async () => { throw new Error('progress should not be saved'); },
      },
    };
    const access = { assertPublishedModuleAccess: async () => undefined };
    const service = new LearningService(prisma as any, access as any);

    await assert.rejects(() => service.updateProgress(
      'lesson-a',
      'school-a',
      'student-a',
      { state: 'COMPLETED', progressPercent: 100, lastPosition: 5, materialId: 'material-a' },
      { organizationId: 'org-a', schoolId: 'school-a', userId: 'user-a', studentId: 'student-a' },
    ), /Buka materi secara berurutan/);
  });
});
