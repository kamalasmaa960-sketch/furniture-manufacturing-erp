import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { financeOverview } from 'zitejs/api';
import EntityPage from '../components/EntityPage';
import { PageHeader } from '../components/ui-kit';
import { can, useMe } from '../lib/me';
import { fmtMoney } from '../lib/format';

export default function PartiesPage({ kind }: { kind: 'customers' | 'suppliers' }) {
  const nav = useNavigate();
  const me = useMe();
  const fin = useQuery({ queryKey: ['financeOverview'], queryFn: () => financeOverview({}), enabled: can(me, 'finance') });
  const bal = new Map((fin.data?.[kind] ?? []).map((x) => [x.id, x.balance]));
  const isC = kind === 'customers';
  return (
    <div>
      <PageHeader title={isC ? 'العملاء' : 'الموردون'} subtitle="اضغط على أي سجل لعرض كشف الحساب وسجل التعاملات" />
      <EntityPage entity={kind} title={isC ? 'عميل' : 'مورد'} exportName={isC ? 'العملاء' : 'الموردون'} onRowClick={(r) => nav(`/${kind}/${r.id}`)}
        fields={[
          { key: 'name', label: 'الاسم', type: 'text', required: true }, { key: 'phone', label: 'رقم الهاتف', type: 'text' },
          { key: 'email', label: 'البريد الإلكتروني', type: 'text' }, { key: 'taxNumber', label: 'الرقم الضريبي', type: 'text' },
          { key: 'address', label: 'العنوان', type: 'text', full: true }, { key: 'openingBalance', label: isC ? 'رصيد افتتاحي مستحق لنا' : 'رصيد افتتاحي مستحق له', type: 'money' },
          { key: 'notes', label: 'ملاحظات', type: 'textarea' },
        ]}
        columns={[
          { key: 'name', label: 'الاسم', className: 'font-medium' }, { key: 'phone', label: 'الهاتف' }, { key: 'address', label: 'العنوان' },
          ...(can(me, 'finance') ? [{ key: 'balance', label: 'الرصيد المستحق', value: (r: { id: string }) => bal.get(r.id) ?? 0, render: (r: { id: string }) => <span className="num">{fmtMoney(bal.get(r.id) ?? 0)}</span> }] : []),
        ]} />
    </div>
  );
}
