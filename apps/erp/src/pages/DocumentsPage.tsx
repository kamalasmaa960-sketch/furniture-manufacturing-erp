import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { listDocuments } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import DataTable from '../components/DataTable';
import { PageHeader, StatusBadge } from '../components/ui-kit';
import { DOC_LABELS, fmtDate, fmtMoney } from '../lib/format';

const TYPES = { sales: ['quote', 'sales_order', 'sales_invoice', 'sales_return'], purchases: ['purchase_order', 'purchase_invoice', 'purchase_return'] };

export default function DocumentsPage({ group }: { group: 'sales' | 'purchases' }) {
  const nav = useNavigate();
  const [tab, setTab] = useState('all');
  const { data, isLoading } = useQuery({ queryKey: ['documents', group], queryFn: () => listDocuments({ group }) });
  const rows = (data?.documents ?? []).filter((d) => tab === 'all' || d.docType === tab);
  const types = TYPES[group];
  const newTypes = types.filter((t) => !t.endsWith('return'));
  return (
    <div>
      <PageHeader title={group === 'sales' ? 'المبيعات' : 'المشتريات'}
        subtitle={group === 'sales' ? 'عروض الأسعار وطلبات البيع والفواتير والمرتجعات' : 'طلبات الشراء وفواتير الشراء واستلام البضاعة والمرتجعات'}
        actions={newTypes.map((t) => <Button key={t} variant={t.endsWith('invoice') ? 'default' : 'outline'} onClick={() => nav(`/doc/new/${t}`)}><Plus className="ml-1 h-4 w-4" />{DOC_LABELS[t]}</Button>)} />
      <Tabs value={tab} onValueChange={setTab} dir="rtl" className="mb-3">
        <TabsList className="flex-wrap"><TabsTrigger value="all">الكل</TabsTrigger>{types.map((t) => <TabsTrigger key={t} value={t}>{DOC_LABELS[t]}</TabsTrigger>)}</TabsList>
      </Tabs>
      <DataTable rows={rows} loading={isLoading} onRowClick={(r) => nav(`/doc/${r.id}`)} exportName={group === 'sales' ? 'المبيعات' : 'المشتريات'}
        emptyText="لا توجد مستندات بعد — ابدأ بإنشاء مستند جديد"
        columns={[
          { key: 'number', label: 'الرقم', className: 'font-mono text-xs' },
          { key: 'docType', label: 'النوع', value: (r) => DOC_LABELS[r.docType] ?? r.docType },
          { key: 'docDate', label: 'التاريخ', render: (r) => fmtDate(r.docDate) },
          { key: 'partyName', label: group === 'sales' ? 'العميل' : 'المورد' },
          { key: 'total', label: 'الإجمالي', render: (r) => <span className="num">{fmtMoney(r.total)}</span> },
          { key: 'remaining', label: 'المتبقي', value: (r) => (r.stockPosted ? r.total - r.paid : 0), render: (r) => r.stockPosted ? <span className={`num ${r.total - r.paid > 0.01 ? 'text-destructive' : ''}`}>{fmtMoney(r.total - r.paid)}</span> : '—' },
          { key: 'status', label: 'الحالة', render: (r) => <StatusBadge text={r.status} /> },
          { key: 'deliveryStatus', label: 'التسليم / الاستلام' },
        ]} />
    </div>
  );
}
