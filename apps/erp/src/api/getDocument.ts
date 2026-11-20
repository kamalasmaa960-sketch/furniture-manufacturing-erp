import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { fail, first, num, requireAccess } from '../server/core';
import { DOC_META, type DocType } from '../server/docs';

export default createEndpoint({
  description: 'Returns one document with its lines and payments',
  inputSchema: z.object({ id: z.string().uuid() }),
  outputSchema: z.object({
    doc: z.record(z.string(), z.any()),
    lines: z.array(z.object({ id: z.string(), itemId: z.string(), itemName: z.string(), quantity: z.number(), unitPrice: z.number(), lineDiscount: z.number(), lineTotal: z.number() })),
    payments: z.array(z.object({ id: z.string(), date: z.string(), amount: z.number(), direction: z.string(), reference: z.string() })),
  }),
  execute: async ({ input, context }) => {
    const doc = await zite.documents.findOne({ id: input.id });
    if (!doc) fail('NOT_FOUND', 'المستند غير موجود');
    const meta = DOC_META[doc.docType as DocType];
    await requireAccess(context, meta?.module ?? 'sales');
    const [lines, pays] = await Promise.all([
      zite.documentLines.findAll({ filters: { document: input.id }, limit: 500 }),
      zite.transactions.findAll({ filters: { document: input.id }, limit: 500 }),
    ]);
    return {
      doc: {
        ...doc,
        customerId: first(doc.customer) ?? '', supplierId: first(doc.supplier) ?? '', warehouseId: first(doc.warehouse) ?? '',
      },
      lines: lines.records.map((l) => ({
        id: l.id, itemId: first(l.item) ?? '', itemName: l.label ?? '', quantity: num(l.quantity),
        unitPrice: num(l.unitPrice), lineDiscount: num(l.lineDiscount), lineTotal: num(l.lineTotal),
      })),
      payments: pays.records.map((p) => ({
        id: p.id, date: (p.txDate ?? '').slice(0, 10), amount: num(p.amount), direction: String(p.direction ?? ''), reference: p.reference ?? '',
      })),
    };
  },
});
