import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { saveProductionOrder } from 'zitejs/api';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { RefSelect } from './EntityForm';
import { useInvalidate, type Rec } from '../lib/data';
import { errMsg, todayStr } from '../lib/format';

const EMPTY = { productId: '', quantity: '', materialWarehouseId: '', outputWarehouseId: '', startDate: todayStr(), dueDate: '', laborCost: '0', overheadCost: '0', directExpenses: '0', indirectExpenses: '0', notes: '' };

export default function ProductionOrderForm({ open, onOpenChange, order, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; order?: Rec; onSaved?: (id: string) => void }) {
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const invalidate = useInvalidate();
  useEffect(() => {
    if (!open) return;
    setF(order ? {
      productId: order.productId, quantity: String(order.quantity ?? ''), materialWarehouseId: order.materialWarehouseId, outputWarehouseId: order.outputWarehouseId,
      startDate: String(order.startDate ?? '').slice(0, 10), dueDate: String(order.dueDate ?? '').slice(0, 10), laborCost: String(order.laborCost ?? 0),
      overheadCost: String(order.overheadCost ?? 0), directExpenses: String(order.directExpenses ?? 0), indirectExpenses: String(order.indirectExpenses ?? 0), notes: order.notes ?? '',
    } : EMPTY);
  }, [open, order]);
  const s = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    if (!f.productId || !(Number(f.quantity) > 0) || !f.materialWarehouseId || !f.outputWarehouseId) return toast.error('أكمل المنتج والكمية والمخازن');
    setBusy(true);
    try {
      const r = await saveProductionOrder({
        id: order?.id, productId: f.productId, quantity: Number(f.quantity), materialWarehouseId: f.materialWarehouseId, outputWarehouseId: f.outputWarehouseId,
        startDate: f.startDate || undefined, dueDate: f.dueDate || undefined, laborCost: Number(f.laborCost) || 0, overheadCost: Number(f.overheadCost) || 0,
        directExpenses: Number(f.directExpenses) || 0, indirectExpenses: Number(f.indirectExpenses) || 0, notes: f.notes || undefined,
      });
      toast.success('تم حفظ أمر الإنتاج'); invalidate(); onOpenChange(false); onSaved?.(r.id);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle className="text-right">{order ? 'تعديل أمر الإنتاج' : 'أمر إنتاج جديد'}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label className="mb-1 block">المنتج *</Label><RefSelect entity="items" value={f.productId} onChange={(v) => setF({ ...f, productId: v })} filter={(i) => i.itemType === 'product'} /></div>
          <div><Label className="mb-1 block">الكمية المطلوبة *</Label><Input type="number" min={0} step="any" value={f.quantity} onChange={s('quantity')} /></div>
          <div><Label className="mb-1 block">مخزن صرف الخامات *</Label><RefSelect entity="warehouses" value={f.materialWarehouseId} onChange={(v) => setF({ ...f, materialWarehouseId: v })} /></div>
          <div><Label className="mb-1 block">مخزن المنتج التام *</Label><RefSelect entity="warehouses" value={f.outputWarehouseId} onChange={(v) => setF({ ...f, outputWarehouseId: v })} /></div>
          <div><Label className="mb-1 block">تاريخ البدء</Label><Input type="date" value={f.startDate} onChange={s('startDate')} /></div>
          <div><Label className="mb-1 block">تاريخ التسليم المستهدف</Label><Input type="date" value={f.dueDate} onChange={s('dueDate')} /></div>
          <div className="sm:col-span-2 mt-2 text-sm font-semibold">تكاليف الإنتاج الإضافية (إجمالي للأمر)</div>
          <div><Label className="mb-1 block">تكلفة العمالة</Label><Input type="number" min={0} step="any" value={f.laborCost} onChange={s('laborCost')} /></div>
          <div><Label className="mb-1 block">تكلفة التشغيل (كهرباء، ماكينات)</Label><Input type="number" min={0} step="any" value={f.overheadCost} onChange={s('overheadCost')} /></div>
          <div><Label className="mb-1 block">مصروفات مباشرة</Label><Input type="number" min={0} step="any" value={f.directExpenses} onChange={s('directExpenses')} /></div>
          <div><Label className="mb-1 block">مصروفات غير مباشرة (نصيب الأمر)</Label><Input type="number" min={0} step="any" value={f.indirectExpenses} onChange={s('indirectExpenses')} /></div>
          <div className="sm:col-span-2"><Label className="mb-1 block">ملاحظات</Label><Textarea rows={2} value={f.notes} onChange={s('notes')} /></div>
        </div>
        <DialogFooter className="gap-2 sm:justify-start"><Button onClick={submit} disabled={busy}>{busy ? 'جارٍ الحفظ...' : 'حفظ'}</Button><Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
