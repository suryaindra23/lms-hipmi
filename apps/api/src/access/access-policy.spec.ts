import assert from 'node:assert/strict';
import test from 'node:test';
import { ENTITLEMENT_CATALOG, isPublishedModuleAccessible, selectEffectiveGrant } from './access-policy';

const now = new Date('2026-08-27T00:00:00.000Z');

function grant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'grant-default',
    planCode: 'FREE',
    planRank: 1,
    moduleLimit: 8,
    scope: 'ORGANIZATION' as const,
    startsAt: new Date('2026-01-01T00:00:00.000Z'),
    endsAt: null,
    status: 'ACTIVE',
    source: 'MANUAL',
    ...overrides,
  };
}

test('user grant wins over a higher organization grant because scope is more specific', () => {
  const result = selectEffectiveGrant([
    grant({ id: 'organization-advanced', planCode: 'ADVANCED', planRank: 3, moduleLimit: 12 }),
    grant({ id: 'user-medium', planCode: 'MEDIUM', planRank: 2, moduleLimit: 10, scope: 'USER' }),
  ], now);

  assert.equal(result?.id, 'user-medium');
});

test('highest plan wins when active grants share the same scope', () => {
  const result = selectEffectiveGrant([
    grant({ id: 'school-free', scope: 'SCHOOL' }),
    grant({ id: 'school-advanced', scope: 'SCHOOL', planCode: 'ADVANCED', planRank: 3, moduleLimit: 12 }),
  ], now);

  assert.equal(result?.id, 'school-advanced');
});

test('expired, revoked, and future grants are ignored', () => {
  const result = selectEffectiveGrant([
    grant({ id: 'expired', endsAt: new Date('2026-08-26T23:59:59.000Z') }),
    grant({ id: 'revoked', status: 'REVOKED' }),
    grant({ id: 'future', startsAt: new Date('2026-08-28T00:00:00.000Z'), status: 'SCHEDULED' }),
  ], now);

  assert.equal(result, null);
});

test('module policy enforces plan cap, minimum plan, and the hard limit of twelve', () => {
  assert.equal(isPublishedModuleAccessible(8, 8, 1), true);
  assert.equal(isPublishedModuleAccessible(9, 8, 3), false);
  assert.equal(isPublishedModuleAccessible(10, 10, 2, 2), true);
  assert.equal(isPublishedModuleAccessible(11, 12, 2, 3), false);
  assert.equal(isPublishedModuleAccessible(13, 99, 99), false);
});

test('free plan includes assignments, store practice, affiliate submission, and historical metrics', () => {
  const included = [
    'assessment.overview.read',
    'assignments.standard.read',
    'assignments.standard.submit',
    'student_store.submit',
    'affiliate.content.submit',
    'affiliate.metrics.manage',
  ] as const;
  included.forEach((key) => {
    assert.equal(ENTITLEMENT_CATALOG[key].FREE, true, `${key} should be included in FREE`);
  });
});
