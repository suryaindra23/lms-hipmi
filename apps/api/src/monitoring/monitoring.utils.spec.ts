import assert from 'node:assert/strict';
import test from 'node:test';
import { hasExceededDays, safeCsvCell, toSafeCsv } from './monitoring.utils';

test('CSV cells neutralize spreadsheet formulas and escape quotes', () => {
  assert.equal(safeCsvCell('=HYPERLINK("https://evil.test")'), '"\'=HYPERLINK(""https://evil.test"")"');
  assert.equal(safeCsvCell('+SUM(1,2)'), '"\'+SUM(1,2)"');
});

test('CSV export includes BOM and preserves a stable header order', () => {
  const csv = toSafeCsv([{ name: 'Siswa', score: 90 }, { name: '@unsafe', score: 80 }]);
  assert.ok(csv.startsWith('\uFEFF"name","score"'));
  assert.ok(csv.includes('"\'@unsafe","80"'));
});

test('early warning threshold is triggered at and after the configured day boundary', () => {
  const now = new Date('2026-08-05T00:00:00.000Z');
  assert.equal(hasExceededDays(new Date('2026-07-29T00:00:00.000Z'), now, 7), true);
  assert.equal(hasExceededDays(new Date('2026-07-29T00:00:01.000Z'), now, 7), false);
  assert.equal(hasExceededDays(null, now, 7), true);
});
