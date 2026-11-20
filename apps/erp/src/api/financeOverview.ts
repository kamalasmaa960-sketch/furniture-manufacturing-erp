import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { num, requireAccess } from '../server/core';
import { accountBalances, customerBalances, supplierBalances } from '../server/finance';

export default createEndpoint({
  description: 'Finance overview: account balances, transactions, receivables and payables',
  inputSchema: z.object({ from: z.string().optional(), to: z.string().optional() }),
  outputSchema: z.object({
    accounts: z.array(z.object({ id: z.string(), name: z.string(), accountType: z.string(), accountNumber: z.string(), opening: z.number(), totalIn: z.number(), totalOut: z.number(), balance: z.number() })),
    customers: z.array(z.object({ id: z.string(), name: z.string(), phone: z.string(), opening: z.number(), invoiced: z.number(), paid: z.number(), balance: z.number() })),
    suppliers: z.array(z.object({ id: z.string(), name: z.string(), phone: z.string(), opening: z.number(), invoiced: z.number(), paid: z.number(), balance: z.number() })),
    transactions: z.array(z.object({ id: z.string(), reference: z.string(), date: z.string(), direction: z.string(), amount: z.number(), category: z.string(), accountName: z.string(), partyName: z.string(), docNumber: z.string(), notes: z.string() })),
  }),
  execute: async ({ input, context }) => {
    await requireAccess(context, 'finance');
    const params: unknown[] = [];
    const where: string[] = [];
    if (input.from) { params.push(input.from); where.push(`t."txDate" >= $${params.length}::date`); }
    if (input.to) { params.push(input.to); where.push(`t."txDate" <= $${params.length}::date`); }
    const [accounts, customers, suppliers, tx] = await Promise.all([
      accountBalances(), customerBalances(), supplierBalances(),
      zite.sql({
        query: `SELECT t.id, t."reference", t."txDate", t."direction", t."amount", t."category", t."notes",
            a."name" AS "accountName", COALESCE(c."name", s."name", e."name") AS "partyName", d."number" AS "docNumber"
          FROM "Transactions" t
          LEFT JOIN "FinanceAccountsTransactions" al ON al."transactionsId" = t.id LEFT JOIN "FinanceAccounts" a ON a.id = al."financeAccountsId"
          LEFT JOIN "CustomersTransactions" cl ON cl."transactionsId" = t.id LEFT JOIN "Customers" c ON c.id = cl."customersId"
          LEFT JOIN "SuppliersTransactions" sl ON sl."transactionsId" = t.id LEFT JOIN "Suppliers" s ON s.id = sl."suppliersId"
          LEFT JOIN "EmployeesTransactions" el ON el."transactionsId" = t.id LEFT JOIN "Employees" e ON e.id = el."employeesId"
          LEFT JOIN "DocumentsTransactions" dl ON dl."transactionsId" = t.id LEFT JOIN "Documents" d ON d.id = dl."documentsId"
          ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
          ORDER BY t."txDate" DESC, t.created_at DESC LIMIT 1500`,
        params,
      }),
    ]);
    return {
      accounts, customers, suppliers,
      transactions: tx.rows.map((x) => ({
        id: String(x.id), reference: String(x.reference ?? ''), date: String(x.txDate ?? '').slice(0, 10),
        direction: String(x.direction ?? ''), amount: num(x.amount), category: String(x.category ?? ''),
        accountName: String(x.accountName ?? ''), partyName: String(x.partyName ?? ''), docNumber: String(x.docNumber ?? ''), notes: String(x.notes ?? ''),
      })),
    };
  },
});
