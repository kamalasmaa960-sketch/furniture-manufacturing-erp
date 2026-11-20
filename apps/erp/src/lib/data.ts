import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listRecords } from 'zitejs/api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Rec = Record<string, any> & { id: string };

export function useList(entity: string, enabled = true) {
  return useQuery({
    queryKey: ['list', entity],
    queryFn: async () => (await listRecords({ entity })).records as Rec[],
    enabled,
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function useNameMap(entity: string) {
  const { data } = useList(entity);
  const m = new Map<string, string>();
  for (const r of data ?? []) m.set(r.id, r.name ?? r.label ?? '');
  return m;
}
