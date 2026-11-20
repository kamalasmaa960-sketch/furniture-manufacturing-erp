export const fmtMoney = (n: number | undefined | null) =>
  `${(Number(n) || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;

export const fmtNum = (n: number | undefined | null, d = 2) =>
  (Number(n) || 0).toLocaleString('ar-EG', { maximumFractionDigits: d });

export const fmtDate = (s?: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const fmtDateTime = (s?: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
};

export const todayStr = () => new Date().toISOString().slice(0, 10);
export const monthStr = () => new Date().toISOString().slice(0, 7);
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const first = (v: unknown): string => (Array.isArray(v) ? (v[0] as string) ?? '' : (v as string) ?? '');

export const errMsg = (e: unknown) => {
  const x = e as { userFacingMessage?: string; message?: string };
  return x?.userFacingMessage || x?.message || 'حدث خطأ غير متوقع';
};

export const DOC_LABELS: Record<string, string> = {
  purchase_order: 'طلب شراء', purchase_invoice: 'فاتورة شراء', purchase_return: 'مرتجع مشتريات',
  quote: 'عرض سعر', sales_order: 'طلب بيع', sales_invoice: 'فاتورة بيع', sales_return: 'مرتجع مبيعات',
};

export const PERM_LABELS: Record<string, string> = {
  products: 'المنتجات والخامات', inventory: 'المخازن', purchases: 'المشتريات', sales: 'المبيعات',
  production: 'الإنتاج', hr: 'الموظفون', finance: 'الحسابات', reports: 'التقارير',
};
