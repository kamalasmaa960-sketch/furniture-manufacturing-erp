import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, first, makeNumber, num, requireAccess, today } from '../server/core';
import { CONVERSIONS, DOC_META, DOC_TYPES, type DocType } from '../server/docs';

export default createEndpoint({
  description: 'Converts a document (quote → order → invoice, invoice → return) into a new draft',
  inputSchema: z.object({ id: z.string().uuid(), to: z.enum(DOC_TYPES), requestId: z.string().min(8).max(80) }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input, context }) => {
    const src = await zite.documents.findOne({ id: input.id });
    if (!src) fail('NOT_FOUND', 'المستند غير موجود');
    const from = src.docType as DocType;
    if (!CONVERSIONS[from]?.includes(input.to)) fail('BAD_REQUEST', 'تحويل غير مسموح');
    const meta = DOC_META[input.to];
    const actor = await requireAccess(context, meta.module);
    if ((input.to === 'sales_return' || input.to === 'purchase_return') && !src.stockPosted) fail('BAD_REQUEST', 'يجب ترحيل الفاتورة قبل عمل مرتجع لها');
    const dup = await zite.documents.findOne({ filters: { idempotencyKey: input.requestId } });
    if (dup) return { id: dup.id };

    const lines = await zite.documentLines.findAll({ filters: { document: src.id }, limit: 500 });
    const number = makeNumber(meta.prefix);
    const created = await zite.documents.create({
      record: {
        number, docType: input.to, docDate: today(), customer: first(src.customer), supplier: first(src.supplier),
        warehouse: first(src.warehouse), status: 'مسودة', subtotal: num(src.subtotal), discount: num(src.discount),
        taxPercent: num(src.taxPercent), total: num(src.total), paid: 0, stockPosted: false,
        sourceNumber: src.number, idempotencyKey: input.requestId, notes: src.notes,
      },
    });
    await zite.documentLines.bulkCreate({
      records: lines.records.map((l) => ({
        label: l.label, document: created.id, item: first(l.item), quantity: l.quantity,
        unitPrice: l.unitPrice, lineDiscount: l.lineDiscount, lineTotal: l.lineTotal,
      })),
    });
    if (!input.to.endsWith('return')) await zite.documents.update({ id: src.id, record: { status: 'محوّل' } });
    await audit(actor.userId, 'تحويل', meta.label, created.id, `تحويل ${src.number} إلى ${meta.label} ${number}`);
    return { id: created.id };
  },
});
