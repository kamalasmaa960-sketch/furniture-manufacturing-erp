import { zite } from 'zitejs/db';
import { num } from './core';

export const range = (from?: string, to?: string) => ({
  from: from || '2000-01-01',
  to: to || '2100-01-01',
});

export async function pnl(from: string, to: string) {
  const p = [from, to];
  const [docs, cogs, tx] = await Promise.all([
    zite.sql({
      query: `SELECT d."docType" AS t, COALESCE(SUM(d."total"),0) AS total,
          COALESCE(SUM(d."total" / (1 + COALESCE(d."taxPercent",0)/100)),0) AS net
        FROM "Documents" d WHERE d."stockPosted" = true AND d."docDate" >= $1::date AND d."docDate" <= $2::date GROUP BY 1`,
      params: p,
    }),
    zite.sql({
      query: `SELECT COALESCE(SUM(CASE WHEN m."movementType"='بيع' THEN m."qtyOut"*m."unitCost" WHEN m."movementType"='مرتجع مبيعات' THEN -m."qtyIn"*m."unitCost" ELSE 0 END),0) AS cogs,
          COALESCE(SUM(CASE WHEN m."movementType" IN ('هالك وتالف','تسوية جرد - عجز') THEN m."qtyOut"*m."unitCost" WHEN m."movementType"='تسوية جرد - زيادة' THEN -m."qtyIn"*m."unitCost" ELSE 0 END),0) AS losses
        FROM "StockMovements" m WHERE m."movementDate" >= $1::date AND m."movementDate" <= $2::date`,
      params: p,
    }),
    zite.sql({
      query: `SELECT COALESCE(SUM(t."amount") FILTER (WHERE t."direction"='out' AND t."category" LIKE 'مصروف%'),0) AS expenses,
          COALESCE(SUM(t."amount") FILTER (WHERE t."category" = 'رواتب'),0) AS salaries,
          COALESCE(SUM(t."amount") FILTER (WHERE t."direction"='in' AND t."category" LIKE 'إيراد آخر%'),0) AS "otherRevenue",
          COALESCE(SUM(t."amount") FILTER (WHERE t."direction"='in' AND t."category" <> 'تحويل بين الحسابات'),0) AS "cashIn",
          COALESCE(SUM(t."amount") FILTER (WHERE t."direction"='out' AND t."category" <> 'تحويل بين الحسابات'),0) AS "cashOut"
        FROM "Transactions" t WHERE t."txDate" >= $1::date AND t."txDate" <= $2::date`,
      params: p,
    }),
  ]);
  const by = (t: string, k: 'total' | 'net') => num(docs.rows.find((r) => r.t === t)?.[k]);
  const salesNet = by('sales_invoice', 'net') - by('sales_return', 'net');
  const purchases = by('purchase_invoice', 'total') - by('purchase_return', 'total');
  const sales = by('sales_invoice', 'total') - by('sales_return', 'total');
  const c = num(cogs.rows[0]?.cogs);
  const losses = num(cogs.rows[0]?.losses);
  const x = tx.rows[0] ?? {};
  const expenses = num(x.expenses), salaries = num(x.salaries), otherRevenue = num(x.otherRevenue);
  const grossProfit = salesNet - c;
  const netProfit = grossProfit - expenses - salaries - losses + otherRevenue;
  return { sales, salesNet, purchases, cogs: c, losses, expenses, salaries, otherRevenue, grossProfit, netProfit, cashIn: num(x.cashIn), cashOut: num(x.cashOut) };
}

export async function inventoryValue() {
  const r = await zite.sql({
    query: `SELECT i.id, i."name", i."code", i."itemType", i."unit", i."category", COALESCE(i."unitCost",0) AS cost, COALESCE(i."salePrice",0) AS price, COALESCE(i."minStock",0) AS "minStock",
        COALESCE(SUM(m."qtyIn"),0) - COALESCE(SUM(m."qtyOut"),0) AS qty
      FROM "Items" i
      LEFT JOIN "ItemsStockMovements" l ON l."itemsId" = i.id
      LEFT JOIN "StockMovements" m ON m.id = l."stockMovementsId"
      GROUP BY i.id ORDER BY i."name"`,
  });
  return r.rows.map((x) => ({
    id: String(x.id), name: String(x.name ?? ''), code: String(x.code ?? ''), itemType: String(x.itemType ?? ''), unit: String(x.unit ?? ''),
    category: String(x.category ?? ''), cost: num(x.cost), price: num(x.price), minStock: num(x.minStock), qty: num(x.qty), value: num(x.qty) * num(x.cost),
  }));
}
