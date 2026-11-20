import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { listAppUsers, saveAppUser, type ListAppUsersOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Switch } from '@project/components/ui/switch';
import { Checkbox } from '@project/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import DataTable from '../components/DataTable';
import { PageHeader } from '../components/ui-kit';
import { useInvalidate } from '../lib/data';
import { errMsg, PERM_LABELS } from '../lib/format';

type Acc = ListAppUsersOutputType['accounts'][0];
type Perm = 'products' | 'inventory' | 'purchases' | 'sales' | 'production' | 'hr' | 'finance' | 'reports';

function AccountDialog({ open, onOpenChange, acc, people }: { open: boolean; onOpenChange: (o: boolean) => void; acc: Acc | null; people: ListAppUsersOutputType['people'] }) {
  const [f, setF] = useState({ userId: '', displayName: '', role: 'employee', permissions: [] as string[], active: true });
  const [busy, setBusy] = useState(false);
  const invalidate = useInvalidate();
  const [lastKey, setLastKey] = useState('');
  const key = `${open}-${acc?.id ?? 'new'}`;
  if (key !== lastKey) { setLastKey(key); if (open) setF(acc ? { userId: acc.userId, displayName: acc.displayName, role: acc.role, permissions: acc.permissions, active: acc.active } : { userId: '', displayName: '', role: 'employee', permissions: [], active: true }); }
  const submit = async () => {
    if (!f.userId || !f.displayName.trim()) return toast.error('اختر الشخص واكتب الاسم');
    setBusy(true);
    try {
      await saveAppUser({ id: acc?.id, userId: f.userId, displayName: f.displayName, role: f.role as 'admin', permissions: f.permissions as Perm[], active: f.active });
      toast.success('تم الحفظ'); invalidate(); onOpenChange(false);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-lg">
        <DialogHeader><DialogTitle className="text-right">{acc ? 'تعديل الحساب' : 'إضافة حساب'}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          {!acc && <div><Label className="mb-1 block">الشخص (من أعضاء مساحة العمل)</Label>
            <Select value={f.userId || undefined} onValueChange={(v) => { const p = people.find((x) => x.id === v); setF({ ...f, userId: v, displayName: f.displayName || p?.name || '' }); }} dir="rtl">
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>{people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name || p.email} — {p.email}</SelectItem>)}</SelectContent></Select></div>}
          <div><Label className="mb-1 block">الاسم المعروض</Label><Input value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></div>
          <div><Label className="mb-1 block">الدور</Label>
            <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v })} dir="rtl"><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="admin">مسؤول (كل الصلاحيات)</SelectItem><SelectItem value="employee">موظف (صلاحيات محددة)</SelectItem></SelectContent></Select></div>
          {f.role === 'employee' && <div><Label className="mb-2 block">الأقسام المسموح بها</Label>
            <div className="grid grid-cols-2 gap-2">{Object.entries(PERM_LABELS).map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 text-sm"><Checkbox checked={f.permissions.includes(k)} onCheckedChange={(c) => setF({ ...f, permissions: c ? [...f.permissions, k] : f.permissions.filter((x) => x !== k) })} />{l}</label>))}</div></div>}
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} />الحساب مُفعّل</label>
        </div>
        <DialogFooter className="gap-2 sm:justify-start"><Button onClick={submit} disabled={busy}>حفظ</Button><Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const { data, isLoading } = useQuery({ queryKey: ['appUsers'], queryFn: () => listAppUsers({}) });
  const [open, setOpen] = useState(false);
  const [acc, setAcc] = useState<Acc | null>(null);
  const linked = new Set((data?.accounts ?? []).map((a) => a.userId));
  return (
    <div>
      <PageHeader title="المستخدمون والصلاحيات" subtitle="المسؤولون متساوون في الصلاحيات تماماً. حدد لكل موظف الأقسام التي يمكنه الوصول إليها."
        actions={<Button onClick={() => { setAcc(null); setOpen(true); }}><UserPlus className="ml-1 h-4 w-4" />إضافة حساب</Button>} />
      <div className="mb-4 rounded-xl border bg-accent/50 p-3 text-sm text-accent-foreground">
        لإضافة شخص جديد: ادعُه أولاً للتطبيق من صفحة المستخدمين في Zite، ثم اختره هنا وحدد دوره وصلاحياته. الصلاحيات تُطبق على الخادم في كل عملية.
      </div>
      <DataTable rows={data?.accounts} loading={isLoading} exportName="المستخدمون" columns={[
        { key: 'displayName', label: 'الاسم', className: 'font-medium' }, { key: 'email', label: 'البريد' },
        { key: 'role', label: 'الدور', value: (r) => (r.role === 'admin' ? 'مسؤول' : 'موظف') },
        { key: 'permissions', label: 'الصلاحيات', value: (r) => (r.role === 'admin' ? 'كل الأقسام' : r.permissions.map((p) => PERM_LABELS[p]).join('، ') || 'لا شيء') },
        { key: 'active', label: 'الحالة', value: (r) => (r.active ? 'مُفعّل' : 'موقوف'), render: (r) => <span className={r.active ? 'text-emerald-700' : 'text-destructive'}>{r.active ? 'مُفعّل' : 'موقوف'}</span> },
        { key: '_', label: '', value: () => '', render: (r) => <Button size="icon" variant="ghost" onClick={() => { setAcc(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button> },
      ]} />
      <AccountDialog open={open} onOpenChange={setOpen} acc={acc} people={(data?.people ?? []).filter((p) => acc || !linked.has(p.id))} />
    </div>
  );
}
