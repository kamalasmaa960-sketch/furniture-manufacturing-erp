import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, makeNumber, notify, requireAccess } from '../server/core';

const money = z.number().min(0).max(1e11).default(0);

export default createEndpoint({
  description: 'Creates or updates a production order (plan, warehouses and labor/overhead costs)',
  inputSchema: z.object({
    id: z.string().uuid().optional(),
    productId: z.string().uuid(),
    quantity: z.number().positive().max(1e8),
    materialWarehouseId: z.string().uuid(),
    outputWarehouseId: z.string().uuid(),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    laborCost: money, overheadCost: money, directExpenses: money, indirectExpenses: money,
    notes: z.string().max(3000).optional(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input, context }) => {
    const actor = await requireAccess(context, 'production');
    const product = await zite.items.findOne({ id: input.productId });
    if (!product || product.itemType !== 'product') fail('BAD_REQUEST', 'اختر منتجاً نهائياً');
    const rec = {
      product: input.productId, quantity: input.quantity, materialWarehouse: input.materialWarehouseId,
      outputWarehouse: input.outputWarehouseId, startDate: input.startDate || undefined, dueDate: input.dueDate || undefined,
      laborCost: input.laborCost, overheadCost: input.overheadCost, directExpenses: input.directExpenses,
      indirectExpenses: input.indirectExpenses, notes: input.notes,
    };
    if (input.id) {
      const o = await zite.productionOrders.findOne({ id: input.id });
      if (!o) fail('NOT_FOUND', 'الأمر غير موجود');
      if (o.status === 'مكتمل' || o.status === 'ملغي') fail('CONFLICT', 'لا يمكن تعديل أمر مكتمل أو ملغي');
      if (o.materialsIssued && (o.quantity !== input.quantity || input.productId !== (o.product as string[] | undefined)?.[0])) {
        fail('CONFLICT', 'لا يمكن تغيير المنتج أو الكمية بعد صرف الخامات');
      }
      await zite.productionOrders.update({ id: input.id, record: rec });
      await audit(actor.userId, 'تعديل', 'الإنتاج', input.id, `تعديل أمر الإنتاج ${o.number}`, o, rec);
      return { id: input.id };
    }
    const number = makeNumber('MO');
    const c = await zite.productionOrders.create({
      record: { ...rec, number, status: 'مسودة', completedQty: 0, rejectedQty: 0, reworkQty: 0, wasteQty: 0, materialCost: 0, materialsIssued: false },
    });
    await audit(actor.userId, 'إضافة', 'الإنتاج', c.id, `إنشاء أمر إنتاج ${number} - ${product.name} × ${input.quantity}`);
    await notify('أمر إنتاج جديد', `${number}: ${product.name} × ${input.quantity}`, 'production', `/production/${c.id}`);
    return { id: c.id };
  },
});
