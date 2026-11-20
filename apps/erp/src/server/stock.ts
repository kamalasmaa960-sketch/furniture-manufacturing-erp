import { zite } from 'zitejs/db';
import { fail, notify, num, today } from './core';

export interface MovementInput {
  itemId: string;
  warehouseId: string;
  type: string; // Arabic label of movement type
  qtyIn?: number;
  qtyOut?: number;
  unitCost?: number;
  reference: string;
  sourceId?: string;
  notes?: string;
  key: string; // idempotency key — the same key is never posted twice
  updateAvgCost?: boolean;
}

const BAL_SQL = `
  SELECT l."itemsId" AS "itemId", w."warehousesId" AS "warehouseId",
         COALESCE(SUM(m."qtyIn"),0) - COALESCE(SUM(m."qtyOut"),0) AS qty
  FROM "StockMovements" m
  JOIN "ItemsStockMovements" l ON l."stockMovementsId" = m.id
  JOIN "StockMovementsWarehouses" w ON w."stockMovementsId" = m.id`;

export async function balanceOf(itemId: string, warehouseId: string) {
  const r = await zite.sql({
    query: `${BAL_SQL} WHERE l."itemsId" = $1 AND w."warehousesId" = $2 GROUP BY 1,2`,
    params: [itemId, warehouseId],
  });
  return num(r.rows[0]?.qty);
}

export async function totalBalanceOf(itemId: string) {
  const r = await zite.sql({
    query: `SELECT COALESCE(SUM(m."qtyIn"),0) - COALESCE(SUM(m."qtyOut"),0) AS qty
      FROM "StockMovements" m JOIN "ItemsStockMovements" l ON l."stockMovementsId" = m.id
      WHERE l."itemsId" = $1`,
    params: [itemId],
  });
  return num(r.rows[0]?.qty);
}

/** Posts stock movements once each. Validates availability for outgoing quantities first (all-or-nothing). */
export async function postMovements(list: MovementInput[]) {
  if (list.length === 0) return 0;
  const keys = list.map((m) => m.key);
  const existing = await zite.stockMovements.findAll({
    filters: { idempotencyKey: { in: keys } },
    fields: ['idempotencyKey'],
    limit: 2000,
  });
  const done = new Set(existing.records.map((r) => r.idempotencyKey));
  const pending = list.filter((m) => !done.has(m.key));
  if (pending.length === 0) return 0;

  // Availability check aggregated per item+warehouse
  const need = new Map<string, number>();
  for (const m of pending) {
    if (num(m.qtyOut) > 0) {
      const k = `${m.itemId}|${m.warehouseId}`;
      need.set(k, (need.get(k) ?? 0) + num(m.qtyOut) - num(m.qtyIn));
    }
  }
  for (const [k, qty] of need) {
    const [itemId, whId] = k.split('|');
    const bal = await balanceOf(itemId, whId);
    if (bal + 1e-9 < qty) {
      const item = await zite.items.findOne({ id: itemId, fields: ['name'] });
      fail('BAD_REQUEST', `الكمية غير كافية للصنف "${item?.name ?? ''}" في المخزن (المتاح ${bal}، المطلوب ${qty})`);
    }
  }

  // Weighted-average cost update for receipts
  for (const m of pending) {
    if (m.updateAvgCost && num(m.qtyIn) > 0 && num(m.unitCost) > 0) {
      const item = await zite.items.findOne({ id: m.itemId, fields: ['unitCost'] });
      const oldQty = Math.max(0, await totalBalanceOf(m.itemId));
      const oldCost = num(item?.unitCost);
      const newCost = (oldQty * oldCost + num(m.qtyIn) * num(m.unitCost)) / (oldQty + num(m.qtyIn));
      await zite.items.update({ id: m.itemId, record: { unitCost: Math.round(newCost * 100) / 100 } });
    }
  }

  for (let i = 0; i < pending.length; i += 100) {
    await zite.stockMovements.bulkCreate({
      records: pending.slice(i, i + 100).map((m) => ({
        reference: m.reference,
        movementDate: today(),
        item: m.itemId,
        warehouse: m.warehouseId,
        movementType: m.type,
        qtyIn: num(m.qtyIn),
        qtyOut: num(m.qtyOut),
        unitCost: num(m.unitCost),
        sourceId: m.sourceId,
        notes: m.notes,
        idempotencyKey: m.key,
      })),
    });
  }
  await checkLowStock([...new Set(pending.map((m) => m.itemId))]);
  return pending.length;
}

export async function checkLowStock(itemIds: string[]) {
  for (const id of itemIds) {
    const item = await zite.items.findOne({ id, fields: ['name', 'minStock'] });
    if (!item || num(item.minStock) <= 0) continue;
    const bal = await totalBalanceOf(id);
    if (bal <= num(item.minStock)) {
      await notify(
        'انخفاض المخزون',
        `رصيد "${item.name}" وصل إلى ${bal} (الحد الأدنى ${item.minStock})`,
        'low_stock',
        `/items/${id}`,
      );
    }
  }
}
