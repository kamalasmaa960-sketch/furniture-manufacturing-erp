import { zite } from 'zitejs/db';
import { num } from './core';

export async function accountBalances() {
  const r = await zite.sql({
    query: `SELECT a.id, a."name", a."accountType", a."accountNumber", COALESCE(a."openingBalance",0) AS opening,
        COALESCE(SUM(CASE WHEN t."direction" = 'in' THEN t."amount" ELSE 0 END),0) AS "totalIn",
        COALESCE(SUM(CASE WHEN t."direction" = 'out' THEN t."amount" ELSE 0 END),0) AS "totalOut"
      FROM "FinanceAccounts" a
      LEFT JOIN "FinanceAccountsTransactions" l ON l."financeAccountsId" = a.id
      LEFT JOIN "Transactions" t ON t.id = l."transactionsId"
      GROUP BY a.id ORDER BY a."name"`,
  });
  return r.rows.map((x) => ({
    id: String(x.id), name: String(x.name ?? ''), accountType: String(x.accountType ?? ''), accountNumber: String(x.accountNumber ?? ''),
    opening: num(x.opening), totalIn: num(x.totalIn), totalOut: num(x.totalOut),
    balance: num(x.opening) + num(x.totalIn) - num(x.totalOut),
  }));
}

/** Customer receivables: opening + posted invoices − posted returns − receipts + refunds */
export async function customerBalances(customerId?: string) {
  const r = await zite.sql({
    query: `SELECT c.id, c."name", c."phone", COALESCE(c."openingBalance",0) AS opening,
      COALESCE((SELECT SUM(CASE WHEN d."docType"='sales_invoice' THEN d."total" ELSE -d."total" END)
        FROM "CustomersDocuments" l JOIN "Documents" d ON d.id = l."documentsId"
        WHERE l."customersId" = c.id AND d."stockPosted" = true AND d."docType" IN ('sales_invoice','sales_return')),0) AS invoiced,
      COALESCE((SELECT SUM(CASE WHEN t."direction"='in' THEN t."amount" ELSE -t."amount" END)
        FROM "CustomersTransactions" l JOIN "Transactions" t ON t.id = l."transactionsId"
        WHERE l."customersId" = c.id),0) AS paid
      FROM "Customers" c ${customerId ? 'WHERE c.id = $1' : ''} ORDER BY c."name"`,
    params: customerId ? [customerId] : [],
  });
  return r.rows.map((x) => ({
    id: String(x.id), name: String(x.name ?? ''), phone: String(x.phone ?? ''),
    opening: num(x.opening), invoiced: num(x.invoiced), paid: num(x.paid),
    balance: num(x.opening) + num(x.invoiced) - num(x.paid),
  }));
}

/** Supplier payables: opening + posted purchase invoices − posted returns − payments + refunds */
export async function supplierBalances(supplierId?: string) {
  const r = await zite.sql({
    query: `SELECT s.id, s."name", s."phone", COALESCE(s."openingBalance",0) AS opening,
      COALESCE((SELECT SUM(CASE WHEN d."docType"='purchase_invoice' THEN d."total" ELSE -d."total" END)
        FROM "DocumentsSuppliers" l JOIN "Documents" d ON d.id = l."documentsId"
        WHERE l."suppliersId" = s.id AND d."stockPosted" = true AND d."docType" IN ('purchase_invoice','purchase_return')),0) AS invoiced,
      COALESCE((SELECT SUM(CASE WHEN t."direction"='out' THEN t."amount" ELSE -t."amount" END)
        FROM "SuppliersTransactions" l JOIN "Transactions" t ON t.id = l."transactionsId"
        WHERE l."suppliersId" = s.id),0) AS paid
      FROM "Suppliers" s ${supplierId ? 'WHERE s.id = $1' : ''} ORDER BY s."name"`,
    params: supplierId ? [supplierId] : [],
  });
  return r.rows.map((x) => ({
    id: String(x.id), name: String(x.name ?? ''), phone: String(x.phone ?? ''),
    opening: num(x.opening), invoiced: num(x.invoiced), paid: num(x.paid),
    balance: num(x.opening) + num(x.invoiced) - num(x.paid),
  }));
}
