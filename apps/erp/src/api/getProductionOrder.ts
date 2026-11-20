import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { fail, first, num, requireAccess } from '../server/core';
import { requirements } from '../server/production';

export default createEndpoint({
  description: 'Returns a production order with material requirements, availability, cost and stage history',
  inputSchema: z.object({ id: z.string().uuid() }),
  outputSchema: z.object({
    order: z.record(z.string(), z.any()),
    productName: z.string(),
    salePrice: z.number(),
    requirements: z.array(z.object({ itemId: z.string(), name: z.string(), code: z.string(), unit: z.string(), perUnit: z.number(), wastePercent: z.number(), required: z.number(), available: z.number(), unitCost: z.number(), cost: z.number() })),
    logs: z.array(z.object({ id: z.string(), stageName: z.string(), qtyDone: z.number(), qtyWaste: z.number(), notes: z.string(), at: z.string() })),
    stages: z.array(z.string()),
  }),
  execute: async ({ input, context }) => {
    await requireAccess(context, 'production');
    const order = await zite.productionOrders.findOne({ id: input.id });
    if (!order) fail('NOT_FOUND', 'أمر الإنتاج غير موجود');
    const productId = first(order.product)!;
    const product = await zite.items.findOne({ id: productId, fields: ['name', 'salePrice'] });
    const [reqs, logs, stages] = await Promise.all([
      requirements(productId, num(order.quantity), first(order.materialWarehouse)),
      zite.stageLogs.findAll({ filters: { order: input.id }, limit: 500 }),
      zite.productionStages.findAll({ sort: [{ field: 'sortOrder', direction: 'asc' }], limit: 100 }),
    ]);
    return {
      order: { ...order, productId, materialWarehouseId: first(order.materialWarehouse) ?? '', outputWarehouseId: first(order.outputWarehouse) ?? '' },
      productName: product?.name ?? '',
      salePrice: num(product?.salePrice),
      requirements: reqs,
      logs: logs.records
        .map((l) => ({ id: l.id, stageName: l.stageName ?? '', qtyDone: num(l.qtyDone), qtyWaste: num(l.qtyWaste), notes: l.notes ?? '', at: String(l.loggedAt ?? '') }))
        .sort((a, b) => a.at.localeCompare(b.at)),
      stages: stages.records.map((s) => s.name ?? ''),
    };
  },
});
