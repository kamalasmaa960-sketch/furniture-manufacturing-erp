import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { exportBackup } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { errMsg } from '../lib/format';

export default function BackupCard() {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const res = await exportBackup({});
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `erp-backup-${res.createdAt.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      const total = Object.values(res.counts).reduce((s, n) => s + n, 0);
      toast.success(`تم تنزيل النسخة الاحتياطية (${total} سجل)`);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="font-semibold">نسخة احتياطية على جهازك</div>
        <div className="text-sm text-muted-foreground">ينزّل ملف واحد فيه كل بيانات النظام (أصناف، مستندات، مخزون، حسابات، رواتب، سجل العمليات). احفظيه على جهازك أو ابعتيه لنفسك.</div>
      </div>
      <Button onClick={run} disabled={busy} className="shrink-0">
        {busy ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <Download className="ml-1 h-4 w-4" />}تنزيل نسخة احتياطية
      </Button>
    </div>
  );
}
