import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAuditLogs, type ListAuditLogsOutputType } from 'zitejs/api';
import { Input } from '@project/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import DataTable from '../components/DataTable';
import { PageHeader } from '../components/ui-kit';
import { fmtDateTime } from '../lib/format';

type Log = ListAuditLogsOutputType['logs'][0];
const pretty = (s: string) => { try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; } };

export default function AuditPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sel, setSel] = useState<Log | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['audit', from, to], queryFn: () => listAuditLogs({ from: from || undefined, to: to || undefined }) });
  return (
    <div>
      <PageHeader title="سجل العمليات والمراجعة" subtitle="سجل للقراءة فقط لكل العمليات — لا يمكن تعديله أو حذفه من النظام" />
      <DataTable rows={data?.logs as Log[] | undefined} loading={isLoading} onRowClick={(r: Log) => setSel(r)} exportName="سجل العمليات" pageSize={25}
        toolbar={<><Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} /><Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} /></>}
        columns={[
          { key: 'createdAt', label: 'التاريخ والوقت', render: (r) => fmtDateTime(r.createdAt) }, { key: 'actorName', label: 'المستخدم' },
          { key: 'action', label: 'العملية' }, { key: 'module', label: 'القسم' }, { key: 'description', label: 'التفاصيل' },
        ]} />
      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle className="text-right">{sel?.description}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground">{sel?.actorName} · {fmtDateTime(sel?.createdAt)}</div>
          <div className="grid gap-3 md:grid-cols-2">
            <div><div className="mb-1 font-semibold">القيم السابقة</div><pre dir="ltr" className="max-h-80 overflow-auto rounded bg-muted p-2 text-xs">{sel?.beforeData ? pretty(sel.beforeData) : '—'}</pre></div>
            <div><div className="mb-1 font-semibold">القيم الجديدة</div><pre dir="ltr" className="max-h-80 overflow-auto rounded bg-muted p-2 text-xs">{sel?.afterData ? pretty(sel.afterData) : '—'}</pre></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
