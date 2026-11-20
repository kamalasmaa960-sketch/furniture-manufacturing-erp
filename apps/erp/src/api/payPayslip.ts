import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, first, makeNumber, notify, num, requireAccess, today } from '../server/core';
import { accountBalances } from '../server/finance';

export default createEndpoint({
  description: 'Pays a payslip from a cash/bank account, once only',
  inputSchema: z.object({ id: z.string().uuid(), accountId: z.string().uuid() }),
  outputSchema: z.object({ reference: z.string() }),
  execute: async ({ input, context }) => {
    const actor = await requireAccess(context, 'hr');
    await requireAccess(context, 'finance');
    const slip = await zite.payslips.findOne({ id: input.id });
    if (!slip) fail('NOT_FOUND', 'كشف الراتب غير موجود');
    if (slip.paid) fail('CONFLICT', 'تم صرف هذا الراتب مسبقاً');
    const key = `payslip:${slip.id}`;
    const dup = await zite.transactions.findOne({ filters: { idempotencyKey: key } });
    if (dup) { await zite.payslips.update({ id: slip.id, record: { paid: true } }); return { reference: dup.reference ?? '' }; }
    const amount = num(slip.net);
    if (amount <= 0) fail('BAD_REQUEST', 'صافي الراتب صفر');
    const acc = (await accountBalances()).find((a) => a.id === input.accountId);
    if (!acc) fail('NOT_FOUND', 'الحساب غير موجود');
    if (acc.balance + 0.001 < amount) fail('BAD_REQUEST', `رصيد "${acc.name}" غير كافٍ`);
    const reference = makeNumber('SAL');
    await zite.transactions.create({ record: {
      reference, txDate: today(), direction: 'out', amount, category: 'رواتب', account: input.accountId,
      employee: first(slip.employee), notes: `راتب شهر ${slip.month}`, idempotencyKey: key,
    } });
    await zite.payslips.update({ id: slip.id, record: { paid: true } });
    await audit(actor.userId, 'صرف راتب', 'الموظفون', slip.id, `صرف راتب ${slip.month} بمبلغ ${amount}`);
    await notify('تسجيل عملية مالية', `صرف راتب بمبلغ ${amount} ج.م (${reference})`, 'finance', '/finance');
    return { reference };
  },
});
