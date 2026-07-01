// Client-side CSV export helpers — turn an array of objects into a CSV file and
// trigger a browser download. No dependency; used by the analytics report.

// Exported so ad-hoc CSV builders elsewhere get the same formula-injection guard
// + RFC-4180 quoting instead of hand-rolling quote-escaping (which misses the
// =/+/-/@ formula payload).
export function csvCell(value: unknown): string {
  let s = value == null ? '' : String(value);
  // CSV formula-injection guard: a cell that starts with = + - @ (or a tab/CR)
  // is executed as a formula by Excel/Sheets on open. Member-supplied values
  // (names, emails) can carry a payload like =HYPERLINK(...)/=WEBSERVICE(...), so
  // neutralise it with a leading apostrophe before the RFC-4180 quoting below.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  // Quote when the cell contains a comma, quote, or newline (RFC 4180).
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Build a CSV string from rows, using `columns` for header order + labels.
export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; label: string }[]
): string {
  const header = columns.map((c) => csvCell(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(r[c.key])).join(',')).join('\n');
  return `${header}\n${body}\n`;
}

export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Convenience: build a CSV from rows + columns and download it in one call.
export function downloadCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns: { key: keyof T; label: string }[]
): void {
  downloadText(filename, toCsv(rows, columns));
}
