import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { listProductionOrders } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { Progress } from '@project/components/ui/progress';
import DataTable from '../components/DataTable';
import EntityPage from '../components/EntityPage';
import ProductionOrderForm from '../components/ProductionOrderForm';
import { PageHeader, StatusBadge } from '../components/ui-kit';
import { fmtDate, fmtMoney, fmtNum } from '../lib/format';

export default function ProductionPage() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['production'], queryFn: () => listProductionOrders({}) });
  return (
    <div>
      <PageHeader title="الإنتاج والتصنيع" subtitle="أوامر الإنتاج من صرف الخامات حتى إضافة المنتج التام للمخزن"
        actions={<Button onClick={() => setOpen(true)}><Plus className="ml-1 h-4 w-4" />أمر إنتاج جديد</Button>} />
      <Tabs defaultValue="orders" dir="rtl">
        <TabsList className="mb-3"><TabsTrigger value="orders">أوامر الإنتاج</TabsTrigger><TabsTrigger value="stages">مراحل الإنتاج</TabsTrigger></TabsList>
        <TabsContent value="orders">
          <DataTable rows={data?.orders} loading={isLoading} onRowClick={(r) => nav(`/production/${r.id}`)} exportName="أوامر الإنتاج" emptyText="لا توجد أوامر إنتاج بعد" columns={[
            { key: 'number', label: 'الأمر', className: 'font-mono text-xs' }, { key: 'productName', label: 'المنتج', className: 'font-medium' },
            { key: 'quantity', label: 'الكمية', render: (r) => <span className="num">{fmtNum(r.quantity)}</span> },
            { key: 'status', label: 'الحالة', render: (r) => <StatusBadge text={r.status} /> }, { key: 'currentStage', label: 'المرحلة الحالية' },
            { key: 'progress', label: 'المقبول', value: (r) => r.completedQty, render: (r) => <div className="flex min-w-24 items-center gap-2"><Progress value={Math.min(100, (r.completedQty / (r.quantity || 1)) * 100)} className="h-2" /><span className="num text-xs">{fmtNum(r.completedQty)}</span></div> },
            { key: 'dueDate', label: 'التسليم', render: (r) => fmtDate(r.dueDate) },
            { key: 'unitCost', label: 'تكلفة الوحدة', render: (r) => (r.unitCost ? <span className="num">{fmtMoney(r.unitCost)}</span> : '—') },
          ]} />
        </TabsContent>
        <TabsContent value="stages">
          <p className="mb-3 text-sm text-muted-foreground">رتّب مراحل التصنيع كما تعمل في المصنع (مثل: تجهيز الخامات، القص، الخياطة، التجميع، التشطيب، مراقبة الجودة، التغليف، التخزين).</p>
          <EntityPage entity="productionStages" title="مرحلة" fields={[{ key: 'name', label: 'اسم المرحلة', type: 'text', required: true }, { key: 'sortOrder', label: 'الترتيب', type: 'number', required: true }]}
            columns={[{ key: 'sortOrder', label: 'الترتيب', value: (r) => r.sortOrder ?? 0 }, { key: 'name', label: 'المرحلة' }]} />
        </TabsContent>
      </Tabs>
      <ProductionOrderForm open={open} onOpenChange={setOpen} onSaved={(id) => nav(`/production/${id}`)} />
    </div>
  );
}
