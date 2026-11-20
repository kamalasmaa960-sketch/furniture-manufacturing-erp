import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Ban, CheckCircle2, ClipboardCheck, PackageMinus, Pencil, Printer, StepForward } from 'lucide-react';
import { toast } from 'sonner';
import { getProductionOrder, productionAction } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Skeleton } from '@project/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import ProductionOrderForm from '../components/ProductionOrderForm';
import { Confirm, PageHeader, StatCard, StatusBadge } from '../components/ui-kit';
import { useInvalidate, useNameMap } from '../lib/data';
import { errMsg, fmtDate, fmtDateTime, fmtMoney, fmtNum } from '../lib/format';

type Mode = 'stage' | 'quality' | null;

function StepDialog({ mode, onClose, id, stages }: { mode: Mode; onClose: () => void; id: string; stages: string[] }) {
  const [f, setF] = useState({ stageName: '', qtyDone: '', qtyWaste: '', passedQty: '', rejectedQty: '', reworkQty: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const invalidate = useInvalidate();
  const n = (v: string) => (v ? Number(v) : 0);
  const submit = async () => {
    setBusy(true);
    try {
      if (mode === 'stage') {
        if (!f.stageName) { toast.error('اختر المرحلة'); return; }
        await productionAction({ id, action: 'log_stage', stageName: f.stageName, qtyDone: n(f.qtyDone), qtyWaste: n(f.qtyWaste), notes: f.notes || undefined });
      } else {
        await productionAction({ id, action: 'quality', passedQty: n(f.passedQty), rejectedQty: n(f.rejectedQty), reworkQty: n(f.reworkQty), notes: f.notes || undefined });
      }
      toast.success('تم التسجيل'); invalidate(); onClose();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const num = (k: keyof typeof f, label: string) => <div><Label className="mb-1 block">{label}</Label><Input type="number" min={0} step="any" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>;
  return (
    <Dialog open={!!mode} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader><DialogTitle className="text-right">{mode === 'stage' ? 'تسجيل إنجاز مرحلة' : 'فحص الجودة'}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          {mode === 'stage' ? <>
            <div><Label className="mb-1 block">المرحلة</Label><Select value={f.stageName || undefined} onValueChange={(v) => setF({ ...f, stageName: v })} dir="rtl"><SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>{stages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
              {stages.length === 0 && <p className="mt-1 text-xs text-destructive">أضف مراحل الإنتاج من تبويب "مراحل الإنتاج"</p>}</div>
            <div className="grid grid-cols-2 gap-3">{num('qtyDone', 'الكمية المنجزة')}{num('qtyWaste', 'الهالك / التالف')}</div>
          </> : <div className="grid grid-cols-3 gap-3">{num('passedQty', 'مقبول')}{num('rejectedQty', 'مرفوض')}{num('reworkQty', 'إعادة تشغيل')}</div>}
          <div><Label className="mb-1 block">ملاحظات</Label><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <DialogFooter className="gap-2 sm:justify-start"><Button onClick={submit} disabled={busy}>تسجيل</Button><Button variant="outline" onClick={onClose}>إلغاء</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductionDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const invalidate = useInvalidate();
  const whs = useNameMap('warehouses');
  const [mode, setMode] = useState<Mode>(null);
  const [edit, setEdit] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['production', id], queryFn: () => getProductionOrder({ id: id! }) });
  if (isLoading) return <Skeleton className="h-96" />;
  if (!data) return <p>غير موجود</p>;
  const o = data.order;
  const open = o.status !== 'مكتمل' && o.status !== 'ملغي';
  const matCost = o.materialsIssued ? o.materialCost ?? 0 : data.requirements.reduce((s, r) => s + r.cost, 0);
  const total = matCost + (o.laborCost ?? 0) + (o.overheadCost ?? 0) + (o.directExpenses ?? 0) + (o.indirectExpenses ?? 0);
  const goodQty = o.completedQty || o.quantity || 1;
  const unit: number = (o.status === 'مكتمل' ? o.unitCost : total / goodQty) ?? 0;
  const margin = data.salePrice ? ((data.salePrice - unit) / data.salePrice) * 100 : 0;
  const shortage = data.requirements.some((r) => r.available < r.required);
  const act = async (action: 'issue_materials' | 'complete' | 'cancel', msg: string) => { await productionAction({ id: id!, action }); toast.success(msg); invalidate(); };

  return (
    <div className="space-y-4">
      <PageHeader title={`أمر إنتاج ${o.number}`} subtitle={`${data.productName} × ${fmtNum(o.quantity)}`} actions={<>
        <Button variant="outline" onClick={() => nav('/production')}><ArrowRight className="ml-1 h-4 w-4" />رجوع</Button>
        <Button variant="outline" onClick={() => window.print()}><Printer className="ml-1 h-4 w-4" />طباعة</Button>
        {open && <Button variant="outline" onClick={() => setEdit(true)}><Pencil className="ml-1 h-4 w-4" />تعديل التكاليف</Button>}
        {open && !o.materialsIssued && <Confirm title="صرف الخامات وبدء الإنتاج؟" description="سيتم خصم الخامات المطلوبة من مخزن الصرف." trigger={<Button disabled={shortage}><PackageMinus className="ml-1 h-4 w-4" />صرف الخامات وبدء الإنتاج</Button>} onConfirm={() => act('issue_materials', 'تم صرف الخامات وبدء الإنتاج')} />}
        {open && o.materialsIssued && <><Button variant="outline" onClick={() => setMode('stage')}><StepForward className="ml-1 h-4 w-4" />تسجيل مرحلة</Button>
          <Button variant="outline" onClick={() => setMode('quality')}><ClipboardCheck className="ml-1 h-4 w-4" />فحص الجودة</Button>
          <Confirm title="إنهاء الإنتاج؟" description={`ستضاف ${fmtNum(o.completedQty)} وحدة مقبولة إلى ${whs.get(o.outputWarehouseId) ?? 'المخزن'} وتُحسب التكلفة النهائية.`} trigger={<Button><CheckCircle2 className="ml-1 h-4 w-4" />إنهاء وإضافة للمخزن</Button>} onConfirm={() => act('complete', 'تم إنهاء الإنتاج وإضافة المنتج للمخزن')} /></>}
        {open && !o.materialsIssued && <Confirm destructive title="إلغاء أمر الإنتاج؟" trigger={<Button variant="ghost"><Ban className="h-4 w-4 text-destructive" /></Button>} onConfirm={() => act('cancel', 'تم الإلغاء')} />}
      </>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="الحالة" value={o.status ?? ''} hint={`المرحلة: ${o.currentStage || '—'}`} />
        <StatCard label="مقبول / مرفوض / إعادة" value={`${fmtNum(o.completedQty)} / ${fmtNum(o.rejectedQty)} / ${fmtNum(o.reworkQty)}`} />
        <StatCard label="الهالك المسجل" value={fmtNum(o.wasteQty)} tone={o.wasteQty ? 'warn' : 'default'} />
        <StatCard label="المخازن" value={`${whs.get(o.materialWarehouseId) ?? ''} ← ${whs.get(o.outputWarehouseId) ?? ''}`} hint={`${fmtDate(o.startDate)} — ${fmtDate(o.dueDate)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm lg:col-span-2">
          <h3 className="mb-3 font-semibold">الخامات المطلوبة {o.materialsIssued && <span className="text-sm font-normal text-emerald-700">(تم الصرف)</span>}</h3>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-muted/60"><tr><th className="p-2 text-right">الخامة</th><th className="p-2 text-right">المطلوب</th><th className="p-2 text-right">المتاح</th><th className="p-2 text-right">التكلفة</th></tr></thead>
            <tbody>{data.requirements.map((r) => <tr key={r.itemId} className="border-t"><td className="p-2">{r.name}</td><td className="num p-2">{fmtNum(r.required, 3)} {r.unit}</td>
              <td className={`num p-2 ${!o.materialsIssued && r.available < r.required ? 'font-semibold text-destructive' : ''}`}>{fmtNum(r.available, 3)}</td><td className="num p-2">{fmtMoney(r.cost)}</td></tr>)}</tbody>
          </table></div>
          {data.requirements.length === 0 && <p className="py-3 text-sm text-destructive">لم تُحدد مكونات لهذا المنتج. أضفها من صفحة المنتج.</p>}
          {!o.materialsIssued && shortage && <p className="mt-2 text-sm text-destructive">الخامات غير كافية — سجّل مشتريات أو حوّل من مخزن آخر.</p>}
        </div>
        <div className="space-y-2 rounded-xl border bg-card p-4 text-sm shadow-sm">
          <h3 className="mb-2 font-semibold">تكلفة التصنيع</h3>
          {[['المواد الخام', matCost], ['العمالة', o.laborCost], ['التشغيل', o.overheadCost], ['مصروفات مباشرة', o.directExpenses], ['مصروفات غير مباشرة', o.indirectExpenses]].map(([l, v]) => (
            <div key={l as string} className="flex justify-between"><span>{l}</span><span className="num">{fmtMoney(v as number)}</span></div>))}
          <div className="flex justify-between border-t pt-2 font-bold"><span>إجمالي التكلفة</span><span className="num">{fmtMoney(o.status === 'مكتمل' ? o.totalCost : total)}</span></div>
          <div className="flex justify-between"><span>تكلفة الوحدة {o.status !== 'مكتمل' && '(تقديرية)'}</span><span className="num">{fmtMoney(unit)}</span></div>
          <div className="flex justify-between"><span>سعر البيع</span><span className="num">{fmtMoney(data.salePrice)}</span></div>
          <div className={`flex justify-between font-semibold ${margin >= 0 ? 'text-emerald-700' : 'text-destructive'}`}><span>هامش الربح</span><span className="num">{fmtNum(margin, 1)}%</span></div>
          <p className="text-xs text-muted-foreground">الهالك يرفع تكلفة الوحدة لأن التكلفة تُوزع على الكمية المقبولة فقط.</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="mb-3 font-semibold">متابعة المراحل</h3>
        {data.logs.length === 0 ? <p className="text-sm text-muted-foreground">لم تُسجل مراحل بعد</p> : (
          <ol className="relative space-y-3 border-r pr-4">{data.logs.map((l) => (
            <li key={l.id} className="text-sm"><span className="absolute -right-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
              <div className="flex flex-wrap items-center gap-2"><StatusBadge text={l.stageName} /><span>منجز {fmtNum(l.qtyDone)}</span>{l.qtyWaste > 0 && <span className="text-destructive">هالك {fmtNum(l.qtyWaste)}</span>}<span className="text-xs text-muted-foreground">{fmtDateTime(l.at)}</span></div>
              {l.notes && <div className="mt-1 text-muted-foreground">{l.notes}</div>}</li>))}</ol>
        )}
        {o.qualityNotes && <p className="mt-3 rounded-lg bg-muted p-3 text-sm">ملاحظات الجودة: {o.qualityNotes}</p>}
      </div>
      <StepDialog mode={mode} onClose={() => setMode(null)} id={id!} stages={data.stages} />
      <ProductionOrderForm open={edit} onOpenChange={setEdit} order={o as never} />
    </div>
  );
}
