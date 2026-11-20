import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, first, makeNumber, notify, num, requireAccess, round2 } from '../server/core';
import { accountBalances } from '../server/finance';

export default createEndpoint({
  description: 'Records a receipt, payment, expense, revenue or account transfer exactly once',
  inputSchema: z.object({
    requestId: z.string().min(8).max(80),
    kind: z.enum(['customer_receipt', 'supplier_payment', 'customer_refund', 'supplier_refund', 'expense', 'revenue', 'transfer']),
    amount: z.number().positive().max(1e11),
    accountId: z.string().uuid(),
    toAccountId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    supplierId: z.string().uuid().optional(),
    documentId: z.string().uuid().optional(),
    category: z.string().max(100).optional(),
    txDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
    notes: z.string().max(2000).optional(),
  }),
  outputSchema: z.object({ id: z.string(), reference: z.string(), duplicate: z.boolean() }),
  execute: async ({ input, context }) => {
    const actor = await requireAccess(context, 'finance');
    const dup = await zite.transactions.findOne({ filters: { idempotencyKey: input.requestId } });
    if (dup) return { id: dup.id, reference: dup.reference ?? '', duplicate: true };

    const amount = round2(input.amount);
    const dirMap = { customer_receipt: 'in', supplier_refund: 'in', revenue: 'in', supplier_payment: 'out', customer_refund: 'out', expense: 'out', transfer: 'out' } as const;
    const catMap = { customer_receipt: 'تحصيل من عميل', supplier_payment: 'سداد لمورد', customer_refund: 'رد مبلغ لعميل', supplier_refund: 'استرداد من مورد', expense: 'مصروف', revenue: 'إيراد آخر', transfer: 'تحويل بين الحسابات' };
    const direction = dirMap[input.kind];
    let category = catMap[input.kind] as string;
    if ((input.kind === 'expense' || input.kind === 'revenue') && input.category) category = `${category}: ${input.category}`;

    let customerId = input.customerId;
    let supplierId = input.supplierId;
    if (input.kind.startsWith('customer') && !customerId && !input.documentId) fail('BAD_REQUEST', 'اختر العميل');
    if (input.kind.startsWith('supplier') && !supplierId && !input.documentId) fail('BAD_REQUEST', 'اختر المورد');

    let doc: Awaited<ReturnType<typeof zite.documents.findOne>>;
    if (input.documentId) {
      doc = await zite.documents.findOne({ id: input.documentId });
      if (!doc) fail('NOT_FOUND', 'الفاتورة غير موجودة');
      if (!doc.stockPosted) fail('BAD_REQUEST', 'يجب ترحيل الفاتورة قبل تسجيل الدفع');
      const remaining = round2(num(doc.total) - num(doc.paid));
      if (amount > remaining + 0.001) fail('BAD_REQUEST', `المبلغ أكبر من المتبقي على الفاتورة (${remaining})`);
      customerId = first(doc.customer) ?? customerId;
      supplierId = first(doc.supplier) ?? supplierId;
    }

    if (direction === 'out') {
      const bal = (await accountBalances()).find((a) => a.id === input.accountId);
      if (!bal) fail('NOT_FOUND', 'الحساب غير موجود');
      if (bal.balance + 0.001 < amount) fail('BAD_REQUEST', `رصيد "${bal.name}" غير كافٍ (${round2(bal.balance)} ج.م)`);
    }

    const reference = makeNumber(direction === 'in' ? 'RCV' : 'PAY');
    const created = await zite.transactions.create({
      record: {
        reference, txDate: input.txDate, direction, amount, category, account: input.accountId,
        customer: input.kind.startsWith('customer') ? customerId : undefined,
        supplier: input.kind.startsWith('supplier') ? supplierId : undefined,
        document: input.documentId, notes: input.notes, idempotencyKey: input.requestId,
      },
    });
    if (input.kind === 'transfer') {
      if (!input.toAccountId || input.toAccountId === input.accountId) fail('BAD_REQUEST', 'اختر حساباً مختلفاً');
      await zite.transactions.create({
        record: { reference, txDate: input.txDate, direction: 'in', amount, category, account: input.toAccountId, notes: input.notes, idempotencyKey: `${input.requestId}:in` },
      });
    }
    if (doc) {
      const paid = round2(num(doc.paid) + amount);
      await zite.documents.update({ id: doc.id, record: { paid, status: paid >= num(doc.total) - 0.001 ? 'مسددة' : 'مسددة جزئياً' } });
    }
    await audit(actor.userId, 'عملية مالية', 'الحسابات', created.id, `${category} - ${amount} ج.م ${reference}`, undefined, input);
    await notify('تسجيل عملية مالية', `${category} بمبلغ ${amount.toLocaleString('en')} ج.م (${reference})`, 'finance', '/finance');
    return { id: created.id, reference, duplicate: false };
  },
});
