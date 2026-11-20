import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, first, notify, num, requireAccess, round2, today } from '../server/core';
import { postMovements } from '../server/stock';
import { requirements } from '../server/production';

export default createEndpoint({
  description: 'Runs a production step: issue materials, log a stage, quality check, complete or cancel',
  inputSchema: z.object({
    id: z.string().uuid(),
    action: z.enum(['issue_materials', 'log_stage', 'quality', 'complete', 'cancel']),
    stageName: z.string().max(100).optional(),
    qtyDone: z.number().min(0).optional(),
    qtyWaste: z.number().min(0).optional(),
    passedQty: z.number().min(0).optional(),
    rejectedQty: z.number().min(0).optional(),
    reworkQty: z.number().min(0).optional(),
    notes: z.string().max(2000).optional(),
  }),
  outputSchema: z.object({ status: z.string() }),
  execute: async ({ input, context }) => {
    const actor = await requireAccess(context, 'production');
    const o = await zite.productionOrders.findOne({ id: input.id });
    if (!o) fail('NOT_FOUND', 'أمر الإنتاج غير موجود');
    if (o.status === 'مكتمل' || o.status === 'ملغي') fail('CONFLICT', 'الأمر مغلق');
    const productId = first(o.product)!;
    const qty = num(o.quantity);

    if (input.action === 'issue_materials') {
      if (o.materialsIssued) fail('CONFLICT', 'تم صرف الخامات مسبقاً');
      const wh = first(o.materialWarehouse)!;
      const reqs = await requirements(productId, qty, wh);
      if (reqs.length === 0) fail('BAD_REQUEST', 'لم يتم تحديد مكونات (خامات) لهذا المنتج. أضفها من صفحة المنتج.');
      const short = reqs.filter((r) => r.available + 1e-9 < r.required);
      if (short.length) fail('BAD_REQUEST', 'خامات غير كافية: ' + short.map((s) => `${s.name} (متاح ${s.available} من ${s.required})`).join('، '));
      await postMovements(reqs.map((r) => ({
        itemId: r.itemId, warehouseId: wh, type: 'صرف للإنتاج', qtyOut: r.required, unitCost: r.unitCost,
        reference: o.number ?? '', sourceId: o.id, key: `mo:${o.id}:issue:${r.itemId}`,
      })));
      const stages = await zite.productionStages.findAll({ sort: [{ field: 'sortOrder', direction: 'asc' }], limit: 1 });
      const materialCost = round2(reqs.reduce((s, r) => s + r.cost, 0));
      await zite.productionOrders.update({ id: o.id, record: {
        materialsIssued: true, materialCost, status: 'قيد التنفيذ', startDate: o.startDate || today(), currentStage: stages.records[0]?.name ?? '',
      } });
      await audit(actor.userId, 'صرف خامات', 'الإنتاج', o.id, `صرف خامات أمر ${o.number} بتكلفة ${materialCost}`, undefined, reqs);
      return { status: 'قيد التنفيذ' };
    }

    if (!o.materialsIssued && input.action !== 'cancel') fail('BAD_REQUEST', 'اصرف الخامات أولاً لبدء الإنتاج');

    if (input.action === 'log_stage') {
      if (!input.stageName) fail('BAD_REQUEST', 'اختر المرحلة');
      await zite.stageLogs.create({ record: { stageName: input.stageName, order: o.id, qtyDone: input.qtyDone ?? 0, qtyWaste: input.qtyWaste ?? 0, notes: input.notes } });
      const waste = num(o.wasteQty) + (input.qtyWaste ?? 0);
      await zite.productionOrders.update({ id: o.id, record: { currentStage: input.stageName, wasteQty: waste } });
      await audit(actor.userId, 'مرحلة إنتاج', 'الإنتاج', o.id, `${o.number}: ${input.stageName} - منجز ${input.qtyDone ?? 0} - هالك ${input.qtyWaste ?? 0}`);
      if ((input.qtyWaste ?? 0) > 0) await notify('هالك في الإنتاج', `${o.number}: ${input.qtyWaste} وحدة هالك في مرحلة ${input.stageName}`, 'damage', `/production/${o.id}`);
      return { status: o.status ?? '' };
    }

    if (input.action === 'quality') {
      const passed = input.passedQty ?? 0, rejected = input.rejectedQty ?? 0, rework = input.reworkQty ?? 0;
      if (passed + rejected + rework > qty + 1e-9) fail('BAD_REQUEST', 'الكميات أكبر من كمية الأمر');
      await zite.productionOrders.update({ id: o.id, record: { completedQty: passed, rejectedQty: rejected, reworkQty: rework, qualityNotes: input.notes, currentStage: 'مراقبة الجودة', status: 'فحص الجودة' } });
      await zite.stageLogs.create({ record: { stageName: 'فحص الجودة', order: o.id, qtyDone: passed, qtyWaste: rejected, notes: `مقبول ${passed} / مرفوض ${rejected} / إعادة تشغيل ${rework}. ${input.notes ?? ''}` } });
      await audit(actor.userId, 'فحص جودة', 'الإنتاج', o.id, `${o.number}: مقبول ${passed}، مرفوض ${rejected}، إعادة ${rework}`);
      if (rejected > 0 || rework > 0) await notify('مشكلة في الجودة', `${o.number}: مرفوض ${rejected}، يحتاج إعادة تشغيل ${rework}`, 'quality', `/production/${o.id}`);
      return { status: 'فحص الجودة' };
    }

    if (input.action === 'complete') {
      const good = num(o.completedQty);
      if (good <= 0) fail('BAD_REQUEST', 'سجّل نتيجة فحص الجودة (الكمية المقبولة) قبل إنهاء الأمر');
      const total = round2(num(o.materialCost) + num(o.laborCost) + num(o.overheadCost) + num(o.directExpenses) + num(o.indirectExpenses));
      const unitCost = round2(total / good);
      await postMovements([{
        itemId: productId, warehouseId: first(o.outputWarehouse)!, type: 'إنتاج تام', qtyIn: good, unitCost,
        reference: o.number ?? '', sourceId: o.id, key: `mo:${o.id}:output`, updateAvgCost: true,
      }]);
      await zite.productionOrders.update({ id: o.id, record: { status: 'مكتمل', totalCost: total, unitCost, endDate: today(), currentStage: 'التخزين' } });
      await audit(actor.userId, 'إنهاء إنتاج', 'الإنتاج', o.id, `إنهاء ${o.number}: ${good} وحدة، تكلفة الوحدة ${unitCost}`);
      await notify('انتهاء أمر إنتاج', `${o.number}: تمت إضافة ${good} وحدة للمخزن بتكلفة ${unitCost} ج.م للوحدة`, 'production', `/production/${o.id}`);
      return { status: 'مكتمل' };
    }

    // cancel
    if (o.materialsIssued) fail('CONFLICT', 'لا يمكن إلغاء أمر تم صرف خاماته. أكمله أو سجّل الهالك.');
    await zite.productionOrders.update({ id: o.id, record: { status: 'ملغي' } });
    await audit(actor.userId, 'إلغاء', 'الإنتاج', o.id, `إلغاء أمر ${o.number}`);
    return { status: 'ملغي' };
  },
});
