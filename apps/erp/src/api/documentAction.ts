import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, requireAccess } from '../server/core';
import { DOC_META, type DocType } from '../server/docs';

export default createEndpoint({
  description: 'Updates delivery status, cancels, or deletes an unposted document',
  inputSchema: z.object({
    id: z.string().uuid(),
    action: z.enum(['delivery', 'cancel', 'delete']),
    deliveryStatus: z.string().max(50).optional(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    const doc = await zite.documents.findOne({ id: input.id });
    if (!doc) fail('NOT_FOUND', 'المستند غير موجود');
    const meta = DOC_META[doc.docType as DocType];
    const actor = await requireAccess(context, meta.module);
    if (input.action === 'delivery') {
      await zite.documents.update({ id: doc.id, record: { deliveryStatus: input.deliveryStatus } });
      await audit(actor.userId, 'تعديل', meta.label, doc.id, `تحديث حالة التسليم لـ ${doc.number}: ${input.deliveryStatus}`, { deliveryStatus: doc.deliveryStatus }, { deliveryStatus: input.deliveryStatus });
      return { success: true };
    }
    if (doc.stockPosted) fail('CONFLICT', 'لا يمكن إلغاء أو حذف مستند مُرحّل. استخدم المرتجع.');
    if ((doc.paid ?? 0) > 0) fail('CONFLICT', 'توجد مدفوعات مسجلة على هذا المستند');
    if (input.action === 'cancel') {
      await zite.documents.update({ id: doc.id, record: { status: 'ملغي' } });
      await audit(actor.userId, 'إلغاء', meta.label, doc.id, `إلغاء ${meta.label} ${doc.number}`);
      return { success: true };
    }
    const lines = await zite.documentLines.findAll({ filters: { document: doc.id }, fields: ['label'], limit: 500 });
    for (const l of lines.records) await zite.documentLines.delete({ id: l.id });
    await zite.documents.delete({ id: doc.id });
    await audit(actor.userId, 'حذف', meta.label, doc.id, `حذف ${meta.label} ${doc.number}`, doc);
    return { success: true };
  },
});
