import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, first, makeNumber, requireAccess, round2 } from '../server/core';
import { DOC_META, DOC_TYPES } from '../server/docs';

export default createEndpoint({
  description: 'Creates or updates a draft purchase/sales document with its lines; totals are computed on the server',
  inputSchema: z.object({
    id: z.string().uuid().optional(),
    requestId: z.string().min(8).max(80),
    docType: z.enum(DOC_TYPES),
    docDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
    customerId: z.string().uuid().optional(),
    supplierId: z.string().uuid().optional(),
    warehouseId: z.string().uuid(),
    discount: z.number().min(0).default(0),
    taxPercent: z.number().min(0).max(100).default(0),
    deliveryStatus: z.string().max(50).optional(),
    notes: z.string().max(3000).optional(),
    lines: z.array(z.object({
      itemId: z.string().uuid(),
      quantity: z.number().positive().max(1e9),
      unitPrice: z.number().min(0).max(1e10),
      lineDiscount: z.number().min(0).default(0),
    })).min(1).max(200),
  }),
  outputSchema: z.object({ id: z.string(), number: z.string() }),
  execute: async ({ input, context }) => {
    const meta = DOC_META[input.docType];
    const actor = await requireAccess(context, meta.module);
    if (meta.party === 'customer' && !input.customerId) fail('BAD_REQUEST', 'اختر العميل');
    if (meta.party === 'supplier' && !input.supplierId) fail('BAD_REQUEST', 'اختر المورد');

    const items = await zite.items.findAll({ filters: { id: { in: input.lines.map((l) => l.itemId) } }, fields: ['name'], limit: 500 });
    const names = new Map(items.records.map((i) => [i.id, i.name ?? '']));
    const lines = input.lines.map((l) => {
      if (!names.has(l.itemId)) fail('NOT_FOUND', 'صنف غير موجود في السطور');
      const lineTotal = round2(l.quantity * l.unitPrice - (l.lineDiscount ?? 0));
      if (lineTotal < 0) fail('BAD_REQUEST', 'خصم السطر أكبر من قيمته');
      return { ...l, lineTotal };
    });
    const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
    if (input.discount > subtotal) fail('BAD_REQUEST', 'الخصم أكبر من إجمالي الفاتورة');
    const total = round2((subtotal - input.discount) * (1 + input.taxPercent / 100));

    const header = {
      docType: input.docType, docDate: input.docDate, dueDate: input.dueDate,
      customer: meta.party === 'customer' ? input.customerId : undefined,
      supplier: meta.party === 'supplier' ? input.supplierId : undefined,
      warehouse: input.warehouseId, discount: input.discount, taxPercent: input.taxPercent,
      subtotal, total, notes: input.notes, deliveryStatus: input.deliveryStatus,
    };

    let docId: string;
    let number: string;
    if (input.id) {
      const doc = await zite.documents.findOne({ id: input.id });
      if (!doc) fail('NOT_FOUND', 'المستند غير موجود');
      if (doc.stockPosted) fail('CONFLICT', 'لا يمكن تعديل مستند تم ترحيله. استخدم المرتجع.');
      if ((doc.paid ?? 0) > total) fail('CONFLICT', 'الإجمالي الجديد أقل من المبلغ المدفوع');
      await zite.documents.update({ id: input.id, record: header });
      const old = await zite.documentLines.findAll({ filters: { document: input.id }, fields: ['label'], limit: 500 });
      for (const l of old.records) await zite.documentLines.delete({ id: l.id });
      docId = input.id;
      number = doc.number ?? '';
      await audit(actor.userId, 'تعديل', meta.label, docId, `تعديل ${meta.label} ${number}`, doc, header);
    } else {
      const dup = await zite.documents.findOne({ filters: { idempotencyKey: input.requestId } });
      if (dup) return { id: dup.id, number: dup.number ?? '' };
      number = makeNumber(meta.prefix);
      const created = await zite.documents.create({
        record: { ...header, number, status: 'مسودة', paid: 0, stockPosted: false, idempotencyKey: input.requestId },
      });
      docId = created.id;
      await audit(actor.userId, 'إضافة', meta.label, docId, `إنشاء ${meta.label} ${number}`, undefined, header);
    }
    await zite.documentLines.bulkCreate({
      records: lines.map((l) => ({
        label: names.get(l.itemId), document: docId, item: l.itemId, quantity: l.quantity,
        unitPrice: l.unitPrice, lineDiscount: l.lineDiscount, lineTotal: l.lineTotal,
      })),
    });
    void first;
    return { id: docId, number };
  },
});
