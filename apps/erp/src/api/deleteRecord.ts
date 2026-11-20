import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { audit, fail, requireAccess } from '../server/core';
import { ENTITIES } from '../server/entities';

export default createEndpoint({
  description: 'Deletes a master-data record when nothing depends on it',
  inputSchema: z.object({ entity: z.string(), id: z.string().uuid() }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    const def = ENTITIES[input.entity];
    if (!def) fail('BAD_REQUEST', 'جدول غير معروف');
    const actor = await requireAccess(context, def.module);
    const rec = await def.client.findOne({ id: input.id });
    if (!rec) fail('NOT_FOUND', 'السجل غير موجود');
    for (const f of def.blockDeleteIfLinked ?? []) {
      const v = rec[f];
      if (Array.isArray(v) ? v.length > 0 : !!v) {
        fail('CONFLICT', 'لا يمكن الحذف لوجود عمليات مرتبطة بهذا السجل. يمكنك إيقافه بدلاً من حذفه.');
      }
    }
    await def.client.delete({ id: input.id });
    await audit(actor.userId, 'حذف', def.label, input.id, `حذف سجل من ${def.label}`, rec);
    return { success: true };
  },
});
