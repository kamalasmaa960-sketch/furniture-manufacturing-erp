import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { getActor } from '../server/core';

export default createEndpoint({
  description: 'Lists recent in-app notifications, or marks them read',
  inputSchema: z.object({ markRead: z.array(z.string().uuid()).max(200).optional() }),
  outputSchema: z.object({ notifications: z.array(z.object({ id: z.string(), title: z.string(), body: z.string(), kind: z.string(), link: z.string(), isRead: z.boolean(), createdAt: z.string() })), unread: z.number() }),
  execute: async ({ input, context }) => {
    await getActor(context);
    for (const id of input.markRead ?? []) await zite.notifications.update({ id, record: { isRead: true } });
    // Due-date checks (run whenever someone opens the app; each alert is created once)
    if (!input.markRead?.length) {
      const due = await zite.sql({
        query: `SELECT id, "number", 'invoice' AS k FROM "Documents" WHERE "docType" IN ('sales_invoice','purchase_invoice') AND "stockPosted" = true AND COALESCE("paid",0) < "total" - 0.01 AND "dueDate" < CURRENT_DATE
          UNION ALL SELECT id, "number", 'order' AS k FROM "Documents" WHERE "docType" = 'sales_order' AND "status" = 'مسودة' AND "dueDate" < CURRENT_DATE
          UNION ALL SELECT id, "number", 'mo' AS k FROM "ProductionOrders" WHERE "status" NOT IN ('مكتمل','ملغي') AND "dueDate" < CURRENT_DATE LIMIT 50`,
      });
      if (due.rows.length) {
        const kinds = { invoice: 'invoice_due', order: 'order_late', mo: 'production_late' } as const;
        const existing = await zite.notifications.findAll({ filters: { kind: { in: Object.values(kinds) } }, fields: ['link'], limit: 2000 });
        const seen = new Set(existing.records.map((n) => n.link));
        for (const r of due.rows) {
          const k = r.k as keyof typeof kinds;
          const link = k === 'mo' ? `/production/${r.id}` : `/doc/${r.id}`;
          if (seen.has(link)) continue;
          const title = k === 'invoice' ? 'فاتورة مستحقة' : k === 'order' ? 'تأخر طلب بيع' : 'تأخر أمر إنتاج';
          await zite.notifications.create({ record: { title, body: `${r.number} تجاوز تاريخ الاستحقاق`, kind: kinds[k], link, isRead: false } });
        }
      }
    }
    const r = await zite.notifications.findAll({ sort: [{ field: 'createdAt', direction: 'desc' }], limit: 100 });
    const list = r.records.map((n) => ({
      id: n.id, title: n.title ?? '', body: n.body ?? '', kind: n.kind ?? '', link: n.link ?? '', isRead: !!n.isRead, createdAt: String(n.createdAt ?? ''),
    }));
    return { notifications: list, unread: list.filter((n) => !n.isRead).length };
  },
});
