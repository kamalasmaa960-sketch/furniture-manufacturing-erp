import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, Package, Boxes, Warehouse, ShoppingCart, Receipt, Factory, Users, Wallet, BarChart3,
  ShieldCheck, History, Bell, Menu, Layers, Truck, UserRound,
} from 'lucide-react';
import { notifications as fetchNotifications } from 'zitejs/api';
import { Sheet, SheetContent } from '@project/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@project/components/ui/popover';
import { Button } from '@project/components/ui/button';
import { can, useMe } from '../lib/me';
import { fmtDateTime } from '../lib/format';
import { cn } from '@project/components/lib/utils';

const NAV = [
  { to: '/', label: 'لوحة التحكم', icon: LayoutDashboard, m: '' },
  { to: '/products', label: 'المنتجات', icon: Package, m: 'products' },
  { to: '/materials', label: 'المواد الخام', icon: Layers, m: 'products' },
  { to: '/inventory', label: 'المخازن والجرد', icon: Warehouse, m: 'inventory' },
  { to: '/purchases', label: 'المشتريات', icon: ShoppingCart, m: 'purchases' },
  { to: '/suppliers', label: 'الموردون', icon: Truck, m: 'purchases' },
  { to: '/sales', label: 'المبيعات', icon: Receipt, m: 'sales' },
  { to: '/customers', label: 'العملاء', icon: UserRound, m: 'sales' },
  { to: '/production', label: 'الإنتاج والتصنيع', icon: Factory, m: 'production' },
  { to: '/hr', label: 'الموظفون والرواتب', icon: Users, m: 'hr' },
  { to: '/finance', label: 'الحسابات والخزينة', icon: Wallet, m: 'finance' },
  { to: '/reports', label: 'التقارير', icon: BarChart3, m: 'reports' },
  { to: '/users', label: 'المستخدمون والصلاحيات', icon: ShieldCheck, m: 'admin' },
  { to: '/audit', label: 'سجل العمليات', icon: History, m: 'admin' },
];

function Nav({ onNav }: { onNav?: () => void }) {
  const me = useMe();
  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {NAV.filter((n) => !n.m || can(me, n.m)).map((n) => (
        <NavLink key={n.to} to={n.to} end={n.to === '/'} onClick={onNav}
          className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
            isActive ? 'bg-sidebar-primary font-semibold text-sidebar-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground')}>
          <n.icon className="h-4 w-4 shrink-0" /> {n.label}
        </NavLink>
      ))}
    </nav>
  );
}

function Brand() {
  const me = useMe();
  return (
    <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><Boxes className="h-5 w-5" /></div>
      <div>
        <div className="font-bold text-white">نظام المصنع</div>
        <div className="text-xs text-sidebar-foreground">{me.name} · {me.role === 'admin' ? 'مسؤول' : 'موظف'}</div>
      </div>
    </div>
  );
}

function Notifications() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => fetchNotifications({}), refetchInterval: 30000 });
  const markAll = async () => {
    const ids = (data?.notifications ?? []).filter((n) => !n.isRead).map((n) => n.id);
    if (ids.length) { await fetchNotifications({ markRead: ids }); qc.invalidateQueries({ queryKey: ['notifications'] }); }
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="الإشعارات">
          <Bell className="h-5 w-5" />
          {!!data?.unread && <span className="absolute -left-0.5 -top-0.5 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">{data.unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" dir="rtl">
        <div className="flex items-center justify-between border-b p-3">
          <span className="font-semibold">الإشعارات</span>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={markAll}>تعليم الكل كمقروء</Button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {(data?.notifications ?? []).length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">لا توجد إشعارات</div>}
          {(data?.notifications ?? []).map((n) => (
            <button key={n.id} onClick={() => n.link && nav(n.link)} className={cn('block w-full border-b p-3 text-right text-sm hover:bg-muted/50', !n.isRead && 'bg-accent/40')}>
              <div className="font-medium">{n.title}</div>
              <div className="text-muted-foreground">{n.body}</div>
              <div className="mt-1 text-xs text-muted-foreground">{fmtDateTime(n.createdAt)}</div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen" dir="rtl">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto bg-sidebar lg:block no-print">
        <Brand /><Nav />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-64 bg-sidebar p-0"><Brand /><Nav onNav={() => setOpen(false)} /></SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur no-print">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="القائمة"><Menu className="h-5 w-5" /></Button>
          <div className="text-sm text-muted-foreground max-lg:hidden">نظام إدارة مصنع المفروشات</div>
          <Notifications />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
