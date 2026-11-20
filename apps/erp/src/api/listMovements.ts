import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { getActor, num } from '../server/core';

export default createEndpoint({
  description: 'Lists stock movements with optional item, warehouse and date filters',
  inputSchema: z.object({
    itemId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  outputSchema: z.object({ movements: z.array(z.object({
    id: z.string(), reference: z.string(), date: z.string(), itemId: z.string(), itemName: z.string(),
    warehouseName: z.string(), type: z.string(), qtyIn: z.number(), qtyOut: z.number(), unitCost: z.number(),
    notes: z.string(), createdAt: z.string(),
  })) }),
  execute: async ({ input, context }) => {
    await getActor(context);
    const params: unknown[] = [];
    const where: string[] = [];
    if (input.itemId) { params.push(input.itemId); where.push(`l."itemsId" = $${params.length}`); }
    if (input.warehouseId) { params.push(input.warehouseId); where.push(`w."warehousesId" = $${params.length}`); }
    if (input.from) { params.push(input.from); where.push(`m.created_at >= $${params.length}::date`); }
    if (input.to) { params.push(input.to); where.push(`m.created_at < ($${params.length}::date + 1)`); }
    const r = await zite.sql({
      query: `SELECT m.id, m."reference", m."movementDate", m."movementType", m."qtyIn", m."qtyOut", m."unitCost", m."notes", m.created_at,
          i.id AS "itemId", i."name" AS "itemName", wh."name" AS "whName"
        FROM "StockMovements" m
        JOIN "ItemsStockMovements" l ON l."stockMovementsId" = m.id
        JOIN "Items" i ON i.id = l."itemsId"
        JOIN "StockMovementsWarehouses" w ON w."stockMovementsId" = m.id
        JOIN "Warehouses" wh ON wh.id = w."warehousesId"
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY m.created_at DESC LIMIT 1000`,
      params,
    });
    return {
      movements: r.rows.map((x) => ({
        id: String(x.id), reference: String(x.reference ?? ''), date: String(x.movementDate ?? '').slice(0, 10),
        itemId: String(x.itemId), itemName: String(x.itemName ?? ''), warehouseName: String(x.whName ?? ''),
        type: String(x.movementType ?? ''), qtyIn: num(x.qtyIn), qtyOut: num(x.qtyOut), unitCost: num(x.unitCost),
        notes: String(x.notes ?? ''), createdAt: String(x.created_at ?? ''),
      })),
    };
  },
});
