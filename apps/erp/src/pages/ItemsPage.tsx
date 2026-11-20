import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { stockOverview } from 'zitejs/api';
import EntityPage from '../components/EntityPage';
import type { FieldDef } from '../components/EntityForm';
import { PageHeader } from '../components/ui-kit';
import { fmtMoney, fmtNum } from '../lib/format';
import type { Rec } from '../lib/data';

export const itemFields = (type: 'product' | 'material'): FieldDef[] => [
  { key: 'name', label: 'الاسم', type: 'text', required: true },
  { key: 'code', label: 'الكود', type: 'text', required: true },
  { key: 'itemType', label: 'النوع', type: 'select', required: true, defaultValue: type, options: [{ value: 'product', label: 'منتج نهائي' }, { value: 'material', label: 'مادة خام' }] },
  { key: 'category', label: type === 'product' ? 'التصنيف (وسائد، مفروشات، خشبيات...)' : 'التصنيف (أقمشة، خيوط، إسفنج، أخشاب، تغليف...)', type: 'text' },
  { key: 'productGroup', label: 'المجموعة / الموديل الأساسي (لربط المقاسات والألوان)', type: 'text' },
  { key: 'unit', label: 'وحدة القياس', type: 'text', required: true, defaultValue: type === 'product' ? 'قطعة' : 'متر' },
  { key: 'size', label: 'المقاس', type: 'text' },
  { key: 'color', label: 'اللون', type: 'text' },
  { key: 'material', label: 'الخامة', type: 'text' },
  { key: 'salePrice', label: 'سعر البيع (ج.م)', type: 'money' },
  { key: 'unitCost', label: type === 'product' ? 'تكلفة الوحدة (تتحدث تلقائياً من الإنتاج)' : 'سعر الشراء (يتحدث بالمتوسط المرجح)', type: 'money' },
  { key: 'minStock', label: 'الحد الأدنى للمخزون', type: 'number' },
  { key: 'supplier', label: 'المورد الأساسي', type: 'ref', ref: 'suppliers' },
  { key: 'active', label: 'نشط', type: 'checkbox', defaultValue: true },
  { key: 'description', label: 'الوصف', type: 'textarea' },
];

export default function ItemsPage({ type }: { type: 'product' | 'material' }) {
  const nav = useNavigate();
  const { data: stock } = useQuery({ queryKey: ['stockOverview'], queryFn: () => stockOverview({}) });
  const qty = new Map((stock?.totals ?? []).map((t) => [t.itemId, t]));
  const title = type === 'product' ? 'المنتجات' : 'المواد الخام';
  return (
    <div>
      <PageHeader title={title} subtitle={type === 'product' ? 'المنتجات النهائية بمقاساتها وألوانها ومكوناتها' : 'الأقمشة والخيوط والإسفنج والإكسسوارات والأخشاب ومواد التغليف'} />
      <EntityPage
        entity="items" title={type === 'product' ? 'منتج' : 'خامة'} exportName={title}
        fields={itemFields(type)} filter={(r) => r.itemType === type} onRowClick={(r) => nav(`/items/${r.id}`)}
        columns={[
          { key: 'image', label: '', value: () => '', className: 'w-12', render: (r: Rec) => r.image?.[0]?.url ? <img src={r.image[0].url} alt="" className="h-9 w-9 rounded object-cover" /> : <div className="h-9 w-9 rounded bg-muted" /> },
          { key: 'code', label: 'الكود', className: 'font-mono text-xs' },
          { key: 'name', label: 'الاسم', className: 'font-medium' },
          { key: 'category', label: 'التصنيف' },
          { key: 'variant', label: 'المقاس / اللون', value: (r) => [r.size, r.color].filter(Boolean).join(' · ') },
          { key: 'qty', label: 'الرصيد', value: (r) => qty.get(r.id)?.qty ?? 0, render: (r) => {
            const q = qty.get(r.id)?.qty ?? 0;
            return <span className={`num ${r.minStock && q <= r.minStock ? 'font-semibold text-destructive' : ''}`}>{fmtNum(q)} {r.unit}</span>;
          } },
          ...(type === 'product'
            ? [{ key: 'sold', label: 'المباع', value: (r: Rec) => qty.get(r.id)?.sold ?? 0, render: (r: Rec) => <span className="num">{fmtNum(qty.get(r.id)?.sold ?? 0)}</span> },
               { key: 'salePrice', label: 'سعر البيع', value: (r: Rec) => r.salePrice ?? 0, render: (r: Rec) => <span className="num">{fmtMoney(r.salePrice)}</span> }]
            : [{ key: 'consumed', label: 'المستهلك', value: (r: Rec) => qty.get(r.id)?.consumed ?? 0, render: (r: Rec) => <span className="num">{fmtNum(qty.get(r.id)?.consumed ?? 0)}</span> }]),
          { key: 'unitCost', label: 'التكلفة', value: (r) => r.unitCost ?? 0, render: (r) => <span className="num">{fmtMoney(r.unitCost)}</span> },
        ]}
      />
    </div>
  );
}
