import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getDocument, saveDocument, type SaveDocumentInputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Skeleton } from '@project/components/ui/skeleton';
import { RefSelect } from '../components/EntityForm';
import { PageHeader } from '../components/ui-kit';
import { useInvalidate, useList } from '../lib/data';
import { DOC_LABELS, errMsg, fmtMoney, todayStr, uid } from '../lib/format';

type Line = { key: string; itemId: string; quantity: string; unitPrice: string; lineDiscount: string };
const blank = (): Line => ({ key: uid(), itemId: '', quantity: '1', unitPrice: '', lineDiscount: '0' });

export default function DocumentEditor() {
  const { id, type: newType } = useParams();
  const nav = useNavigate();
  const invalidate = useInvalidate();
  const { data: items } = useList('items');
  const existing = useQuery({ queryKey: ['doc', id], queryFn: () => getDocument({ id: id! }), enabled: !!id });
  const [docType, setDocType] = useState(newType ?? '');
  const [h, setH] = useState({ partyId: '', warehouseId: '', docDate: todayStr(), dueDate: '', discount: '0', taxPercent: '0', notes: '' });
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [reqId] = useState(uid());
  const [busy, setBusy] = useState(false);
  const isSales = ['quote', 'sales_order', 'sales_invoice', 'sales_return'].includes(docType);

  useEffect(() => {
    const d = existing.data;
    if (!d) return;
    setDocType(String(d.doc.docType));
    setH({ partyId: d.doc.customerId || d.doc.supplierId, warehouseId: d.doc.warehouseId, docDate: String(d.doc.docDate ?? '').slice(0, 10), dueDate: String(d.doc.dueDate ?? '').slice(0, 10), discount: String(d.doc.discount ?? 0), taxPercent: String(d.doc.taxPercent ?? 0), notes: d.doc.notes ?? '' });
    setLines(d.lines.map((l) => ({ key: l.id, itemId: l.itemId, quantity: String(l.quantity), unitPrice: String(l.unitPrice), lineDiscount: String(l.lineDiscount) })));
  }, [existing.data]);

  if (id && existing.isLoading) return <Skeleton className="h-96" />;
  if (!DOC_LABELS[docType]) return <p>نوع مستند غير معروف</p>;

  const lineTotal = (l: Line) => (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) - (Number(l.lineDiscount) || 0);
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const total = (subtotal - (Number(h.discount) || 0)) * (1 + (Number(h.taxPercent) || 0) / 100);
  const setLine = (k: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...patch } : l)));
  const pickItem = (k: string, itemId: string) => {
    const it = items?.find((i) => i.id === itemId);
    setLine(k, { itemId, unitPrice: String((isSales ? it?.salePrice : it?.unitCost) ?? 0) });
  };

  const save = async () => {
    if (!h.partyId) return toast.error(isSales ? 'اختر العميل' : 'اختر المورد');
    if (!h.warehouseId) return toast.error('اختر المخزن');
    const valid = lines.filter((l) => l.itemId);
    if (!valid.length) return toast.error('أضف صنفاً واحداً على الأقل');
    if (valid.some((l) => !(Number(l.quantity) > 0))) return toast.error('الكميات يجب أن تكون أكبر من صفر');
    setBusy(true);
    try {
      const payload: SaveDocumentInputType = {
        id, requestId: reqId, docType: docType as SaveDocumentInputType['docType'], docDate: h.docDate, dueDate: h.dueDate || undefined,
        customerId: isSales ? h.partyId : undefined, supplierId: isSales ? undefined : h.partyId, warehouseId: h.warehouseId,
        discount: Number(h.discount) || 0, taxPercent: Number(h.taxPercent) || 0, notes: h.notes || undefined,
        lines: valid.map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) || 0, lineDiscount: Number(l.lineDiscount) || 0 })),
      };
      const r = await saveDocument(payload);
      toast.success('تم حفظ المستند');
      invalidate();
      nav(`/doc/${r.id}`, { replace: true });
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title={`${id ? 'تعديل' : 'إنشاء'} ${DOC_LABELS[docType]}`} actions={<><Button onClick={save} disabled={busy}>{busy ? 'جارٍ الحفظ...' : 'حفظ كمسودة'}</Button><Button variant="outline" onClick={() => nav(-1)}>إلغاء</Button></>} />
      <div className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><Label className="mb-1 block">{isSales ? 'العميل *' : 'المورد *'}</Label><RefSelect entity={isSales ? 'customers' : 'suppliers'} value={h.partyId} onChange={(v) => setH({ ...h, partyId: v })} /></div>
        <div><Label className="mb-1 block">المخزن *</Label><RefSelect entity="warehouses" value={h.warehouseId} onChange={(v) => setH({ ...h, warehouseId: v })} filter={(w) => w.active !== false} /></div>
        <div><Label className="mb-1 block">التاريخ</Label><Input type="date" value={h.docDate} onChange={(e) => setH({ ...h, docDate: e.target.value })} /></div>
        <div><Label className="mb-1 block">تاريخ الاستحقاق / التسليم</Label><Input type="date" value={h.dueDate} onChange={(e) => setH({ ...h, dueDate: e.target.value })} /></div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/60"><tr><th className="p-2 text-right">الصنف</th><th className="w-24 p-2 text-right">الكمية</th><th className="w-32 p-2 text-right">سعر الوحدة</th><th className="w-28 p-2 text-right">خصم السطر</th><th className="w-32 p-2 text-right">الإجمالي</th><th className="w-10" /></tr></thead>
          <tbody>{lines.map((l) => (
            <tr key={l.key} className="border-t">
              <td className="p-2"><RefSelect entity="items" value={l.itemId} onChange={(v) => pickItem(l.key, v)} filter={(i) => i.active !== false && (isSales ? i.itemType === 'product' : true)} /></td>
              <td className="p-2"><Input type="number" step="any" min={0} value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} /></td>
              <td className="p-2"><Input type="number" step="any" min={0} value={l.unitPrice} onChange={(e) => setLine(l.key, { unitPrice: e.target.value })} /></td>
              <td className="p-2"><Input type="number" step="any" min={0} value={l.lineDiscount} onChange={(e) => setLine(l.key, { lineDiscount: e.target.value })} /></td>
              <td className="num p-2 font-medium">{fmtMoney(lineTotal(l))}</td>
              <td className="p-2"><Button size="icon" variant="ghost" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
            </tr>
          ))}</tbody>
        </table>
        <div className="border-t p-2"><Button variant="ghost" size="sm" onClick={() => setLines((ls) => [...ls, blank()])}><Plus className="ml-1 h-4 w-4" />إضافة سطر</Button></div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div><Label className="mb-1 block">ملاحظات</Label><Textarea rows={4} value={h.notes} onChange={(e) => setH({ ...h, notes: e.target.value })} /></div>
        <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex justify-between"><span>الإجمالي قبل الخصم</span><span className="num">{fmtMoney(subtotal)}</span></div>
          <div className="flex items-center justify-between gap-3"><span>خصم إضافي (ج.م)</span><Input type="number" step="any" min={0} className="w-36" value={h.discount} onChange={(e) => setH({ ...h, discount: e.target.value })} /></div>
          <div className="flex items-center justify-between gap-3"><span>الضريبة %</span><Input type="number" step="any" min={0} className="w-36" value={h.taxPercent} onChange={(e) => setH({ ...h, taxPercent: e.target.value })} /></div>
          <div className="flex justify-between border-t pt-3 text-lg font-bold"><span>الإجمالي النهائي</span><span className="num">{fmtMoney(total)}</span></div>
          <p className="text-xs text-muted-foreground">يتم إعادة احتساب الإجماليات على الخادم عند الحفظ.</p>
        </div>
      </div>
    </div>
  );
}
