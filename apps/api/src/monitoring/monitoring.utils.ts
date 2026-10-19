export function hasExceededDays(lastActivity: Date | null | undefined, now: Date, thresholdDays: number) {
  return !lastActivity || now.getTime() - lastActivity.getTime() >= thresholdDays * 24 * 60 * 60 * 1000;
}

export function safeCsvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toSafeCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return '\uFEFFstatus\r\n"Tidak ada data pada filter yang dipilih"\r\n';
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return `\uFEFF${headers.map(safeCsvCell).join(',')}\r\n${rows.map((row) => headers.map((header) => safeCsvCell(row[header])).join(',')).join('\r\n')}\r\n`;
}
