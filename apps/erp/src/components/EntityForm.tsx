import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { saveRecord } from 'zitejs/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Switch } from '@project/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { useList, useInvalidate, type Rec } from '../lib/data';
import { errMsg, first } from '../lib/format';

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'money' | 'date' | 'month' | 'checkbox' | 'select' | 'ref';
  options?: { value: string; label: string }[];
  ref?: string;
  refFilter?: (r: Rec) => boolean;
  required?: boolean;
  full?: boolean;
  defaultValue?: unknown;
}

export function RefSelect({ entity, value, onChange, filter, placeholder }: { entity: string; value: string; onChange: (v: string) => void; filter?: (r: Rec) => boolean; placeholder?: string }) {
  const { data } = useList(entity);
  const list = (data ?? []).filter((r) => (filter ? filter(r) : true));
  return (
    <Select value={value || undefined} onValueChange={onChange} dir="rtl">
      <SelectTrigger><SelectValue placeholder={placeholder ?? 'اختر...'} /></SelectTrigger>
      <SelectContent>
        {list.map((r) => <SelectItem key={r.id} value={r.id}>{r.name ?? r.label}{r.code ? ` (${r.code})` : ''}</SelectItem>)}
        {list.length === 0 && <div className="p-2 text-sm text-muted-foreground">لا توجد سجلات</div>}
      </SelectContent>
    </Select>
  );
}

export function FieldInput({ f, value, onChange }: { f: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  switch (f.type) {
    case 'textarea': return <Textarea value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} rows={3} />;
    case 'checkbox': return <div className="pt-1"><Switch checked={!!value} onCheckedChange={onChange} /></div>;
    case 'select': return (
      <Select value={(value as string) || undefined} onValueChange={onChange} dir="rtl">
        <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
        <SelectContent>{f.options!.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    );
    case 'ref': return <RefSelect entity={f.ref!} value={(value as string) ?? ''} onChange={onChange} filter={f.refFilter} />;
    case 'number': case 'money':
      return <Input type="number" step="any" min={0} value={(value as string | number) ?? ''} onChange={(e) => onChange(e.target.value)} className="num" />;
    case 'date': return <Input type="date" value={((value as string) ?? '').slice(0, 10)} onChange={(e) => onChange(e.target.value)} />;
    case 'month': return <Input type="month" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
    default: return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }
}

export default function EntityForm({ entity, title, fields, record, open, onOpenChange, onSaved }: {
  entity: string; title: string; fields: FieldDef[]; record: Rec | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved?: (id: string) => void;
}) {
  const [vals, setVals] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const invalidate = useInvalidate();

  useEffect(() => {
    if (!open) return;
    const v: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = record?.[f.key];
      v[f.key] = f.type === 'ref' ? first(raw) : raw ?? f.defaultValue ?? (f.type === 'checkbox' ? false : '');
    }
    setVals(v);
  }, [open, record, fields]);

  const submit = async () => {
    for (const f of fields) {
      if (f.required && (vals[f.key] === '' || vals[f.key] == null)) return toast.error(`حقل "${f.label}" مطلوب`);
    }
    const data: Record<string, unknown> = {};
    for (const f of fields) {
      const v = vals[f.key];
      if (v === '' || v == null) continue;
      data[f.key] = f.type === 'number' || f.type === 'money' ? Number(v) : v;
    }
    setBusy(true);
    try {
      const r = await saveRecord({ entity, id: record?.id, data });
      toast.success('تم الحفظ بنجاح');
      invalidate();
      onOpenChange(false);
      onSaved?.(r.id);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle className="text-right">{record ? `تعديل ${title}` : `إضافة ${title}`}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className={f.full || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
              <Label className="mb-1.5 block">{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
              <FieldInput f={f} value={vals[f.key]} onChange={(v) => setVals((s) => ({ ...s, [f.key]: v }))} />
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button onClick={submit} disabled={busy}>{busy ? 'جارٍ الحفظ...' : 'حفظ'}</Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
