import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { first, num, requireAccess } from '../server/core';

export default createEndpoint({
  description: 'Lists payslips for a month',
  inputSchema: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }),
  outputSchema: z.object({ payslips: z.array(z.object({ id: z.string(), employeeId: z.string(), base: z.number(), bonuses: z.number(), deductions: z.number(), advances: z.number(), net: z.number(), paid: z.boolean() })) }),
  execute: async ({ input, context }) => {
    await requireAccess(context, 'hr');
    const r = await zite.payslips.findAll({ filters: { month: input.month }, limit: 2000 });
    return { payslips: r.records.map((p) => ({
      id: p.id, employeeId: first(p.employee) ?? '', base: num(p.base), bonuses: num(p.bonuses),
      deductions: num(p.deductions), advances: num(p.advances), net: num(p.net), paid: !!p.paid,
    })) };
  },
});
