import { useState, type ReactNode } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@project/components/ui/alert-dialog';
import { toast } from 'sonner';
import { errMsg } from '../lib/format';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 no-print">{actions}</div>}
    </div>
  );
}

export function Confirm({ trigger, title, description, onConfirm, destructive }: {
  trigger: ReactNode; title: string; description?: string; onConfirm: () => Promise<unknown> | void; destructive?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-right">{title}</AlertDialogTitle>
          {description && <AlertDialogDescription className="text-right">{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:justify-start">
          <AlertDialogAction
            disabled={busy}
            className={destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try { await onConfirm(); setOpen(false); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
            }}
          >
            {busy ? 'جارٍ التنفيذ...' : 'تأكيد'}
          </AlertDialogAction>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function StatCard({ label, value, hint, icon, tone = 'default' }: { label: string; value: string; hint?: string; icon?: ReactNode; tone?: 'default' | 'good' | 'bad' | 'warn' }) {
  const tones = { default: 'bg-secondary text-secondary-foreground', good: 'bg-emerald-50 text-emerald-700', bad: 'bg-red-50 text-red-700', warn: 'bg-accent text-accent-foreground' };
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon && <span className={`rounded-lg p-2 ${tones[tone]}`}>{icon}</span>}
      </div>
      <div className="num mt-2 text-xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function StatusBadge({ text }: { text: string }) {
  const map: Record<string, string> = {
    'مسودة': 'bg-muted text-muted-foreground', 'مُرحّلة': 'bg-sky-50 text-sky-700', 'مسددة': 'bg-emerald-50 text-emerald-700',
    'مسددة جزئياً': 'bg-amber-50 text-amber-700', 'ملغي': 'bg-red-50 text-red-700', 'محوّل': 'bg-violet-50 text-violet-700',
    'قيد التنفيذ': 'bg-sky-50 text-sky-700', 'فحص الجودة': 'bg-amber-50 text-amber-700', 'مكتمل': 'bg-emerald-50 text-emerald-700',
  };
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${map[text] ?? 'bg-muted text-muted-foreground'}`}>{text || '—'}</span>;
}
