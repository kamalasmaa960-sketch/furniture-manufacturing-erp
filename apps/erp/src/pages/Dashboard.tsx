import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Banknote, Boxes, Factory, FileWarning, PackageCheck, ShoppingBag, ShoppingCart, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { dashboard } from 'zitejs/api';
import { Input } from '@project/components/ui/input';
import { Skeleton } from '@project/components/ui/skeleton';
import { PageHeader, StatCard } from '../components/ui-kit';
import { fmtDateTime, fmtMoney, fmtNum } from '../lib/format';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
const startOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-xl border bg-card p-4 shadow-sm"><h3 className="mb-3 font-semibold">{title}</h3>{children}</div>;
}

export default function Dashboard() {
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const { data, isLoading } = useQuery({ queryKey: ['dashboard', from, to], queryFn: () => dashboard({ from, to }) });
  const k = (data?.kpis ?? {}) as Record<string, number>;

  return (
    <div>
      <PageHeader title="لوحة التحكم" subtitle="ملخص أداء المصنع محسوب من العمليات المسجلة"
        actions={<div className="flex items-center gap-2 text-sm"><span>من</span><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /><span>إلى</span><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>} />
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="إجمالي المبيعات" value={fmtMoney(k.sales)} icon={<ShoppingBag className="h-4 w-4" />} />
            <StatCard label="إجمالي المشتريات" value={fmtMoney(k.purchases)} icon={<ShoppingCart className="h-4 w-4" />} />
            <StatCard label={k.netProfit >= 0 ? 'صافي الربح' : 'صافي الخسارة'} value={fmtMoney(k.netProfit)} tone={k.netProfit >= 0 ? 'good' : 'bad'}
              hint={`مجمل الربح ${fmtMoney(k.grossProfit)}`} icon={k.netProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />} />
            <StatCard label="قيمة المخزون" value={fmtMoney(k.inventoryValue)} icon={<Boxes className="h-4 w-4" />} />
            <StatCard label="المصروفات والرواتب" value={fmtMoney((k.expenses ?? 0) + (k.salaries ?? 0))} tone="warn" icon={<Banknote className="h-4 w-4" />} />
            <StatCard label="مستحقات العملاء" value={fmtMoney(k.receivables)} icon={<Wallet className="h-4 w-4" />} />
            <StatCard label="مستحقات الموردين" value={fmtMoney(k.payables)} icon={<Wallet className="h-4 w-4" />} />
            <StatCard label="فواتير غير مسددة" value={fmtNum(k.unpaidInvoices, 0)} hint={`متأخرة: ${fmtNum(k.overdueInvoices, 0)}`} tone={k.overdueInvoices ? 'bad' : 'default'} icon={<FileWarning className="h-4 w-4" />} />
            <StatCard label="المنتجات / الخامات" value={`${fmtNum(k.products, 0)} / ${fmtNum(k.materials, 0)}`} icon={<PackageCheck className="h-4 w-4" />} />
            <StatCard label="أوامر إنتاج مفتوحة" value={fmtNum(k.openProduction, 0)} hint={`الإجمالي ${fmtNum(k.allProduction, 0)}`} icon={<Factory className="h-4 w-4" />} />
            <StatCard label="طلبات بيع جديدة" value={fmtNum(k.newOrders, 0)} icon={<ShoppingBag className="h-4 w-4" />} />
            <StatCard label="الهالك وعجز الجرد" value={fmtMoney(k.losses)} tone="bad" icon={<AlertTriangle className="h-4 w-4" />} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2"><Panel title="المبيعات والمشتريات خلال الفترة">
              <div className="h-64" dir="ltr">
                <ResponsiveContainer>
                  <AreaChart data={data?.salesByDay ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" fontSize={11} /><YAxis fontSize={11} />
                    <Tooltip formatter={(v: number) => fmtMoney(v)} />
                    <Area type="monotone" dataKey="sales" name="المبيعات" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.15} />
                    <Area type="monotone" dataKey="purchases" name="المشتريات" stroke={COLORS[1]} fill={COLORS[1]} fillOpacity={0.15} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {!data?.salesByDay.length && <p className="text-center text-sm text-muted-foreground">لا توجد فواتير مرحّلة في هذه الفترة</p>}
            </Panel></div>
            <Panel title="حالة الإنتاج">
              <div className="h-64" dir="ltr">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={data?.productionStatus ?? []} dataKey="value" nameKey="label" innerRadius={50} outerRadius={85} paddingAngle={2}>
                      {(data?.productionStatus ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">{(data?.productionStatus ?? []).map((s, i) => <span key={s.label} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % 5] }} />{s.label}: {s.value}</span>)}</div>
            </Panel>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Panel title="تنبيهات المخزون المنخفض">
              {(data?.lowStock ?? []).length === 0 ? <p className="text-sm text-muted-foreground">لا توجد أصناف تحت الحد الأدنى</p> : (
                <ul className="space-y-2 text-sm">{data!.lowStock.map((i) => (
                  <li key={i.id} className="flex justify-between gap-2"><Link to={`/items/${i.id}`} className="text-primary hover:underline">{i.name}</Link><span className="num text-destructive">{fmtNum(i.qty)} / {fmtNum(i.minStock)} {i.unit}</span></li>
                ))}</ul>
              )}
            </Panel>
            <Panel title="توزيع المدفوعات">
              <div className="h-56" dir="ltr">
                <ResponsiveContainer>
                  <BarChart data={data?.expenseBreakdown ?? []} layout="vertical">
                    <XAxis type="number" fontSize={10} /><YAxis type="category" dataKey="label" width={110} fontSize={10} />
                    <Tooltip formatter={(v: number) => fmtMoney(v)} />
                    <Bar dataKey="value" fill={COLORS[1]} radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="أحدث العمليات">
              <ul className="space-y-2.5 text-sm">{(data?.recent ?? []).map((r, i) => (
                <li key={i} className="border-b pb-2 last:border-0"><div>{r.description}</div><div className="text-xs text-muted-foreground">{r.actorName || '—'} · {fmtDateTime(r.createdAt)}</div></li>
              ))}</ul>
              {!data?.recent.length && <p className="text-sm text-muted-foreground">لا توجد عمليات بعد</p>}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
