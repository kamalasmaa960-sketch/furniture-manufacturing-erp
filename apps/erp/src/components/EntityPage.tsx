import { useState, type ReactNode } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteRecord } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import DataTable, { type Column } from './DataTable';
import EntityForm, { type FieldDef } from './EntityForm';
import { Confirm } from './ui-kit';
import { useInvalidate, useList, type Rec } from '../lib/data';

export default function EntityPage({ entity, title, fields, columns, filter, onRowClick, extraActions, canEdit = true, exportName }: {
  entity: string; title: string; fields: FieldDef[]; columns: Column<Rec>[]; filter?: (r: Rec) => boolean;
  onRowClick?: (r: Rec) => void; extraActions?: ReactNode; canEdit?: boolean; exportName?: string;
}) {
  const { data, isLoading } = useList(entity);
  const [editing, setEditing] = useState<Rec | null>(null);
  const [open, setOpen] = useState(false);
  const invalidate = useInvalidate();
  const rows = (data ?? []).filter((r) => (filter ? filter(r) : true));

  const actionCol: Column<Rec> = {
    key: '_actions', label: '', value: () => '', className: 'w-24 no-print',
    render: (r) => (
      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
        <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }} aria-label="تعديل"><Pencil className="h-4 w-4" /></Button>
        <Confirm
          destructive title="تأكيد الحذف" description="سيتم حذف السجل نهائياً. لا يمكن التراجع عن هذه العملية."
          trigger={<Button size="icon" variant="ghost" aria-label="حذف"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
          onConfirm={async () => { await deleteRecord({ entity, id: r.id }); toast.success('تم الحذف'); invalidate(); }}
        />
      </div>
    ),
  };

  return (
    <>
      <DataTable
        rows={rows} loading={isLoading} columns={canEdit ? [...columns, actionCol] : columns} onRowClick={onRowClick} exportName={exportName ?? title}
        toolbar={<>{extraActions}{canEdit && <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="ml-1 h-4 w-4" /> إضافة {title}</Button>}</>}
      />
      <EntityForm entity={entity} title={title} fields={fields} record={editing} open={open} onOpenChange={setOpen} />
    </>
  );
}
