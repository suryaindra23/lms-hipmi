import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveAffiliateMetrics, detectAffiliateDataFlags, extractAffiliateUsername, normalizeAffiliateUrl, normalizePublicUrl } from './affiliate.utils';

test('normalizes affiliate URL and removes tracking data', () => {
  assert.equal(
    normalizeAffiliateUrl('http://www.tiktok.com/@andi/video/123/?utm_source=test#detail', 'TIKTOK'),
    'https://www.tiktok.com/@andi/video/123',
  );
});

test('rejects URL whose domain does not match the platform', () => {
  assert.throws(() => normalizeAffiliateUrl('https://youtube.com/shorts/123', 'TIKTOK'));
});

test('rejects credentials and non-public evidence URLs', () => {
  assert.throws(() => normalizeAffiliateUrl('https://user:secret@tiktok.com/@andi/video/123', 'TIKTOK'));
  assert.throws(() => normalizePublicUrl('http://127.0.0.1/private'));
  assert.throws(() => normalizePublicUrl('https://192.168.1.20/evidence'));
  assert.equal(normalizePublicUrl('http://cdn.example.com/proof.png#preview'), 'https://cdn.example.com/proof.png');
});

test('extracts account ownership hint from supported content URL', () => {
  assert.equal(extractAffiliateUsername('https://www.tiktok.com/@Andi/video/123', 'TIKTOK'), 'andi');
});

test('calculates derived metrics with zero denominator behavior', () => {
  assert.deepEqual(deriveAffiliateMetrics({ views: 0, clicks: 0, orders: 0, gmv: 0, commission: 0 }), {
    ctr: 0,
    conversionRate: 0,
    averageOrderValue: 0,
    commissionRate: 0,
  });
  assert.deepEqual(deriveAffiliateMetrics({ views: 1000, clicks: 100, orders: 10, gmv: 500000, commission: 50000 }), {
    ctr: 10,
    conversionRate: 10,
    averageOrderValue: 50000,
    commissionRate: 10,
  });
});

test('flags suspicious data without rejecting or changing original values', () => {
  const flags = detectAffiliateDataFlags(
    { views: 90, clicks: 100, orders: 101, gmv: 0, commission: 10, snapshotDate: new Date('2026-08-05') },
    { views: 200, clicks: 120, orders: 20, gmv: 100000, commission: 10000, snapshotDate: new Date('2026-08-04') },
    true,
  );
  assert.ok(flags.includes('CLICK_EXCEEDS_VIEWS'));
  assert.ok(flags.includes('ORDERS_EXCEED_CLICKS'));
  assert.ok(flags.includes('LIFETIME_METRIC_DECREASE'));
  assert.ok(flags.includes('DUPLICATE_TIMESTAMP'));
  assert.ok(flags.includes('EVIDENCE_MISSING'));
});

test('flags impossible refund and unit relationships for human review', () => {
  const flags = detectAffiliateDataFlags({
    views: 100,
    clicks: 20,
    orders: 10,
    unitsSold: 8,
    refunds: 11,
    gmv: 100000,
    commission: 10000,
    evidenceUrl: 'https://cdn.example.com/proof.png',
    snapshotDate: new Date('2026-08-05'),
  });
  assert.ok(flags.includes('REFUNDS_EXCEED_ORDERS'));
  assert.ok(flags.includes('UNITS_BELOW_ORDERS'));
});
