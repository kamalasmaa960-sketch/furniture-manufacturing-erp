import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { fail, getActor, requireAccess } from '../server/core';
import { ENTITIES } from '../server/entities';

export default createEndpoint({
  description: 'Lists records of a master-data table (items, customers, warehouses...)',
  inputSchema: z.object({ entity: z.string(), filters: z.record(z.string(), z.string()).optional() }),
  outputSchema: z.object({ records: z.array(z.record(z.string(), z.any())) }),
  execute: async ({ input, context }) => {
    const def = ENTITIES[input.entity];
    if (!def) fail('BAD_REQUEST', 'جدول غير معروف');
    if (def.publicRead) await getActor(context);
    else await requireAccess(context, def.module);
    const filters: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.filters ?? {})) {
      if (/^[a-zA-Z]+$/.test(k) && v) filters[k] = v;
    }
    const res = await def.client.findAll({ filters, limit: 2000, sort: [{ field: 'createdAt', direction: 'desc' }] }).catch(() =>
      def.client.findAll({ filters, limit: 2000 }),
    );
    return { records: res.records };
  },
});
