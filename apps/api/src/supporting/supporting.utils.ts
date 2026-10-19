const SECRET_LABEL = /\b(password|kata\s+sandi|pin|otp|token|cookie|recovery\s*code|api\s*secret|nik|nisn|npsn)\b\s*[:=]?\s*\S+/gi;
const LONG_IDENTIFIER = /\b\d{10,18}\b/g;

export function redactSupportText(value: string) {
  return value
    .replace(SECRET_LABEL, (match) => `${match.split(/[:=\s]/)[0]} [DIHAPUS]`)
    .replace(LONG_IDENTIFIER, '[IDENTIFIER DIHAPUS]')
    .trim();
}

export function sanitizeNotificationText(value: string, maxLength = 500) {
  return redactSupportText(value).replace(/\s+/g, ' ').slice(0, maxLength);
}

function zonedParts(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return { year: Number(read('year')), month: Number(read('month')), day: Number(read('day')), hour: Number(read('hour')), minute: Number(read('minute')), weekday: read('weekday') };
}

function localTimeToUtc(parts: { year: number; month: number; day: number; hour: number; minute: number }, timezone: string) {
  let candidate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(candidate, timezone);
    const expectedUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const actualUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
    candidate = new Date(candidate.getTime() + expectedUtc - actualUtc);
  }
  return candidate;
}

export function nextDeliveryTime(
  now: Date,
  quietStart?: string | null,
  quietEnd?: string | null,
  timezone = 'Asia/Jakarta',
  digestFrequency = 'IMMEDIATE',
) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(now); } catch { timezone = 'Asia/Jakarta'; }
  let candidate = new Date(now);
  if (digestFrequency === 'DAILY' || digestFrequency === 'WEEKLY') {
    const local = zonedParts(now, timezone);
    const targetLocal = new Date(Date.UTC(local.year, local.month - 1, local.day + (digestFrequency === 'WEEKLY' ? ({ Mon: 7, Tue: 6, Wed: 5, Thu: 4, Fri: 3, Sat: 2, Sun: 1 }[local.weekday] || 1) : 1), 8, 0));
    candidate = localTimeToUtc({ year: targetLocal.getUTCFullYear(), month: targetLocal.getUTCMonth() + 1, day: targetLocal.getUTCDate(), hour: 8, minute: 0 }, timezone);
  }
  if (!quietStart || !quietEnd || !/^\d{2}:\d{2}$/.test(quietStart) || !/^\d{2}:\d{2}$/.test(quietEnd)) return candidate;
  const local = zonedParts(candidate, timezone);
  const minutes = local.hour * 60 + local.minute;
  const [startHour, startMinute] = quietStart.split(':').map(Number);
  const [endHour, endMinute] = quietEnd.split(':').map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const inQuietHours = start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
  if (!inQuietHours) return candidate;
  const targetDay = new Date(Date.UTC(local.year, local.month - 1, local.day + (minutes >= start && start > end ? 1 : 0), endHour, endMinute));
  return localTimeToUtc({ year: targetDay.getUTCFullYear(), month: targetDay.getUTCMonth() + 1, day: targetDay.getUTCDate(), hour: endHour, minute: endMinute }, timezone);
}

export function notificationCategoryEnabled(eventType: string, preference?: {
  assignmentUpdates: boolean; reviewUpdates: boolean; announcements: boolean;
  earlyWarnings: boolean; helpdeskUpdates: boolean;
} | null) {
  if (!preference) return true;
  if (eventType === 'ANNOUNCEMENT') return preference.announcements;
  if (eventType.startsWith('HELPDESK_')) return preference.helpdeskUpdates;
  if (eventType.includes('WARNING') || eventType.includes('DEADLINE') || eventType.includes('INCOMPLETE')) return preference.earlyWarnings;
  if (/(REVIEW|REVISION|APPROVED|REJECTED|GRADE|VERIFICATION)/.test(eventType)) return preference.reviewUpdates;
  if (/(ASSIGNMENT|SUBMISSION|DRAFT|STORE)/.test(eventType)) return preference.assignmentUpdates;
  return true;
}

export function makeTicketNumber(now = new Date(), suffix = '') {
  const day = now.toISOString().slice(0, 10).split('-').join('');
  return `HD-${day}-${suffix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}`;
}
