import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, first, notify, num, requireAccess } from '../server/core';
import { DOC_META, type DocType } from '../server/docs';
import { postMovements } from '../server/stock';

export default createEndpoint({
  description: 'Posts an invoice or return: moves stock and makes it count in customer/supplier balances (once only)',
  inputSchema: z.object({ id: z.string().uuid() }),
  outputSchema: z.object({ posted: z.number() }),
  execute: async ({ input, context }) => {
    const doc = await zite.documents.findOne({ id: input.id });
    if (!doc) fail('NOT_FOUND', 'المستند غير موجود');
    const type = doc.docType as DocType;
    const meta = DOC_META[type];
    const actor = await requireAccess(context, meta.module);
    if (!meta.stock) fail('BAD_REQUEST', 'هذا النوع من المستندات لا يُرحّل. حوّله إلى فاتورة أولاً.');
    if (doc.stockPosted) fail('CONFLICT', 'تم ترحيل هذا المستند مسبقاً');
    if (doc.status === 'ملغي') fail('CONFLICT', 'المستند ملغي');
    const wh = first(doc.warehouse);
    if (!wh) fail('BAD_REQUEST', 'حدد المخزن');

    const lines = await zite.documentLines.findAll({ filters: { document: input.id }, limit: 500 });
    if (lines.records.length === 0) fail('BAD_REQUEST', 'لا توجد أصناف في المستند');
    const items = await zite.items.findAll({
      filters: { id: { in: lines.records.map((l) => first(l.item)!).filter(Boolean) } }, fields: ['unitCost'], limit: 500,
    });
    const cost = new Map(items.records.map((i) => [i.id, num(i.unitCost)]));

    // Proportional header discount applied to purchase cost
    const ratio = num(doc.subtotal) > 0 ? (num(doc.subtotal) - num(doc.discount)) / num(doc.subtotal) : 1;
    const posted = await postMovements(lines.records.map((l) => {
      const itemId = first(l.item)!;
      const qty = num(l.quantity);
      const purchaseCost = qty > 0 ? (num(l.lineTotal) / qty) * ratio : 0;
      return {
        itemId, warehouseId: wh!, type: meta.stock!.type, reference: doc.number ?? '', sourceId: doc.id,
        qtyIn: meta.stock!.dir === 'in' ? qty : 0, qtyOut: meta.stock!.dir === 'out' ? qty : 0,
        unitCost: type === 'purchase_invoice' ? purchaseCost : cost.get(itemId) ?? 0,
        key: `doc:${doc.id}:${l.id}`, updateAvgCost: type === 'purchase_invoice',
      };
    }));

    const delivery = type === 'purchase_invoice' ? 'تم الاستلام' : type === 'sales_invoice' ? 'تم الصرف من المخزن' : 'تم الاستلام';
    await zite.documents.update({ id: doc.id, record: { stockPosted: true, status: num(doc.paid) >= num(doc.total) ? 'مسددة' : 'مُرحّلة', deliveryStatus: doc.deliveryStatus || delivery } });
    await audit(actor.userId, 'ترحيل', meta.label, doc.id, `ترحيل ${meta.label} ${doc.number} بقيمة ${doc.total}`, undefined, { posted });
    if (type === 'purchase_invoice') await notify('استلام مشتريات', `تم استلام ${doc.number} وإضافته للمخزون`, 'purchase', `/purchases/${doc.id}`);
    if (type === 'sales_return' || type === 'purchase_return') await notify('تسجيل مرتجع', `تم ترحيل ${meta.label} ${doc.number}`, 'return', '');
    return { posted };
  },
});
