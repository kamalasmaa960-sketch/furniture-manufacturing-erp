import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { getActor, num } from '../server/core';

export default createEndpoint({
  description: 'Stock balance of every item per warehouse with valuation and low-stock flags',
  inputSchema: z.object({}),
  outputSchema: z.object({
    balances: z.array(z.object({ itemId: z.string(), warehouseId: z.string(), qty: z.number() })),
    totals: z.array(z.object({ itemId: z.string(), qty: z.number(), sold: z.number(), produced: z.number(), consumed: z.number() })),
  }),
  execute: async ({ context }) => {
    await getActor(context);
    const b = await zite.sql({
      query: `SELECT l."itemsId" AS "itemId", w."warehousesId" AS "warehouseId",
        COALESCE(SUM(m."qtyIn"),0) - COALESCE(SUM(m."qtyOut"),0) AS qty
        FROM "StockMovements" m
        JOIN "ItemsStockMovements" l ON l."stockMovementsId" = m.id
        JOIN "StockMovementsWarehouses" w ON w."stockMovementsId" = m.id
        GROUP BY 1,2`,
    });
    const t = await zite.sql({
      query: `SELECT l."itemsId" AS "itemId",
        COALESCE(SUM(m."qtyIn"),0) - COALESCE(SUM(m."qtyOut"),0) AS qty,
        COALESCE(SUM(m."qtyOut") FILTER (WHERE m."movementType" = 'بيع'),0) - COALESCE(SUM(m."qtyIn") FILTER (WHERE m."movementType" = 'مرتجع مبيعات'),0) AS sold,
        COALESCE(SUM(m."qtyIn") FILTER (WHERE m."movementType" = 'إنتاج تام'),0) AS produced,
        COALESCE(SUM(m."qtyOut") FILTER (WHERE m."movementType" = 'صرف للإنتاج'),0) AS consumed
        FROM "StockMovements" m JOIN "ItemsStockMovements" l ON l."stockMovementsId" = m.id
        GROUP BY 1`,
    });
    return {
      balances: b.rows.map((r) => ({ itemId: String(r.itemId), warehouseId: String(r.warehouseId), qty: num(r.qty) })),
      totals: t.rows.map((r) => ({
        itemId: String(r.itemId), qty: num(r.qty), sold: num(r.sold), produced: num(r.produced), consumed: num(r.consumed),
      })),
    };
  },
});
