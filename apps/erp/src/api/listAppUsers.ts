import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { first, requireAccess } from '../server/core';

export default createEndpoint({
  description: 'Admin: lists system accounts with roles plus people who can be added',
  inputSchema: z.object({}),
  outputSchema: z.object({
    accounts: z.array(z.object({ id: z.string(), userId: z.string(), displayName: z.string(), email: z.string(), role: z.string(), permissions: z.array(z.string()), active: z.boolean() })),
    people: z.array(z.object({ id: z.string(), name: z.string(), email: z.string() })),
  }),
  execute: async ({ context }) => {
    await requireAccess(context, 'admin');
    const [accounts, people] = await Promise.all([
      zite.appUsers.findAll({ limit: 2000 }),
      zite.auth.findAllUsers({ limit: 500 }),
    ]);
    const emails = new Map(people.records.map((p) => [p.id, p]));
    return {
      accounts: accounts.records.map((a) => {
        const uid = first(a.user) ?? '';
        return {
          id: a.id, userId: uid, displayName: a.displayName ?? emails.get(uid)?.name ?? '', email: emails.get(uid)?.email ?? '',
          role: String(a.role ?? 'employee'), permissions: (a.permissions as string[] | undefined) ?? [], active: !!a.active,
        };
      }),
      people: people.records.map((p) => ({ id: p.id, name: p.name ?? '', email: p.email })),
    };
  },
});
