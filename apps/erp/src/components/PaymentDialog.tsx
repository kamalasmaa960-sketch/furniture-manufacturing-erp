import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { recordTransaction, type RecordTransactionInputType } from 'zitejs/api';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { RefSelect } from './EntityForm';
import { useInvalidate } from '../lib/data';
import { errMsg, todayStr, uid } from '../lib/format';

type Kind = RecordTransactionInputType['kind'];
export const KIND_LABELS: Record<Kind, string> = {
  customer_receipt: 'تحصيل من عميل', supplier_payment: 'سداد لمورد', customer_refund: 'رد مبلغ لعميل', supplier_refund: 'استرداد من مورد',
  expense: 'تسجيل مصروف', revenue: 'تسجيل إيراد آخر', transfer: 'تحويل بين الخزائن/البنوك',
};
const EXPENSE_CATS = ['مصروفات مباشرة للإنتاج', 'مصروفات غير مباشرة', 'تشغيل وصيانة', 'كهرباء ومياه وغاز', 'إيجار', 'نقل وشحن', 'سلف موظفين', 'ضرائب ورسوم', 'تسويق', 'أخرى'];

export default function PaymentDialog({ open, onOpenChange, kind: presetKind, documentId, partyId, amount: presetAmount, lockKind }: {
  open: boolean; onOpenChange: (o: boolean) => void; kind?: Kind; documentId?: string; partyId?: string; amount?: number; lockKind?: boolean;
}) {
  const [kind, setKind] = useState<Kind>(presetKind ?? 'expense');
  const [f, setF] = useState({ amount: '', accountId: '', toAccountId: '', partyId: '', category: '', txDate: todayStr(), notes: '' });
  const [reqId, setReqId] = useState(uid());
  const [busy, setBusy] = useState(false);
  const invalidate = useInvalidate();

  useEffect(() => {
    if (open) {
      setKind(presetKind ?? 'expense');
      setF((s) => ({ ...s, amount: presetAmount ? String(Math.round(presetAmount * 100) / 100) : '', partyId: partyId ?? '', category: '', notes: '' }));
      setReqId(uid());
    }
  }, [open, presetKind, presetAmount, partyId]);

  const isCustomer = kind.startsWith('customer');
  const isSupplier = kind.startsWith('supplier');
  const submit = async () => {
    if (!(Number(f.amount) > 0)) return toast.error('أدخل مبلغاً صحيحاً');
    if (!f.accountId) return toast.error('اختر الخزينة أو البنك');
    setBusy(true);
    try {
      const r = await recordTransaction({
        requestId: reqId, kind, amount: Number(f.amount), accountId: f.accountId, toAccountId: f.toAccountId || undefined,
        customerId: isCustomer ? f.partyId || undefined : undefined, supplierId: isSupplier ? f.partyId || undefined : undefined,
        documentId, category: f.category || undefined, txDate: f.txDate, notes: f.notes || undefined,
      });
      toast.success(r.duplicate ? 'هذه العملية مسجلة بالفعل' : `تم التسجيل ${r.reference}`);
      invalidate(); onOpenChange(false);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="text-right">{KIND_LABELS[kind]}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          {!lockKind && (
            <div><Label className="mb-1 block">نوع العملية</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as Kind)} dir="rtl"><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(KIND_LABELS) as Kind[]).map((k) => <SelectItem key={k} value={k}>{KIND_LABELS[k]}</SelectItem>)}</SelectContent></Select></div>
          )}
          {(isCustomer || isSupplier) && !documentId && (
            <div><Label className="mb-1 block">{isCustomer ? 'العميل *' : 'المورد *'}</Label><RefSelect entity={isCustomer ? 'customers' : 'suppliers'} value={f.partyId} onChange={(v) => setF({ ...f, partyId: v })} /></div>
          )}
          {(kind === 'expense' || kind === 'revenue') && (
            <div><Label className="mb-1 block">البند</Label>
              {kind === 'expense' ? (
                <Select value={f.category || undefined} onValueChange={(v) => setF({ ...f, category: v })} dir="rtl"><SelectTrigger><SelectValue placeholder="اختر البند" /></SelectTrigger>
                  <SelectContent>{EXPENSE_CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
              ) : <Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="مثال: بيع مخلفات" />}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="mb-1 block">المبلغ (ج.م) *</Label><Input type="number" step="any" min={0} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
            <div><Label className="mb-1 block">التاريخ</Label><Input type="date" value={f.txDate} onChange={(e) => setF({ ...f, txDate: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="mb-1 block">{kind === 'transfer' ? 'من حساب *' : 'الخزينة / البنك *'}</Label><RefSelect entity="financeAccounts" value={f.accountId} onChange={(v) => setF({ ...f, accountId: v })} /></div>
            {kind === 'transfer' && <div><Label className="mb-1 block">إلى حساب *</Label><RefSelect entity="financeAccounts" value={f.toAccountId} onChange={(v) => setF({ ...f, toAccountId: v })} /></div>}
          </div>
          <div><Label className="mb-1 block">ملاحظات</Label><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <DialogFooter className="gap-2 sm:justify-start"><Button onClick={submit} disabled={busy}>{busy ? 'جارٍ التسجيل...' : 'تسجيل'}</Button><Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
