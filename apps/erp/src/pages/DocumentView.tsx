import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Ban, CheckCircle2, CreditCard, Pencil, Printer, Repeat, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { convertDocument, documentAction, getDocument, postDocument } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import PaymentDialog from '../components/PaymentDialog';
import { Confirm, PageHeader, StatusBadge } from '../components/ui-kit';
import { useInvalidate, useNameMap } from '../lib/data';
import { DOC_LABELS, fmtDate, fmtMoney, fmtNum, uid } from '../lib/format';
import { can, useMe } from '../lib/me';

const CONV: Record<string, string[]> = { quote: ['sales_order', 'sales_invoice'], sales_order: ['sales_invoice'], sales_invoice: ['sales_return'], purchase_order: ['purchase_invoice'], purchase_invoice: ['purchase_return'] };
const PAY_KIND = { sales_invoice: 'customer_receipt', purchase_invoice: 'supplier_payment', sales_return: 'customer_refund', purchase_return: 'supplier_refund' } as const;
const DELIVERY = ['قيد التجهيز', 'جاهز للتسليم', 'تم الشحن', 'تم التسليم', 'تم الاستلام'];

export default function DocumentView() {
  const { id } = useParams();
  const nav = useNavigate();
  const me = useMe();
  const invalidate = useInvalidate();
  const [pay, setPay] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['doc', id], queryFn: () => getDocument({ id: id! }) });
  const customers = useNameMap('customers');
  const suppliers = useNameMap('suppliers');
  const whs = useNameMap('warehouses');
  if (isLoading) return <Skeleton className="h-96" />;
  if (!data) return <p>المستند غير موجود</p>;
  const d = data.doc;
  const type = String(d.docType);
  const isSales = !type.startsWith('purchase');
  if (!can(me, isSales ? 'sales' : 'purchases')) return <p>غير مصرح</p>;
  const party = isSales ? customers.get(d.customerId) : suppliers.get(d.supplierId);
  const postable = type in PAY_KIND;
  const remaining = (d.total ?? 0) - (d.paid ?? 0);
  const draft = !d.stockPosted && d.status !== 'ملغي';

  const run = async (fn: () => Promise<unknown>, msg: string) => { await fn(); toast.success(msg); invalidate(); };

  return (
    <div>
      <PageHeader title={`${DOC_LABELS[type]} ${d.number}`} subtitle={d.sourceNumber ? `محوّل من ${d.sourceNumber}` : undefined}
        actions={<>
          <Button variant="outline" onClick={() => nav(isSales ? '/sales' : '/purchases')}><ArrowRight className="ml-1 h-4 w-4" />رجوع</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="ml-1 h-4 w-4" />طباعة / PDF</Button>
          {draft && <Button variant="outline" onClick={() => nav(`/doc/${id}/edit`)}><Pencil className="ml-1 h-4 w-4" />تعديل</Button>}
          {draft && postable && (
            <Confirm title={`ترحيل ${DOC_LABELS[type]}؟`} description={type.includes('purchase_invoice') ? 'سيتم إضافة الكميات للمخزن وتحديث حساب المورد. لا يمكن التعديل بعد الترحيل.' : 'سيتم تحديث المخزون والحسابات. لا يمكن التعديل بعد الترحيل.'}
              trigger={<Button><CheckCircle2 className="ml-1 h-4 w-4" />{type === 'purchase_invoice' ? 'استلام وترحيل' : 'ترحيل'}</Button>}
              onConfirm={() => run(() => postDocument({ id: id! }), 'تم الترحيل وتحديث المخزون والحسابات')} />
          )}
          {d.stockPosted && postable && remaining > 0.009 && <Button onClick={() => setPay(true)}><CreditCard className="ml-1 h-4 w-4" />{type.endsWith('return') ? 'تسجيل رد المبلغ' : 'تسجيل دفعة'}</Button>}
          {(CONV[type] ?? []).filter(() => d.status !== 'ملغي').map((t) => (
            <Confirm key={t} title={`تحويل إلى ${DOC_LABELS[t]}؟`} description="سيتم إنشاء مسودة جديدة بنفس الأصناف يمكنك تعديلها."
              trigger={<Button variant="outline"><Repeat className="ml-1 h-4 w-4" />{DOC_LABELS[t]}</Button>}
              onConfirm={async () => { const r = await convertDocument({ id: id!, to: t as 'sales_invoice', requestId: uid() }); invalidate(); nav(`/doc/${r.id}`); }} />
          ))}
          {draft && (d.paid ?? 0) === 0 && <>
            <Confirm destructive title="إلغاء المستند؟" trigger={<Button variant="outline"><Ban className="ml-1 h-4 w-4" />إلغاء</Button>} onConfirm={() => run(() => documentAction({ id: id!, action: 'cancel' }), 'تم الإلغاء')} />
            <Confirm destructive title="حذف المستند نهائياً؟" trigger={<Button variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>} onConfirm={async () => { await documentAction({ id: id!, action: 'delete' }); invalidate(); nav(isSales ? '/sales' : '/purchases'); }} />
          </>}
        </>} />

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><div className="text-muted-foreground">{isSales ? 'العميل' : 'المورد'}</div><div className="font-semibold">{party}</div></div>
          <div><div className="text-muted-foreground">التاريخ</div><div>{fmtDate(d.docDate)}</div></div>
          <div><div className="text-muted-foreground">الاستحقاق</div><div>{fmtDate(d.dueDate)}</div></div>
          <div><div className="text-muted-foreground">المخزن</div><div>{whs.get(d.warehouseId)}</div></div>
          <div><div className="text-muted-foreground">الحالة</div><StatusBadge text={d.status ?? ''} /></div>
          <div className="no-print"><div className="mb-1 text-muted-foreground">التسليم / الاستلام</div>
            <Select value={d.deliveryStatus || undefined} onValueChange={(v) => run(() => documentAction({ id: id!, action: 'delivery', deliveryStatus: v }), 'تم تحديث حالة التسليم')} dir="rtl">
              <SelectTrigger className="h-8"><SelectValue placeholder="غير محدد" /></SelectTrigger>
              <SelectContent>{([...new Set([...DELIVERY, d.deliveryStatus].filter(Boolean))] as string[]).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="mt-5 overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-muted/60"><tr><th className="p-2 text-right">#</th><th className="p-2 text-right">الصنف</th><th className="p-2 text-right">الكمية</th><th className="p-2 text-right">السعر</th><th className="p-2 text-right">الخصم</th><th className="p-2 text-right">الإجمالي</th></tr></thead>
          <tbody>{data.lines.map((l, i) => <tr key={l.id} className="border-t"><td className="p-2">{i + 1}</td><td className="p-2">{l.itemName}</td><td className="num p-2">{fmtNum(l.quantity)}</td><td className="num p-2">{fmtMoney(l.unitPrice)}</td><td className="num p-2">{fmtMoney(l.lineDiscount)}</td><td className="num p-2">{fmtMoney(l.lineTotal)}</td></tr>)}</tbody>
        </table></div>
        <div className="mr-auto mt-4 max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between"><span>الإجمالي الفرعي</span><span className="num">{fmtMoney(d.subtotal)}</span></div>
          <div className="flex justify-between"><span>الخصم</span><span className="num">{fmtMoney(d.discount)}</span></div>
          <div className="flex justify-between"><span>الضريبة</span><span className="num">{fmtNum(d.taxPercent)}%</span></div>
          <div className="flex justify-between border-t pt-2 text-base font-bold"><span>الإجمالي</span><span className="num">{fmtMoney(d.total)}</span></div>
          {postable && <><div className="flex justify-between"><span>المدفوع</span><span className="num">{fmtMoney(d.paid)}</span></div>
            <div className="flex justify-between font-semibold text-destructive"><span>المتبقي</span><span className="num">{fmtMoney(remaining)}</span></div></>}
        </div>
        {d.notes && <p className="mt-4 rounded-lg bg-muted p-3 text-sm">{d.notes}</p>}
      </div>

      {data.payments.length > 0 && (
        <div className="mt-4 rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="mb-2 font-semibold">المدفوعات</h3>
          {data.payments.map((p) => <div key={p.id} className="flex justify-between border-b py-2 text-sm last:border-0"><span>{p.reference} · {fmtDate(p.date)}</span><span className="num">{fmtMoney(p.amount)}</span></div>)}
        </div>
      )}
      {postable && <PaymentDialog open={pay} onOpenChange={setPay} kind={PAY_KIND[type as keyof typeof PAY_KIND]} lockKind documentId={id} amount={remaining} />}
    </div>
  );
}
