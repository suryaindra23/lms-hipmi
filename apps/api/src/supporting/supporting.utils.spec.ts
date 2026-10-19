import test from 'node:test';
import assert from 'node:assert/strict';
import { makeTicketNumber, nextDeliveryTime, notificationCategoryEnabled, redactSupportText, sanitizeNotificationText } from './supporting.utils';

test('support text removes credentials and long identifiers', () => {
  const result = redactSupportText('OTP: 123456 dan NIK 3174000012345678, NISN 1234567890, password=rahasia');
  assert.doesNotMatch(result, /123456|3174000012345678|1234567890|rahasia/);
  assert.match(result, /DIHAPUS/);
});

test('notification text is compact and length limited', () => {
  const result = sanitizeNotificationText(`Halo\n\n${'a'.repeat(600)}`);
  assert.equal(result.length, 500);
  assert.doesNotMatch(result, /\n/);
});

test('quiet hours use the user timezone across midnight', () => {
  const now = new Date('2026-08-05T16:00:00.000Z'); // 23:00 Jakarta
  assert.equal(nextDeliveryTime(now, '22:00', '06:00', 'Asia/Jakarta').toISOString(), '2026-08-05T23:00:00.000Z');
  assert.equal(nextDeliveryTime(new Date('2026-08-05T05:00:00.000Z'), '22:00', '06:00', 'Asia/Jakarta').toISOString(), '2026-08-05T05:00:00.000Z');
});

test('daily and weekly digests are scheduled at 08:00 local time', () => {
  const now = new Date('2026-08-05T05:00:00.000Z'); // Wednesday noon Jakarta
  assert.equal(nextDeliveryTime(now, null, null, 'Asia/Jakarta', 'DAILY').toISOString(), '2026-08-06T01:00:00.000Z');
  assert.equal(nextDeliveryTime(now, null, null, 'Asia/Jakarta', 'WEEKLY').toISOString(), '2026-08-10T01:00:00.000Z');
});

test('notification category preference only affects matching external events', () => {
  const preference = { assignmentUpdates: false, reviewUpdates: true, announcements: false, earlyWarnings: true, helpdeskUpdates: true };
  assert.equal(notificationCategoryEnabled('ASSIGNMENT_PUBLISHED', preference), false);
  assert.equal(notificationCategoryEnabled('ANNOUNCEMENT', preference), false);
  assert.equal(notificationCategoryEnabled('SUBMISSION_APPROVED', preference), true);
});

test('ticket number contains the UTC day and safe suffix', () => {
  assert.equal(makeTicketNumber(new Date('2026-08-05T01:00:00Z'), 'ab-12'), 'HD-20260805-AB12');
});
