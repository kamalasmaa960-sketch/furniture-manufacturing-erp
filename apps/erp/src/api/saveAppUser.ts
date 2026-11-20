import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, first, requireAccess } from '../server/core';

const PERMS = ['products', 'inventory', 'purchases', 'sales', 'production', 'hr', 'finance', 'reports'] as const;

export default createEndpoint({
  description: 'Admin: adds or updates a system account (role, department permissions, active)',
  inputSchema: z.object({
    id: z.string().uuid().optional(),
    userId: z.string().min(1),
    displayName: z.string().trim().min(1).max(120),
    role: z.enum(['admin', 'employee']),
    permissions: z.array(z.enum(PERMS)).max(8),
    active: z.boolean(),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input, context }) => {
    const actor = await requireAccess(context, 'admin');
    const rec = { user: input.userId, displayName: input.displayName, role: input.role, permissions: input.role === 'admin' ? [] : input.permissions, active: input.active };
    if (input.id) {
      const before = await zite.appUsers.findOne({ id: input.id });
      if (!before) fail('NOT_FOUND', 'الحساب غير موجود');
      if (first(before.user) === actor.userId && (input.role !== 'admin' || !input.active)) {
        fail('BAD_REQUEST', 'لا يمكنك إيقاف حسابك أو إزالة صلاحية المسؤول عن نفسك');
      }
      await zite.appUsers.update({ id: input.id, record: rec });
      await audit(actor.userId, 'تعديل صلاحيات', 'المستخدمون', input.id, `تعديل حساب ${input.displayName}`, before, rec);
      return { id: input.id };
    }
    const exists = await zite.appUsers.findOne({ filters: { user: input.userId } });
    if (exists) fail('CONFLICT', 'هذا الشخص لديه حساب بالفعل');
    const c = await zite.appUsers.create({ record: rec });
    await audit(actor.userId, 'إضافة', 'المستخدمون', c.id, `إضافة حساب ${input.displayName} بدور ${input.role}`, undefined, rec);
    return { id: c.id };
  },
});
