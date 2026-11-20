import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, first, num, requireAccess, round2 } from '../server/core';

export default createEndpoint({
  description: 'Calculates (or recalculates) unpaid payslips for all active employees for a month',
  inputSchema: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }),
  outputSchema: z.object({ count: z.number() }),
  execute: async ({ input, context }) => {
    const actor = await requireAccess(context, 'hr');
    const [emps, adjs, existing] = await Promise.all([
      zite.employees.findAll({ filters: { active: true }, limit: 2000 }),
      zite.employeeAdjustments.findAll({ filters: { month: input.month }, limit: 2000 }),
      zite.payslips.findAll({ filters: { month: input.month }, limit: 2000 }),
    ]);
    const bySlip = new Map(existing.records.map((p) => [first(p.employee), p]));
    let count = 0;
    for (const e of emps.records) {
      const mine = adjs.records.filter((a) => first(a.employee) === e.id);
      const sum = (t: string) => round2(mine.filter((a) => a.adjustmentType === t).reduce((s, a) => s + num(a.amount), 0));
      const base = num(e.baseSalary), bonuses = sum('bonus'), deductions = sum('deduction'), advances = sum('advance');
      const rec = { month: input.month, employee: e.id, base, bonuses, deductions, advances, net: round2(base + bonuses - deductions - advances) };
      const ex = bySlip.get(e.id);
      if (ex?.paid) continue;
      if (ex) await zite.payslips.update({ id: ex.id, record: rec });
      else await zite.payslips.create({ record: { ...rec, paid: false } });
      count++;
    }
    await audit(actor.userId, 'احتساب رواتب', 'الموظفون', input.month, `احتساب رواتب شهر ${input.month} لعدد ${count} موظف`);
    return { count };
  },
});
