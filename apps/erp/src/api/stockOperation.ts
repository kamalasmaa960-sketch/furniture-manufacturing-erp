import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, makeNumber, notify, num, requireAccess } from '../server/core';
import { balanceOf, postMovements, type MovementInput } from '../server/stock';

export default createEndpoint({
  description: 'Records a manual stock operation: receipt, issue, transfer, count adjustment or waste',
  inputSchema: z.object({
    kind: z.enum(['in', 'out', 'transfer', 'adjust', 'waste', 'opening']),
    itemId: z.string().uuid(),
    warehouseId: z.string().uuid(),
    toWarehouseId: z.string().uuid().optional(),
    qty: z.number().min(0).max(1e9),
    unitCost: z.number().min(0).optional(),
    notes: z.string().max(1000).optional(),
    requestId: z.string().min(8).max(80),
  }),
  outputSchema: z.object({ reference: z.string(), posted: z.number() }),
  execute: async ({ input, context }) => {
    const actor = await requireAccess(context, 'inventory');
    const item = await zite.items.findOne({ id: input.itemId });
    if (!item) fail('NOT_FOUND', 'الصنف غير موجود');
    const ref = makeNumber('STK');
    const base = { itemId: input.itemId, reference: ref, notes: input.notes, sourceId: input.requestId };
    const cost = input.unitCost ?? num(item.unitCost);
    const moves: MovementInput[] = [];
    if (input.kind !== 'adjust' && input.qty <= 0) fail('BAD_REQUEST', 'الكمية يجب أن تكون أكبر من صفر');

    switch (input.kind) {
      case 'in':
      case 'opening':
        moves.push({ ...base, warehouseId: input.warehouseId, type: input.kind === 'in' ? 'إدخال يدوي' : 'رصيد افتتاحي', qtyIn: input.qty, unitCost: cost, key: `${input.requestId}:in`, updateAvgCost: true });
        break;
      case 'out':
        moves.push({ ...base, warehouseId: input.warehouseId, type: 'إخراج يدوي', qtyOut: input.qty, unitCost: cost, key: `${input.requestId}:out` });
        break;
      case 'waste':
        moves.push({ ...base, warehouseId: input.warehouseId, type: 'هالك وتالف', qtyOut: input.qty, unitCost: cost, key: `${input.requestId}:waste` });
        break;
      case 'transfer':
        if (!input.toWarehouseId || input.toWarehouseId === input.warehouseId) fail('BAD_REQUEST', 'اختر مخزناً مختلفاً للتحويل إليه');
        moves.push({ ...base, warehouseId: input.warehouseId, type: 'تحويل صادر', qtyOut: input.qty, unitCost: cost, key: `${input.requestId}:tout` });
        moves.push({ ...base, warehouseId: input.toWarehouseId!, type: 'تحويل وارد', qtyIn: input.qty, unitCost: cost, key: `${input.requestId}:tin` });
        break;
      case 'adjust': {
        const bal = await balanceOf(input.itemId, input.warehouseId);
        const diff = input.qty - bal;
        if (Math.abs(diff) < 1e-9) return { reference: ref, posted: 0 };
        moves.push({
          ...base, warehouseId: input.warehouseId, type: diff > 0 ? 'تسوية جرد - زيادة' : 'تسوية جرد - عجز',
          qtyIn: diff > 0 ? diff : 0, qtyOut: diff < 0 ? -diff : 0, unitCost: cost, key: `${input.requestId}:adj`,
          notes: `${input.notes ?? ''} (الرصيد الدفتري ${bal}، الفعلي ${input.qty})`.trim(),
        });
        break;
      }
    }
    const posted = await postMovements(moves);
    if (posted > 0) {
      await audit(actor.userId, 'حركة مخزون', 'المخازن', input.itemId, `${moves.map((m) => m.type).join(' / ')} - ${item.name} - كمية ${input.qty}`, undefined, input);
      if (input.kind === 'waste') await notify('تسجيل تالف', `تم تسجيل ${input.qty} تالف من "${item.name}"`, 'damage', `/items/${item.id}`);
    }
    return { reference: ref, posted };
  },
});
