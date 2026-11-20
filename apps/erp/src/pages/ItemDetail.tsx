import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useUpload } from 'zitejs/upload';
import { deleteRecord, listMovements, saveRecord, stockOverview } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Skeleton } from '@project/components/ui/skeleton';
import DataTable from '../components/DataTable';
import EntityForm, { RefSelect } from '../components/EntityForm';
import { Confirm, PageHeader, StatCard } from '../components/ui-kit';
import { itemFields } from './ItemsPage';
import { useInvalidate, useList, useNameMap, type Rec } from '../lib/data';
import { errMsg, first, fmtDate, fmtMoney, fmtNum } from '../lib/format';

function ImageUpload({ item }: { item: Rec }) {
  const { upload, isUploading } = useUpload();
  const invalidate = useInvalidate();
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return toast.error('الصيغ المسموحة: JPG أو PNG أو WEBP');
    if (f.size > 5 * 1024 * 1024) return toast.error('الحد الأقصى لحجم الصورة 5 ميجابايت');
    try {
      const { url } = await upload(f);
      const data: Record<string, unknown> = {};
      for (const fd of itemFields(item.itemType)) { const v = fd.type === 'ref' ? first(item[fd.key]) : item[fd.key]; if (v !== undefined && v !== null && v !== '') data[fd.key] = v; }
      await saveRecord({ entity: 'items', id: item.id, data: { ...data, image: [url] } });
      toast.success('تم رفع الصورة'); invalidate();
    } catch (err) { toast.error(errMsg(err)); }
  };
  return (
    <label className="group relative flex h-40 w-40 cursor-pointer items-center justify-center overflow-hidden rounded-xl border bg-muted">
      {item.image?.[0]?.url ? <img src={item.image[0].url} alt={item.name} className="h-full w-full object-cover" /> : <ImagePlus className="h-8 w-8 text-muted-foreground" />}
      <span className="absolute inset-x-0 bottom-0 bg-black/50 py-1 text-center text-xs text-white">{isUploading ? 'جارٍ الرفع...' : 'تغيير الصورة'}</span>
      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} disabled={isUploading} />
    </label>
  );
}

