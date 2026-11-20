import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { getActor, num } from '../server/core';
import { customerBalances, supplierBalances } from '../server/finance';
import { inventoryValue, pnl, range } from '../server/analytics';

const kv = z.object({ label: z.string(), value: z.number() });

export default createEndpoint({
  description: 'Dashboard KPIs, charts, alerts and recent activity for a date range',
  inputSchema: z.object({ from: z.string().optional(), to: z.string().optional() }),
  outputSchema: z.object({
    kpis: z.record(z.string(), z.number()),
    salesByDay: z.array(z.object({ date: z.string(), sales: z.number(), purchases: z.number() })),
    productionStatus: z.array(kv),
    expenseBreakdown: z.array(kv),
    lowStock: z.array(z.object({ id: z.string(), name: z.string(), qty: z.number(), minStock: z.number(), unit: z.string() })),
    recent: z.array(z.object({ action: z.string(), module: z.string(), description: z.string(), actorName: z.string(), createdAt: z.string() })),
  }),
  execute: async ({ input, context }) => {
    await getActor(context);
    const { from, to } = range(input.from, input.to);
    const [p, inv, cust, supp, counts, byDay, prod, exp, recent] = await Promise.all([
      pnl(from, to), inventoryValue(), customerBalances(), supplierBalances(),
      zite.sql({ query: `SELECT
          (SELECT COUNT(*) FROM "Items" WHERE "itemType"='product') AS products,
          (SELECT COUNT(*) FROM "Items" WHERE "itemType"='material') AS materials,
          (SELECT COUNT(*) FROM "ProductionOrders" WHERE "status" NOT IN ('مكتمل','ملغي')) AS "openProduction",
          (SELECT COUNT(*) FROM "ProductionOrders") AS "allProduction",
          (SELECT COUNT(*) FROM "Documents" WHERE "docType"='sales_order' AND "status"='مسودة') AS "newOrders",
          (SELECT COUNT(*) FROM "Documents" WHERE "docType" IN ('sales_invoice','purchase_invoice') AND "stockPosted"=true AND COALESCE("paid",0) < "total" - 0.01) AS "unpaidInvoices",
          (SELECT COALESCE(SUM("total"-COALESCE("paid",0)),0) FROM "Documents" WHERE "docType"='sales_invoice' AND "stockPosted"=true) AS "unpaidSalesAmount",
          (SELECT COUNT(*) FROM "Documents" WHERE "docType"='sales_invoice' AND "stockPosted"=true AND COALESCE("paid",0) < "total" - 0.01 AND "dueDate" < CURRENT_DATE) AS "overdueInvoices"` }),
      zite.sql({ query: `SELECT to_char("docDate",'YYYY-MM-DD') AS date,
          COALESCE(SUM(CASE WHEN "docType"='sales_invoice' THEN "total" WHEN "docType"='sales_return' THEN -"total" ELSE 0 END),0) AS sales,
          COALESCE(SUM(CASE WHEN "docType"='purchase_invoice' THEN "total" WHEN "docType"='purchase_return' THEN -"total" ELSE 0 END),0) AS purchases
        FROM "Documents" WHERE "stockPosted"=true AND "docDate" >= $1::date AND "docDate" <= $2::date GROUP BY 1 ORDER BY 1`, params: [from, to] }),
      zite.sql({ query: `SELECT COALESCE("status",'غير محدد') AS label, COUNT(*) AS value FROM "ProductionOrders" GROUP BY 1` }),
      zite.sql({ query: `SELECT "category" AS label, SUM("amount") AS value FROM "Transactions" WHERE "direction"='out' AND "category" <> 'تحويل بين الحسابات' AND "txDate" >= $1::date AND "txDate" <= $2::date GROUP BY 1 ORDER BY 2 DESC LIMIT 8`, params: [from, to] }),
      zite.sql({ query: `SELECT a."action", a."module", a."description", a.created_at, u."name" AS "actorName" FROM "AuditLogs" a LEFT JOIN "ziteUsers" u ON u.id = a."actor"->>0 ORDER BY a.created_at DESC LIMIT 12` }),
    ]);
    const c = counts.rows[0] ?? {};
    const receivables = cust.reduce((s, x) => s + Math.max(0, x.balance), 0);
    const payables = supp.reduce((s, x) => s + Math.max(0, x.balance), 0);
    return {
      kpis: {
        ...p,
        inventoryValue: inv.reduce((s, i) => s + Math.max(0, i.value), 0),
        products: num(c.products), materials: num(c.materials), openProduction: num(c.openProduction), allProduction: num(c.allProduction),
        newOrders: num(c.newOrders), unpaidInvoices: num(c.unpaidInvoices), unpaidSalesAmount: num(c.unpaidSalesAmount),
        overdueInvoices: num(c.overdueInvoices), receivables, payables,
      },
      salesByDay: byDay.rows.map((r) => ({ date: String(r.date), sales: num(r.sales), purchases: num(r.purchases) })),
      productionStatus: prod.rows.map((r) => ({ label: String(r.label), value: num(r.value) })),
      expenseBreakdown: exp.rows.map((r) => ({ label: String(r.label ?? ''), value: num(r.value) })),
      lowStock: inv.filter((i) => i.minStock > 0 && i.qty <= i.minStock).slice(0, 15).map((i) => ({ id: i.id, name: i.name, qty: i.qty, minStock: i.minStock, unit: i.unit })),
      recent: recent.rows.map((r) => ({ action: String(r.action ?? ''), module: String(r.module ?? ''), description: String(r.description ?? ''), actorName: String(r.actorName ?? ''), createdAt: String(r.created_at ?? '') })),
    };
  },
});
