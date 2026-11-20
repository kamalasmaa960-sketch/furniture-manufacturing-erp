import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, requireAccess } from '../server/core';
import { ENTITIES } from '../server/entities';

export default createEndpoint({
  description: 'Creates or updates a master-data record with server-side validation and audit',
  inputSchema: z.object({ entity: z.string(), id: z.string().uuid().optional(), data: z.record(z.string(), z.any()) }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input, context }) => {
    const def = ENTITIES[input.entity];
    if (!def) fail('BAD_REQUEST', 'جدول غير معروف');
    const actor = await requireAccess(context, def.module);
    const parsed = def.schema.safeParse(input.data);
    if (!parsed.success) {
      fail('BAD_REQUEST', 'بيانات غير صحيحة: ' + parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('، '));
    }
    const data = parsed.data as Record<string, unknown>;

    if (input.entity === 'items') {
      const dup = await zite.items.findOne({ filters: { code: data.code as string } });
      if (dup && dup.id !== input.id) fail('CONFLICT', 'كود الصنف مستخدم بالفعل');
    }
    if (input.entity === 'bomLines') {
      if (data.product === data.component) fail('BAD_REQUEST', 'لا يمكن أن يكون المنتج مكوناً لنفسه');
      const [p, c] = await Promise.all([
        zite.items.findOne({ id: data.product as string }),
        zite.items.findOne({ id: data.component as string }),
      ]);
      if (!p || !c) fail('NOT_FOUND', 'الصنف غير موجود');
      data.label = `${p.name} ← ${c.name}`;
    }
    if (input.entity === 'leaves' && String(data.toDate) < String(data.fromDate)) fail('BAD_REQUEST', 'تاريخ النهاية قبل البداية');

    if (input.id) {
      const before = await def.client.findOne({ id: input.id });
      if (!before) fail('NOT_FOUND', 'السجل غير موجود');
      await def.client.update({ id: input.id, record: data });
      await audit(actor.userId, 'تعديل', def.label, input.id, `تعديل سجل في ${def.label}`, before, data);
      return { id: input.id };
    }
    const created = await def.client.create({ record: data });
    await audit(actor.userId, 'إضافة', def.label, created.id, `إضافة سجل في ${def.label}`, undefined, data);
    return { id: created.id as string };
  },
});