function Bom({ item }: { item: Rec }) {
  const { data: bom } = useList('bomLines');
  const { data: items } = useList('items');
  const invalidate = useInvalidate();
  const [comp, setComp] = useState('');
  const [qty, setQty] = useState('');
  const [waste, setWaste] = useState('0');
  const lines = (bom ?? []).filter((b) => first(b.product) === item.id);
  const byId = new Map((items ?? []).map((i) => [i.id, i]));
  const total = lines.reduce((s, b) => s + (b.quantityPerUnit ?? 0) * (1 + (b.wastePercent ?? 0) / 100) * (byId.get(first(b.component))?.unitCost ?? 0), 0);
  const add = async () => {
    if (!comp || !(Number(qty) > 0)) return toast.error('اختر الخامة وأدخل الكمية');
    try { await saveRecord({ entity: 'bomLines', data: { product: item.id, component: comp, quantityPerUnit: Number(qty), wastePercent: Number(waste) || 0 } }); setComp(''); setQty(''); invalidate(); toast.success('تمت الإضافة'); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">مكونات التصنيع (الخامات لكل وحدة)</h3><span className="text-sm">تكلفة الخامات للوحدة: <b className="num">{fmtMoney(total)}</b></span></div>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-muted/60"><tr><th className="p-2 text-right">الخامة</th><th className="p-2 text-right">الكمية/وحدة</th><th className="p-2 text-right">نسبة الهالك</th><th className="p-2 text-right">التكلفة</th><th /></tr></thead>
        <tbody>{lines.map((b) => { const c = byId.get(first(b.component)); return (
          <tr key={b.id} className="border-t"><td className="p-2">{c?.name}</td><td className="num p-2">{fmtNum(b.quantityPerUnit, 4)} {c?.unit}</td><td className="num p-2">{fmtNum(b.wastePercent)}%</td>
            <td className="num p-2">{fmtMoney((b.quantityPerUnit ?? 0) * (1 + (b.wastePercent ?? 0) / 100) * (c?.unitCost ?? 0))}</td>
            <td className="p-2"><Confirm destructive title="حذف المكون؟" trigger={<Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>} onConfirm={async () => { await deleteRecord({ entity: 'bomLines', id: b.id }); invalidate(); }} /></td></tr>
        ); })}</tbody>
      </table></div>
      {lines.length === 0 && <p className="py-3 text-center text-sm text-muted-foreground">لم تُحدد خامات بعد — أضفها ليتمكن النظام من صرفها في أوامر الإنتاج</p>}
      <div className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <div><Label className="mb-1 block text-xs">الخامة</Label><RefSelect entity="items" value={comp} onChange={setComp} filter={(r) => r.itemType === 'material'} /></div>
        <div><Label className="mb-1 block text-xs">الكمية لكل وحدة</Label><Input type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <div><Label className="mb-1 block text-xs">هالك %</Label><Input type="number" step="any" value={waste} onChange={(e) => setWaste(e.target.value)} /></div>
        <Button onClick={add}><Plus className="ml-1 h-4 w-4" />إضافة</Button>
      </div>
    </div>
  );
}

export default function ItemDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: items, isLoading } = useList('items');
  const whNames = useNameMap('warehouses');
  const [edit, setEdit] = useState(false);
  const { data: stock } = useQuery({ queryKey: ['stockOverview'], queryFn: () => stockOverview({}) });
  const { data: mv, isLoading: mvl } = useQuery({ queryKey: ['movements', id], queryFn: () => listMovements({ itemId: id }) });
  const item = items?.find((i) => i.id === id);
  if (isLoading) return <Skeleton className="h-64" />;
  if (!item) return <p>الصنف غير موجود</p>;
  const t = stock?.totals.find((x) => x.itemId === id);
  const balances = (stock?.balances ?? []).filter((b) => b.itemId === id && Math.abs(b.qty) > 1e-9);
  const variants = item.productGroup ? (items ?? []).filter((i) => i.productGroup === item.productGroup && i.id !== item.id) : [];
  const isProduct = item.itemType === 'product';
  const margin = item.salePrice ? ((item.salePrice - (item.unitCost ?? 0)) / item.salePrice) * 100 : 0;

  return (
    <div className="space-y-4">
      <PageHeader title={item.name} subtitle={`${isProduct ? 'منتج نهائي' : 'مادة خام'} · ${item.code}${item.category ? ' · ' + item.category : ''}`}
        actions={<><Button variant="outline" onClick={() => nav(-1)}><ArrowRight className="ml-1 h-4 w-4" />رجوع</Button><Button onClick={() => setEdit(true)}><Pencil className="ml-1 h-4 w-4" />تعديل</Button></>} />
      <div className="flex flex-col gap-4 md:flex-row">
        <ImageUpload item={item} />
        <div className="grid flex-1 grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="الرصيد المتاح" value={`${fmtNum(t?.qty ?? 0)} ${item.unit ?? ''}`} tone={item.minStock && (t?.qty ?? 0) <= item.minStock ? 'bad' : 'default'} hint={`الحد الأدنى ${fmtNum(item.minStock ?? 0)}`} />
          <StatCard label={isProduct ? 'الكمية المباعة' : 'المستهلك في الإنتاج'} value={fmtNum(isProduct ? t?.sold ?? 0 : t?.consumed ?? 0)} />
          {isProduct && <StatCard label="الكمية المنتجة" value={fmtNum(t?.produced ?? 0)} />}
          <StatCard label="تكلفة الوحدة" value={fmtMoney(item.unitCost)} />
          {isProduct && <StatCard label="سعر البيع / الهامش" value={fmtMoney(item.salePrice)} hint={`هامش الربح ${fmtNum(margin, 1)}%`} tone={margin >= 0 ? 'good' : 'bad'} />}
          <StatCard label="المقاس / اللون / الخامة" value={[item.size, item.color, item.material].filter(Boolean).join(' · ') || '—'} />
        </div>
      </div>
      {item.description && <p className="rounded-xl border bg-card p-4 text-sm">{item.description}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="mb-3 font-semibold">الرصيد حسب المخزن</h3>
          {balances.length === 0 ? <p className="text-sm text-muted-foreground">لا يوجد رصيد</p> : balances.map((b) => (
            <div key={b.warehouseId} className="flex justify-between border-b py-2 text-sm last:border-0"><span>{whNames.get(b.warehouseId)}</span><span className="num font-medium">{fmtNum(b.qty)} {item.unit}</span></div>
          ))}
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="mb-3 font-semibold">الأنواع والمقاسات الأخرى من نفس الموديل</h3>
          {variants.length === 0 ? <p className="text-sm text-muted-foreground">حدد "المجموعة / الموديل" لربط المقاسات والألوان المختلفة</p> : variants.map((v) => (
            <Link key={v.id} to={`/items/${v.id}`} className="flex justify-between border-b py-2 text-sm text-primary last:border-0 hover:underline"><span>{v.name}</span><span>{[v.size, v.color].filter(Boolean).join(' · ')}</span></Link>
          ))}
        </div>
      </div>
      {isProduct && <Bom item={item} />}
      <div>
        <h3 className="mb-2 font-semibold">سجل حركة الصنف</h3>
        <DataTable rows={mv?.movements} loading={mvl} exportName={`حركة ${item.name}`} columns={[
          { key: 'date', label: 'التاريخ', render: (r) => fmtDate(r.date) }, { key: 'reference', label: 'المرجع' }, { key: 'type', label: 'الحركة' },
          { key: 'warehouseName', label: 'المخزن' }, { key: 'qtyIn', label: 'وارد', render: (r) => <span className="num text-emerald-700">{r.qtyIn ? fmtNum(r.qtyIn) : ''}</span> },
          { key: 'qtyOut', label: 'منصرف', render: (r) => <span className="num text-destructive">{r.qtyOut ? fmtNum(r.qtyOut) : ''}</span> },
          { key: 'unitCost', label: 'التكلفة', render: (r) => <span className="num">{fmtMoney(r.unitCost)}</span> }, { key: 'notes', label: 'ملاحظات' },
        ]} />
      </div>
      <EntityForm entity="items" title={isProduct ? 'منتج' : 'خامة'} fields={itemFields(item.itemType)} record={item} open={edit} onOpenChange={setEdit} />
    </div>
  );
}
