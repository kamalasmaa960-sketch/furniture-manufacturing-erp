import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { listMovements, stockOperation, stockOverview } from 'zitejs/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import DataTable from '../components/DataTable';
import EntityPage from '../components/EntityPage';
import { RefSelect } from '../components/EntityForm';
import { PageHeader } from '../components/ui-kit';
import { useInvalidate, useList, useNameMap } from '../lib/data';
import { errMsg, fmtDate, fmtMoney, fmtNum, uid } from '../lib/format';
import { printTable } from '../lib/export';

const KINDS = [
  { v: 'in', l: 'إدخال مخزون' }, { v: 'out', l: 'إخراج مخزون' }, { v: 'transfer', l: 'تحويل بين المخازن' },
  { v: 'adjust', l: 'تسوية جرد (إدخال الرصيد الفعلي)' }, { v: 'waste', l: 'تسجيل هالك / تالف' }, { v: 'opening', l: 'رصيد افتتاحي' },
] as const;

function OperationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [kind, setKind] = useState<(typeof KINDS)[number]['v']>('in');
  const [f, setF] = useState({ itemId: '', warehouseId: '', toWarehouseId: '', qty: '', unitCost: '', notes: '' });
  const [reqId, setReqId] = useState(uid());
  const [busy, setBusy] = useState(false);
  const invalidate = useInvalidate();
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const submit = async () => {
    if (!f.itemId || !f.warehouseId || f.qty === '') return toast.error('أكمل البيانات المطلوبة');
    setBusy(true);
    try {
      const r = await stockOperation({ kind, itemId: f.itemId, warehouseId: f.warehouseId, toWarehouseId: f.toWarehouseId || undefined, qty: Number(f.qty), unitCost: f.unitCost ? Number(f.unitCost) : undefined, notes: f.notes || undefined, requestId: reqId });
      toast.success(r.posted ? `تم تسجيل العملية ${r.reference}` : 'لا يوجد فرق في الرصيد');
      invalidate(); onOpenChange(false); setReqId(uid()); setF({ itemId: '', warehouseId: '', toWarehouseId: '', qty: '', unitCost: '', notes: '' });
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="text-right">عملية مخزنية</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label className="mb-1 block">نوع العملية</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)} dir="rtl"><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{KINDS.map((k) => <SelectItem key={k.v} value={k.v}>{k.l}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="mb-1 block">الصنف *</Label><RefSelect entity="items" value={f.itemId} onChange={(v) => set('itemId', v)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="mb-1 block">{kind === 'transfer' ? 'من مخزن *' : 'المخزن *'}</Label><RefSelect entity="warehouses" value={f.warehouseId} onChange={(v) => set('warehouseId', v)} /></div>
            {kind === 'transfer' && <div><Label className="mb-1 block">إلى مخزن *</Label><RefSelect entity="warehouses" value={f.toWarehouseId} onChange={(v) => set('toWarehouseId', v)} /></div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="mb-1 block">{kind === 'adjust' ? 'الرصيد الفعلي بعد الجرد *' : 'الكمية *'}</Label><Input type="number" step="any" min={0} value={f.qty} onChange={(e) => set('qty', e.target.value)} /></div>
            {(kind === 'in' || kind === 'opening') && <div><Label className="mb-1 block">تكلفة الوحدة</Label><Input type="number" step="any" min={0} value={f.unitCost} onChange={(e) => set('unitCost', e.target.value)} /></div>}
          </div>
          <div><Label className="mb-1 block">ملاحظات / السبب</Label><Textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>
        </div>
        <DialogFooter className="gap-2 sm:justify-start"><Button onClick={submit} disabled={busy}>{busy ? 'جارٍ التسجيل...' : 'تسجيل العملية'}</Button><Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Balances() {
  const { data, isLoading } = useQuery({ queryKey: ['stockOverview'], queryFn: () => stockOverview({}) });
  const { data: items } = useList('items');
  const { data: whs } = useList('warehouses');
  const [wh, setWh] = useState('all');
  const rows = useMemo(() => (items ?? []).map((i) => {
    const qty = wh === 'all' ? data?.totals.find((t) => t.itemId === i.id)?.qty ?? 0 : data?.balances.find((b) => b.itemId === i.id && b.warehouseId === wh)?.qty ?? 0;
    return { id: i.id, code: i.code, name: i.name, type: i.itemType === 'product' ? 'منتج' : 'خامة', unit: i.unit ?? '', qty, min: i.minStock ?? 0, cost: i.unitCost ?? 0, value: qty * (i.unitCost ?? 0) };
  }), [items, data, wh]);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const whName = wh === 'all' ? 'كل المخازن' : whs?.find((w) => w.id === wh)?.name ?? '';
  return (
    <DataTable rows={rows} loading={isLoading} exportName="أرصدة المخزون"
      toolbar={<>
        <Select value={wh} onValueChange={setWh} dir="rtl"><SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">كل المخازن</SelectItem>{(whs ?? []).map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select>
        <span className="text-sm">القيمة: <b className="num">{fmtMoney(total)}</b></span>
        <Button variant="outline" size="sm" onClick={() => printTable('تقرير الجرد', whName, ['الكود', 'الصنف', 'النوع', 'الرصيد الدفتري', 'الوحدة', 'الرصيد الفعلي'], rows.map((r) => [r.code, r.name, r.type, fmtNum(r.qty), r.unit, '']))}><Printer className="ml-1 h-4 w-4" />كشف جرد</Button>
      </>}
      columns={[
        { key: 'code', label: 'الكود', className: 'font-mono text-xs' }, { key: 'name', label: 'الصنف' }, { key: 'type', label: 'النوع' },
        { key: 'qty', label: 'الرصيد', render: (r) => <span className={`num ${r.min && r.qty <= r.min ? 'font-semibold text-destructive' : ''}`}>{fmtNum(r.qty)} {r.unit}</span> },
        { key: 'min', label: 'الحد الأدنى', render: (r) => <span className="num">{fmtNum(r.min)}</span> },
        { key: 'cost', label: 'متوسط التكلفة', render: (r) => <span className="num">{fmtMoney(r.cost)}</span> },
        { key: 'value', label: 'القيمة', render: (r) => <span className="num">{fmtMoney(r.value)}</span> },
      ]} />
  );
}

function Movements() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['movements', 'all', from, to], queryFn: () => listMovements({ from: from || undefined, to: to || undefined }) });
  return (
    <DataTable rows={data?.movements} loading={isLoading} exportName="حركة المخازن"
      toolbar={<><Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} /><Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} /></>}
      columns={[
        { key: 'date', label: 'التاريخ', render: (r) => fmtDate(r.date) }, { key: 'reference', label: 'المرجع', className: 'font-mono text-xs' },
        { key: 'type', label: 'الحركة' }, { key: 'itemName', label: 'الصنف' }, { key: 'warehouseName', label: 'المخزن' },
        { key: 'qtyIn', label: 'وارد', render: (r) => <span className="num text-emerald-700">{r.qtyIn ? fmtNum(r.qtyIn) : ''}</span> },
        { key: 'qtyOut', label: 'منصرف', render: (r) => <span className="num text-destructive">{r.qtyOut ? fmtNum(r.qtyOut) : ''}</span> },
        { key: 'notes', label: 'ملاحظات' },
      ]} />
  );
}

