import { useMemo, useState, type ReactNode } from 'react';
import { ArrowUpDown, ChevronLeft, ChevronRight, Download, Search, Inbox } from 'lucide-react';
import { Input } from '@project/components/ui/input';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import { downloadCsv } from '../lib/export';
import { cn } from '@project/components/lib/utils';

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  value?: (row: T) => string | number; // used for sort, search and export
  className?: string;
}

interface Props<T> {
  rows: T[] | undefined;
  columns: Column<T>[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  toolbar?: ReactNode;
  exportName?: string;
  pageSize?: number;
  emptyText?: string;
}

export default function DataTable<T extends { id?: string }>({ rows, columns, loading, onRowClick, toolbar, exportName, pageSize = 15, emptyText }: Props<T>) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  const val = (c: Column<T>, r: T) => (c.value ? c.value(r) : ((r as Record<string, unknown>)[c.key] as string | number) ?? '');

  const filtered = useMemo(() => {
    let list = rows ?? [];
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((r) => columns.some((c) => String(val(c, r)).toLowerCase().includes(s)));
    }
    if (sort) {
      const c = columns.find((x) => x.key === sort.key)!;
      list = [...list].sort((a, b) => {
        const x = val(c, a), y = val(c, b);
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ar')) * sort.dir;
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const view = filtered.slice(cur * pageSize, cur * pageSize + pageSize);

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b p-3 no-print">
        <div className="relative w-full sm:w-64">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="بحث..." className="pr-9" />
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          {toolbar}
          {exportName && (
            <Button variant="outline" size="sm" onClick={() => downloadCsv(exportName, columns.map((c) => c.label), filtered.map((r) => columns.map((c) => val(c, r))))}>
              <Download className="ml-1 h-4 w-4" /> CSV
            </Button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={cn('whitespace-nowrap px-3 py-2.5 text-right font-medium', c.className)}>
                  <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === 1 ? -1 : 1 }))}>
                    {c.label} <ArrowUpDown className="h-3 w-3 opacity-50" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-t"><td colSpan={columns.length} className="p-3"><Skeleton className="h-5 w-full" /></td></tr>
            ))}
            {!loading && view.map((r, i) => (
              <tr key={r.id ?? i} onClick={() => onRowClick?.(r)} className={cn('border-t transition-colors hover:bg-muted/40', onRowClick && 'cursor-pointer')}>
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-3 py-2.5 align-middle', c.className)}>{c.render ? c.render(r) : String(val(c, r) ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Inbox className="h-8 w-8 opacity-50" />
            <span>{emptyText ?? 'لا توجد بيانات بعد'}</span>
          </div>
        )}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between border-t px-3 py-2 text-sm text-muted-foreground no-print">
          <span>{filtered.length} سجل</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" disabled={cur === 0} onClick={() => setPage(cur - 1)}><ChevronRight className="h-4 w-4" /></Button>
            <span>{cur + 1} / {pages}</span>
            <Button variant="ghost" size="icon" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}><ChevronLeft className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
