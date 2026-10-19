import assert from 'node:assert/strict';
import test from 'node:test';
import { isPendingPaymentExpired } from './commerce.utils';

const now = new Date('2026-09-23T12:00:00.000Z');

test('pending payment expires exactly at its deadline', () => {
  assert.equal(isPendingPaymentExpired('PENDING_PAYMENT', new Date('2026-09-23T11:59:59.000Z'), now), true);
  assert.equal(isPendingPaymentExpired('PENDING_PAYMENT', new Date('2026-09-23T12:00:00.000Z'), now), true);
});

test('future and completed payments are not treated as expired', () => {
  assert.equal(isPendingPaymentExpired('PENDING_PAYMENT', new Date('2026-09-23T12:00:01.000Z'), now), false);
  assert.equal(isPendingPaymentExpired('PAID', new Date('2026-09-23T11:00:00.000Z'), now), false);
  assert.equal(isPendingPaymentExpired('PENDING_PAYMENT', null, now), false);
});
