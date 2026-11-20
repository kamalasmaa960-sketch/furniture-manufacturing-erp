import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { num, requireAccess } from '../server/core';

export default createEndpoint({
  description: 'Lists production orders with product names and progress',
  inputSchema: z.object({}),
  outputSchema: z.object({ orders: z.array(z.object({
    id: z.string(), number: z.string(), productName: z.string(), quantity: z.number(), status: z.string(),
    currentStage: z.string(), startDate: z.string(), dueDate: z.string(), completedQty: z.number(),
    rejectedQty: z.number(), wasteQty: z.number(), totalCost: z.number(), unitCost: z.number(),
  })) }),
  execute: async ({ context }) => {
    await requireAccess(context, 'production');
    const r = await zite.sql({
      query: `SELECT o.id, o."number", o."quantity", o."status", o."currentStage", o."startDate", o."dueDate",
          o."completedQty", o."rejectedQty", o."wasteQty", o."totalCost", o."unitCost", i."name" AS "productName"
        FROM "ProductionOrders" o
        LEFT JOIN "ItemsProductionOrders" l ON l."productionOrdersId" = o.id
        LEFT JOIN "Items" i ON i.id = l."itemsId"
        ORDER BY o.created_at DESC LIMIT 1000`,
    });
    return {
      orders: r.rows.map((x) => ({
        id: String(x.id), number: String(x.number ?? ''), productName: String(x.productName ?? ''), quantity: num(x.quantity),
        status: String(x.status ?? ''), currentStage: String(x.currentStage ?? ''), startDate: String(x.startDate ?? '').slice(0, 10),
        dueDate: String(x.dueDate ?? '').slice(0, 10), completedQty: num(x.completedQty), rejectedQty: num(x.rejectedQty),
        wasteQty: num(x.wasteQty), totalCost: num(x.totalCost), unitCost: num(x.unitCost),
      })),
    };
  },
});
