import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, audit } from '../server/core';

const TABLES = [
  'warehouses', 'suppliers', 'customers', 'items', 'bomLines', 'financeAccounts', 'documents', 'documentLines',
  'productionOrders', 'productionStages', 'stageLogs', 'stockMovements', 'employees', 'transactions', 'attendance',
  'leaves', 'employeeAdjustments', 'payslips', 'appUsers', 'notifications', 'auditLogs',
] as const;

export default createEndpoint({
  description: 'Exports a full copy of all ERP data for an admin to download as a backup',
  inputSchema: z.object({}),
  outputSchema: z.object({
    createdAt: z.string(),
    counts: z.record(z.number()),
    data: z.record(z.array(z.any())),
  }),
  execute: async ({ context }) => {
    const actor = await requireAccess(context, 'admin');
    const data: Record<string, unknown[]> = {};
    const counts: Record<string, number> = {};
    for (const t of TABLES) {
      const client = zite[t] as unknown as {
        findAll: (a: { limit: number; offset: number }) => Promise<{ records: unknown[] }>;
      };
      const rows: unknown[] = [];
      for (let offset = 0; ; offset += 2000) {
        const { records } = await client.findAll({ limit: 2000, offset });
        rows.push(...records);
        if (records.length < 2000) break;
      }
      data[t] = rows;
      counts[t] = rows.length;
    }
    await audit(actor.userId, 'تصدير', 'النسخ الاحتياطي', '-', 'تنزيل نسخة احتياطية كاملة من البيانات');
    return { createdAt: new Date().toISOString(), counts, data };
  },
});
