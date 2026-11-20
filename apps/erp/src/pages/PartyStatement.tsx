import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CreditCard } from 'lucide-react';
import { financeOverview, listDocuments } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import DataTable from '../components/DataTable';
import PaymentDialog from '../components/PaymentDialog';
import { PageHeader, StatCard, StatusBadge } from '../components/ui-kit';
import { useList } from '../lib/data';
import { DOC_LABELS, fmtDate, fmtMoney } from '../lib/format';
import { can, useMe } from '../lib/me';

export default function PartyStatement({ kind }: { kind: 'customers' | 'suppliers' }) {
  const { id } = useParams();
  const nav = useNavigate();
  const me = useMe();
  const [pay, setPay] = useState(false);
  const { data: list } = useList(kind);
  const p = list?.find((x) => x.id === id);
  const isC = kind === 'customers';
  const docs = useQuery({ queryKey: ['documents', kind, id], queryFn: () => listDocuments({ group: isC ? 'sales' : 'purchases', partyId: id }) });
  const fin = useQuery({ queryKey: ['financeOverview'], queryFn: () => financeOverview({}), enabled: can(me, 'finance') });
  const b = fin.data?.[kind].find((x) => x.id === id);
  const txs = (fin.data?.transactions ?? []).filter((t) => p && t.partyName === p.name);
  return (
    <div className="space-y-4">
      <PageHeader title={p?.name ?? '...'} subtitle={[p?.phone, p?.address].filter(Boolean).join(' · ')}
        actions={<><Button variant="outline" onClick={() => nav(`/${kind}`)}><ArrowRight className="ml-1 h-4 w-4" />رجوع</Button>
          {can(me, 'finance') && <Button onClick={() => setPay(true)}><CreditCard className="ml-1 h-4 w-4" />{isC ? 'تحصيل دفعة' : 'سداد دفعة'}</Button>}</>} />
      {b && <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="رصيد افتتاحي" value={fmtMoney(b.opening)} />
        <StatCard label="صافي الفواتير المرحّلة" value={fmtMoney(b.invoiced)} />
        <StatCard label="المسدد" value={fmtMoney(b.paid)} />
        <StatCard label="الرصيد المستحق" value={fmtMoney(b.balance)} tone={b.balance > 0 ? 'bad' : 'good'} />
      </div>}
      <h3 className="font-semibold">سجل المستندات</h3>
      <DataTable rows={docs.data?.documents} loading={docs.isLoading} onRowClick={(r) => nav(`/doc/${r.id}`)} exportName={`تعاملات ${p?.name ?? ''}`} columns={[
        { key: 'number', label: 'الرقم' }, { key: 'docType', label: 'النوع', value: (r) => DOC_LABELS[r.docType] }, { key: 'docDate', label: 'التاريخ', render: (r) => fmtDate(r.docDate) },
        { key: 'total', label: 'الإجمالي', render: (r) => <span className="num">{fmtMoney(r.total)}</span> }, { key: 'paid', label: 'المدفوع', render: (r) => <span className="num">{fmtMoney(r.paid)}</span> },
        { key: 'status', label: 'الحالة', render: (r) => <StatusBadge text={r.status} /> },
      ]} />
      {can(me, 'finance') && <>
        <h3 className="font-semibold">الحركات المالية</h3>
        <DataTable rows={txs} exportName={`مدفوعات ${p?.name ?? ''}`} columns={[
          { key: 'reference', label: 'المرجع' }, { key: 'date', label: 'التاريخ', render: (r) => fmtDate(r.date) }, { key: 'category', label: 'البند' },
          { key: 'amount', label: 'المبلغ', render: (r) => <span className={`num ${r.direction === 'in' ? 'text-emerald-700' : 'text-destructive'}`}>{fmtMoney(r.amount)}</span> },
          { key: 'docNumber', label: 'الفاتورة' }, { key: 'accountName', label: 'الحساب' },
        ]} />
        <PaymentDialog open={pay} onOpenChange={setPay} kind={isC ? 'customer_receipt' : 'supplier_payment'} partyId={id} lockKind />
      </>}
    </div>
  );
}
