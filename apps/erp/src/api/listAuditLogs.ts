import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess } from '../server/core';

export default createEndpoint({
  description: 'Admin: reads the audit log (read-only, cannot be edited)',
  inputSchema: z.object({ module: z.string().optional(), from: z.string().optional(), to: z.string().optional() }),
  outputSchema: z.object({ logs: z.array(z.object({ id: z.string(), action: z.string(), module: z.string(), description: z.string(), beforeData: z.string(), afterData: z.string(), actorName: z.string(), createdAt: z.string() })) }),
  execute: async ({ input, context }) => {
    await requireAccess(context, 'admin');
    const params: unknown[] = [];
    const where: string[] = [];
    if (input.module) { params.push(input.module); where.push(`a."module" = $${params.length}`); }
    if (input.from) { params.push(input.from); where.push(`a.created_at >= $${params.length}::date`); }
    if (input.to) { params.push(input.to); where.push(`a.created_at < ($${params.length}::date + 1)`); }
    const r = await zite.sql({
      query: `SELECT a.id, a."action", a."module", a."description", a."beforeData", a."afterData", a.created_at, u."name" AS "actorName"
        FROM "AuditLogs" a LEFT JOIN "ziteUsers" u ON u.id = a."actor"->>0
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY a.created_at DESC LIMIT 1000`,
      params,
    });
    return { logs: r.rows.map((x) => ({
      id: String(x.id), action: String(x.action ?? ''), module: String(x.module ?? ''), description: String(x.description ?? ''),
      beforeData: String(x.beforeData ?? ''), afterData: String(x.afterData ?? ''), actorName: String(x.actorName ?? ''), createdAt: String(x.created_at ?? ''),
    })) };
  },
});
