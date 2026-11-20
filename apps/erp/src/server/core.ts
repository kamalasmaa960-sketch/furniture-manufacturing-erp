import { zite } from 'zitejs/db';
import { ZiteError } from 'zitejs/backend';
import type { ZiteRequestContext } from 'zitejs/backend';

export type Module =
  | 'products' | 'inventory' | 'purchases' | 'sales' | 'production'
  | 'hr' | 'finance' | 'reports' | 'admin';

export interface Actor {
  userId: string;
  role: 'admin' | 'employee';
  permissions: string[];
  name: string;
}

export function fail(code: 'BAD_REQUEST' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT', msg: string): never {
  throw new ZiteError({ code, message: msg, userFacingMessage: msg });
}

export const first = (v: unknown): string | undefined =>
  Array.isArray(v) ? (v[0] as string | undefined) : (v as string | undefined) || undefined;

export const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const today = () => new Date().toISOString().slice(0, 10);

/** Resolve the caller's role. The very first person to open the system becomes an admin. */
export async function getActor(context: ZiteRequestContext): Promise<Actor> {
  const user = context.user;
  if (!user?.id) fail('FORBIDDEN', 'يجب تسجيل الدخول أولاً');
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  let row = await zite.appUsers.findOne({ filters: { user: user.id } });
  if (!row) {
    const admins = await zite.appUsers.findAll({ filters: { role: 'admin' }, limit: 1 });
    if (admins.records.length > 0) {
      fail('FORBIDDEN', 'حسابك غير مُفعّل في النظام. اطلب من أحد المسؤولين إضافتك وتحديد صلاحياتك.');
    }
    row = await zite.appUsers.create({
      record: { displayName: name, user: user.id, role: 'admin', active: true },
    });
    await audit(user.id, 'إنشاء', 'المستخدمون', row.id, 'تفعيل أول حساب مسؤول تلقائياً');
  }
  if (!row.active) fail('FORBIDDEN', 'تم إيقاف حسابك. تواصل مع المسؤول.');
  return {
    userId: user.id,
    role: row.role === 'admin' ? 'admin' : 'employee',
    permissions: (row.permissions as string[] | undefined) ?? [],
    name: row.displayName || name,
  };
}

export async function requireAccess(context: ZiteRequestContext, module: Module): Promise<Actor> {
  const actor = await getActor(context);
  if (actor.role === 'admin') return actor;
  if (module === 'admin' || !actor.permissions.includes(module)) {
    fail('FORBIDDEN', 'ليس لديك صلاحية للوصول إلى هذا القسم');
  }
  return actor;
}

export async function audit(
  userId: string,
  action: string,
  module: string,
  recordId: string,
  description: string,
  before?: unknown,
  after?: unknown,
) {
  await zite.auditLogs.create({
    record: {
      action,
      module,
      recordId,
      description,
      actor: userId,
      beforeData: before === undefined ? undefined : JSON.stringify(before).slice(0, 20000),
      afterData: after === undefined ? undefined : JSON.stringify(after).slice(0, 20000),
    },
  });
}

export async function notify(title: string, body: string, kind: string, link?: string) {
  await zite.notifications.create({ record: { title, body, kind, link, isRead: false } });
}

export function makeNumber(prefix: string) {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${prefix}-${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${Math.floor(
    Math.random() * 90000 + 10000,
  )}`;
}
