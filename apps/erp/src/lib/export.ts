export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    // Neutralize spreadsheet formula injection
    const safe = /^[=+\-@]/.test(s) && isNaN(Number(s)) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const csv = '\uFEFF' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Opens a clean printable page; the browser's print dialog can save it as PDF. */
export function printTable(title: string, subtitle: string, headers: string[], rows: (string | number)[][], footer?: (string | number)[]) {
  const w = window.open('', '_blank');
  if (!w) return;
  const th = headers.map((h) => `<th>${escHtml(h)}</th>`).join('');
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${escHtml(String(c ?? ''))}</td>`).join('')}</tr>`).join('');
  const foot = footer ? `<tfoot><tr>${footer.map((c) => `<td>${escHtml(String(c ?? ''))}</td>`).join('')}</tr></tfoot>` : '';
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${escHtml(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600&display=swap" rel="stylesheet">
  <style>body{font-family:'IBM Plex Sans Arabic',sans-serif;padding:24px;color:#0f2a33}h1{font-size:20px;margin:0}p{color:#666;margin:4px 0 16px}
  table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccd;padding:6px 8px;text-align:right}th{background:#e8f1f3}tfoot td{font-weight:600;background:#f5f7f8}</style>
  </head><body><h1>${escHtml(title)}</h1><p>${escHtml(subtitle)}</p><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody>${foot}</table>
  <script>window.onload=()=>setTimeout(()=>window.print(),400)</script></body></html>`);
  w.document.close();
}
