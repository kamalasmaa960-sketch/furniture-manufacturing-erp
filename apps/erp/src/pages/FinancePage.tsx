import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { financeOverview, type FinanceOverviewOutputType } from 'zitejs/api';
import type { Column } from '../components/DataTable';
type Party = FinanceOverviewOutputType['customers'][0];
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import DataTable from '../components/DataTable';
import EntityPage from '../components/EntityPage';
import PaymentDialog from '../components/PaymentDialog';
import { PageHeader, StatCard } from '../components/ui-kit';
import { fmtDate, fmtMoney } from '../lib/format';

export default function FinancePage() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['financeOverview', from, to], queryFn: () => financeOverview({ from: from || undefined, to: to || undefined }) });
  const cash = (data?.accounts ?? []).reduce((s, a) => s + a.balance, 0);
  const rec = (data?.customers ?? []).reduce((s, c) => s + Math.max(0, c.balance), 0);
  const pay = (data?.suppliers ?? []).reduce((s, c) => s + Math.max(0, c.balance), 0);
  const tin = (data?.transactions ?? []).filter((t) => t.direction === 'in' && t.category !== 'تحويل بين الحسابات').reduce((s, t) => s + t.amount, 0);
  const tout = (data?.transactions ?? []).filter((t) => t.direction === 'out' && t.category !== 'تحويل بين الحسابات').reduce((s, t) => s + t.amount, 0);
  const partyCols = (base: string): Column<Party>[] => [
    { key: 'name', label: 'الاسم' }, { key: 'phone', label: 'الهاتف' },
    { key: 'invoiced', label: 'صافي الفواتير', render: (r: { invoiced: number }) => <span className="num">{fmtMoney(r.invoiced)}</span> },
    { key: 'paid', label: 'المسدد', render: (r: { paid: number }) => <span className="num">{fmtMoney(r.paid)}</span> },
    { key: 'balance', label: 'الرصيد المستحق', render: (r: { balance: number; id: string }) => <span className={`num font-semibold ${r.balance > 0 ? 'text-destructive' : ''}`}>{fmtMoney(r.balance)}</span> },
    { key: '_', label: '', value: () => '', render: (r: { id: string }) => <Button size="sm" variant="link" onClick={() => nav(`/${base}/${r.id}`)}>كشف حساب</Button> },
  ];
  return (
    <div>
      <PageHeader title="الحسابات والخزينة" subtitle="المقبوضات والمدفوعات والمصروفات وأرصدة الخزائن والبنوك" actions={<Button onClick={() => setOpen(true)}><Plus className="ml-1 h-4 w-4" />عملية مالية</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="رصيد الخزائن والبنوك" value={fmtMoney(cash)} />
        <StatCard label="مقبوضات الفترة" value={fmtMoney(tin)} tone="good" />
        <StatCard label="مدفوعات الفترة" value={fmtMoney(tout)} tone="bad" />
        <StatCard label="ديون العملاء" value={fmtMoney(rec)} />
        <StatCard label="مستحقات الموردين" value={fmtMoney(pay)} />
      </div>
      <Tabs defaultValue="tx" dir="rtl">
        <TabsList className="mb-3 flex-wrap"><TabsTrigger value="tx">الحركات المالية</TabsTrigger><TabsTrigger value="accounts">الخزائن والبنوك</TabsTrigger><TabsTrigger value="cust">ديون العملاء</TabsTrigger><TabsTrigger value="supp">مستحقات الموردين</TabsTrigger></TabsList>
        <TabsContent value="tx">
          <DataTable rows={data?.transactions} loading={isLoading} exportName="الحركات المالية"
            toolbar={<><Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} /><Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} /></>}
            columns={[
              { key: 'date', label: 'التاريخ', render: (r) => fmtDate(r.date) }, { key: 'reference', label: 'المرجع', className: 'font-mono text-xs' },
              { key: 'category', label: 'البند' }, { key: 'partyName', label: 'الطرف' }, { key: 'docNumber', label: 'الفاتورة' }, { key: 'accountName', label: 'الحساب' },
              { key: 'amount', label: 'المبلغ', value: (r) => (r.direction === 'in' ? r.amount : -r.amount), render: (r) => <span className={`num font-medium ${r.direction === 'in' ? 'text-emerald-700' : 'text-destructive'}`}>{r.direction === 'in' ? '+' : '−'} {fmtMoney(r.amount)}</span> },
              { key: 'notes', label: 'ملاحظات' },
            ]} />
        </TabsContent>
        <TabsContent value="accounts" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(data?.accounts ?? []).map((a) => (
            <div key={a.id} className="rounded-xl border bg-card p-4 shadow-sm"><div className="text-sm text-muted-foreground">{a.accountType === 'bank' ? 'بنك' : 'خزينة'} {a.accountNumber && `· ${a.accountNumber}`}</div>
              <div className="font-semibold">{a.name}</div><div className="num mt-2 text-xl font-bold">{fmtMoney(a.balance)}</div>
              <div className="mt-1 text-xs text-muted-foreground">افتتاحي {fmtMoney(a.opening)} · وارد {fmtMoney(a.totalIn)} · منصرف {fmtMoney(a.totalOut)}</div></div>))}</div>
          <EntityPage entity="financeAccounts" title="خزينة/بنك" fields={[
            { key: 'name', label: 'الاسم', type: 'text', required: true }, { key: 'accountType', label: 'النوع', type: 'select', required: true, defaultValue: 'cash', options: [{ value: 'cash', label: 'خزينة نقدية' }, { value: 'bank', label: 'حساب بنكي' }] },
            { key: 'accountNumber', label: 'رقم الحساب', type: 'text' }, { key: 'openingBalance', label: 'الرصيد الافتتاحي', type: 'money' },
          ]} columns={[{ key: 'name', label: 'الاسم' }, { key: 'accountType', label: 'النوع', value: (r) => (r.accountType === 'bank' ? 'بنك' : 'خزينة') }, { key: 'accountNumber', label: 'رقم الحساب' }]} />
        </TabsContent>
        <TabsContent value="cust"><DataTable rows={data?.customers} loading={isLoading} exportName="ديون العملاء" columns={partyCols('customers')} /></TabsContent>
        <TabsContent value="supp"><DataTable rows={data?.suppliers} loading={isLoading} exportName="مستحقات الموردين" columns={partyCols('suppliers')} /></TabsContent>
      </Tabs>
      <PaymentDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
