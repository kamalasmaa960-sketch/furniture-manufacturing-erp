import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { num, requireAccess } from '../server/core';

export default createEndpoint({
  description: 'Lists purchase or sales documents with party names and remaining balances',
  inputSchema: z.object({
    group: z.enum(['purchases', 'sales']),
    partyId: z.string().uuid().optional(),
  }),
  outputSchema: z.object({ documents: z.array(z.object({
    id: z.string(), number: z.string(), docType: z.string(), docDate: z.string(), dueDate: z.string(),
    partyId: z.string(), partyName: z.string(), status: z.string(), deliveryStatus: z.string(),
    total: z.number(), paid: z.number(), stockPosted: z.boolean(), sourceNumber: z.string(),
  })) }),
  execute: async ({ input, context }) => {
    await requireAccess(context, input.group);
    const types = input.group === 'sales' ? ['quote', 'sales_order', 'sales_invoice', 'sales_return'] : ['purchase_order', 'purchase_invoice', 'purchase_return'];
    const params: unknown[] = [types];
    let partyFilter = '';
    if (input.partyId) { params.push(input.partyId); partyFilter = `AND COALESCE(c.id, s.id) = $2`; }
    const r = await zite.sql({
      query: `SELECT d.id, d."number", d."docType", d."docDate", d."dueDate", d."status", d."deliveryStatus",
          d."total", d."paid", d."stockPosted", d."sourceNumber",
          COALESCE(c.id, s.id) AS "partyId", COALESCE(c."name", s."name") AS "partyName"
        FROM "Documents" d
        LEFT JOIN "CustomersDocuments" cl ON cl."documentsId" = d.id
        LEFT JOIN "Customers" c ON c.id = cl."customersId"
        LEFT JOIN "DocumentsSuppliers" sl ON sl."documentsId" = d.id
        LEFT JOIN "Suppliers" s ON s.id = sl."suppliersId"
        WHERE d."docType" = ANY($1) ${partyFilter}
        ORDER BY d.created_at DESC LIMIT 1500`,
      params,
    });
    return {
      documents: r.rows.map((x) => ({
        id: String(x.id), number: String(x.number ?? ''), docType: String(x.docType ?? ''),
        docDate: String(x.docDate ?? '').slice(0, 10), dueDate: x.dueDate ? String(x.dueDate).slice(0, 10) : '',
        partyId: String(x.partyId ?? ''), partyName: String(x.partyName ?? ''), status: String(x.status ?? ''),
        deliveryStatus: String(x.deliveryStatus ?? ''), total: num(x.total), paid: num(x.paid),
        stockPosted: x.stockPosted === true, sourceNumber: String(x.sourceNumber ?? ''),
      })),
    };
  },
});
