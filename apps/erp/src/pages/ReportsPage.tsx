import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Printer } from 'lucide-react';
import { report, type ReportInputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import DataTable from '../components/DataTable';
import { PageHeader } from '../components/ui-kit';
import { fmtMoney, fmtNum } from '../lib/format';
import { printTable } from '../lib/export';
import { cn } from '@project/components/lib/utils';

const REPORTS: { key: ReportInputType['report']; label: string }[] = [
  { key: 'sales', label: 'المبيعات' }, { key: 'purchases', label: 'المشتريات' }, { key: 'pnl', label: 'الأرباح والخسائر' },
  { key: 'inventory', label: 'المخزون' }, { key: 'movements', label: 'حركة المخازن' }, { key: 'production', label: 'الإنتاج' },
  { key: 'product_cost', label: 'تكلفة المنتجات' }, { key: 'materials_consumed', label: 'الخامات المستهلكة' }, { key: 'waste', label: 'الهالك والتالف' },
  { key: 'suppliers', label: 'الموردين' }, { key: 'customers', label: 'العملاء' }, { key: 'debts', label: 'الديون والمستحقات' },
  { key: 'payroll', label: 'الموظفين والرواتب' }, { key: 'cashflow', label: 'الإيرادات والمصروفات' },
];

export default function ReportsPage() {
  const y = new Date().getFullYear();
  const [r, setR] = useState<ReportInputType['report']>('sales');
  const [from, setFrom] = useState(`${y}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const { data, isLoading } = useQuery({ queryKey: ['report', r, from, to], queryFn: () => report({ report: r, from, to }) });
  const fmt = (type: string | undefined, v: string | number) => (type === 'money' ? fmtMoney(Number(v)) : type === 'number' ? fmtNum(Number(v)) : String(v ?? ''));
  const cols = (data?.columns ?? []).map((c) => ({
    key: c.key, label: c.label, value: (row: Record<string, string | number>) => row[c.key],
    render: (row: Record<string, string | number>) => <span className={c.type ? 'num' : ''}>{fmt(c.type, row[c.key])}</span>,
  }));
  const rows = (data?.rows ?? []).map((x, i) => ({ ...x, id: String(i) }));
  const doPrint = () => data && printTable(data.title, `الفترة من ${from} إلى ${to}`, data.columns.map((c) => c.label),
    data.rows.map((row) => data.columns.map((c) => fmt(c.type, row[c.key]))),
    Object.keys(data.totals).length ? data.columns.map((c, i) => (i === 0 ? 'الإجمالي' : c.key in data.totals ? fmt(c.type, data.totals[c.key]) : '')) : undefined);
  return (
    <div>
      <PageHeader title="مركز التقارير" subtitle="كل التقارير محسوبة مباشرة من العمليات المسجلة"
        actions={<div className="flex flex-wrap items-center gap-2 text-sm"><span>من</span><Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} /><span>إلى</span><Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} /><Button variant="outline" onClick={doPrint}><Printer className="ml-1 h-4 w-4" />طباعة / PDF</Button></div>} />
      <div className="mb-4 flex flex-wrap gap-2">{REPORTS.map((x) => (
        <button key={x.key} onClick={() => setR(x.key)} className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors', r === x.key ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted')}>
          <FileText className="h-3.5 w-3.5" />{x.label}</button>))}</div>
      <h2 className="mb-2 text-lg font-semibold">{data?.title}</h2>
      <DataTable rows={rows} loading={isLoading} columns={cols} exportName={data?.title ?? 'تقرير'} pageSize={25} emptyText="لا توجد بيانات في هذه الفترة" />
      {data && Object.keys(data.totals).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-4 rounded-xl border bg-card p-3 text-sm shadow-sm">{data.columns.filter((c) => c.key in data.totals).map((c) => (
          <span key={c.key}>{c.label}: <b className="num">{fmt(c.type, data.totals[c.key])}</b></span>))}</div>
      )}
    </div>
  );
}