export default function Inventory() {
  const [op, setOp] = useState(false);
  useNameMap('warehouses');
  return (
    <div>
      <PageHeader title="المخازن والجرد" subtitle="كل تغيير في الكميات يتم عبر عملية مسجلة يمكن مراجعتها"
        actions={<Button onClick={() => setOp(true)}><ArrowLeftRight className="ml-1 h-4 w-4" />عملية مخزنية</Button>} />
      <Tabs defaultValue="balances" dir="rtl">
        <TabsList className="mb-3"><TabsTrigger value="balances">الأرصدة</TabsTrigger><TabsTrigger value="movements">سجل الحركة</TabsTrigger><TabsTrigger value="warehouses">المخازن</TabsTrigger></TabsList>
        <TabsContent value="balances"><Balances /></TabsContent>
        <TabsContent value="movements"><Movements /></TabsContent>
        <TabsContent value="warehouses">
          <EntityPage entity="warehouses" title="مخزن" fields={[
            { key: 'name', label: 'اسم المخزن', type: 'text', required: true }, { key: 'location', label: 'الموقع', type: 'text' },
            { key: 'active', label: 'نشط', type: 'checkbox', defaultValue: true }, { key: 'notes', label: 'ملاحظات', type: 'textarea' },
          ]} columns={[{ key: 'name', label: 'المخزن' }, { key: 'location', label: 'الموقع' }, { key: 'active', label: 'الحالة', value: (r) => (r.active ? 'نشط' : 'موقوف') }]} />
        </TabsContent>
      </Tabs>
      <OperationDialog open={op} onOpenChange={setOp} />
    </div>
  );
}
