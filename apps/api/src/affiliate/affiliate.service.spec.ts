import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { AffiliateService } from './affiliate.service';

const actor = { organizationId: 'org-a', schoolId: 'school-a', userId: 'user-a', studentId: 'student-a', roles: ['student'] };

describe('affiliate access and review workflow', () => {
  it('checks content entitlement before listing accounts', async () => {
    let entitlementKey = '';
    const access = { assertEntitlement: async (_actor: any, key: string) => { entitlementKey = key; } };
    const prisma = { affiliateAccount: { findMany: async () => [] } };
    const service = new AffiliateService(prisma as any, {} as any, access as any);
    await service.listAccounts(actor);
    assert.equal(entitlementKey, 'affiliate.content.submit');
  });

  it('stores an immutable account-review event with the final decision', async () => {
    const events: any[] = [];
    const tx = {
      affiliateAccountReview: { create: async (input: any) => { events.push(input.data); } },
      affiliateAccount: { update: async (input: any) => input.data },
    };
    const prisma = {
      affiliateAccount: { findFirst: async () => ({ id: 'account-a', status: 'PENDING_VERIFICATION' }) },
      $transaction: async (callback: any) => callback(tx),
    };
    const access = { assertEntitlement: async () => undefined };
    const service = new AffiliateService(prisma as any, {} as any, access as any);
    await service.reviewAccount('account-a', { status: 'VERIFIED', notes: 'Profil publik sesuai.' }, actor);
    assert.deepEqual(events[0], { accountId: 'account-a', reviewerId: 'user-a', decision: 'VERIFIED', notes: 'Profil publik sesuai.' });
  });

  it('does not allow a finalized metric decision to be overwritten', async () => {
    const prisma = { affiliateMetricSnapshot: { findFirst: async () => ({ id: 'metric-a', verification: 'VERIFIED' }) } };
    const access = { assertEntitlement: async () => undefined };
    const service = new AffiliateService(prisma as any, {} as any, access as any);
    await assert.rejects(
      () => service.verifyMetric('metric-a', { decision: 'REJECTED', notes: 'Ubah keputusan.' }, actor),
      BadRequestException,
    );
  });

  it('only exposes published submission reviews in the student workspace query', async () => {
    let assignmentQuery: any;
    const prisma = { assignment: { findMany: async (query: any) => { assignmentQuery = query; return []; } } };
    const access = {
      assertEntitlement: async () => undefined,
      getAccessiblePublishedModuleIds: async () => new Set(['module-a']),
    };
    const service = new AffiliateService(prisma as any, {} as any, access as any);
    (service as any).listAccounts = async () => [];
    (service as any).getStudentPerformance = async () => ({ videos: [] });
    (service as any).getProviders = async () => [];
    await service.getWorkspace(actor);
    assert.deepEqual(assignmentQuery.include.submissions.include.reviews.where, { isPublished: true });
  });
});
