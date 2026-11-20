import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useAuth } from 'zitejs/auth';
import { me as fetchMe } from 'zitejs/api';
import { Toaster } from '@project/components/ui/sonner';
import { ShieldAlert } from 'lucide-react';
import { MeContext, can, useMe } from './lib/me';
import { errMsg } from './lib/format';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ItemsPage from './pages/ItemsPage';
import ItemDetail from './pages/ItemDetail';
import Inventory from './pages/Inventory';
import DocumentsPage from './pages/DocumentsPage';
import DocumentEditor from './pages/DocumentEditor';
import DocumentView from './pages/DocumentView';
import PartiesPage from './pages/PartiesPage';
import PartyStatement from './pages/PartyStatement';
import ProductionPage from './pages/ProductionPage';
import ProductionDetail from './pages/ProductionDetail';
import HrPage from './pages/HrPage';
import FinancePage from './pages/FinancePage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import AuditPage from './pages/AuditPage';

const qc = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true, refetchInterval: 45000, staleTime: 10000, retry: 1 } },
});

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6" dir="rtl">
      <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h1 className="mb-2 text-xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function Guard({ m, children }: { m: string; children: ReactNode }) {
  const me = useMe();
  return can(me, m) ? <>{children}</> : <Message title="غير مصرح" text="ليس لديك صلاحية للوصول إلى هذه الصفحة." />;
}

function Shell() {
  const { user, isLoading } = useAuth();
  const q = useQuery({ queryKey: ['me'], queryFn: () => fetchMe({}), enabled: !!user, refetchInterval: 60000 });
  if (isLoading || (user && q.isLoading)) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">جارٍ التحميل...</div>;
  }
  if (!user) return <Message title="تسجيل الدخول مطلوب" text="يرجى تسجيل الدخول للوصول إلى النظام." />;
  if (q.error || !q.data) return <Message title="لا يمكن الدخول" text={errMsg(q.error)} />;
  return (
    <MeContext.Provider value={q.data}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Guard m="products"><ItemsPage type="product" /></Guard>} />
          <Route path="materials" element={<Guard m="products"><ItemsPage type="material" /></Guard>} />
          <Route path="items/:id" element={<Guard m="products"><ItemDetail /></Guard>} />
          <Route path="inventory" element={<Guard m="inventory"><Inventory /></Guard>} />
          <Route path="purchases" element={<Guard m="purchases"><DocumentsPage group="purchases" /></Guard>} />
          <Route path="sales" element={<Guard m="sales"><DocumentsPage group="sales" /></Guard>} />
          <Route path="doc/new/:type" element={<DocumentEditor />} />
          <Route path="doc/:id/edit" element={<DocumentEditor />} />
          <Route path="doc/:id" element={<DocumentView />} />
          <Route path="purchases/:id" element={<DocumentView />} />
          <Route path="suppliers" element={<Guard m="purchases"><PartiesPage kind="suppliers" /></Guard>} />
          <Route path="customers" element={<Guard m="sales"><PartiesPage kind="customers" /></Guard>} />
          <Route path="suppliers/:id" element={<Guard m="purchases"><PartyStatement kind="suppliers" /></Guard>} />
          <Route path="customers/:id" element={<Guard m="sales"><PartyStatement kind="customers" /></Guard>} />
          <Route path="production" element={<Guard m="production"><ProductionPage /></Guard>} />
          <Route path="production/:id" element={<Guard m="production"><ProductionDetail /></Guard>} />
          <Route path="hr" element={<Guard m="hr"><HrPage /></Guard>} />
          <Route path="finance" element={<Guard m="finance"><FinancePage /></Guard>} />
          <Route path="reports" element={<Guard m="reports"><ReportsPage /></Guard>} />
          <Route path="users" element={<Guard m="admin"><UsersPage /></Guard>} />
          <Route path="audit" element={<Guard m="admin"><AuditPage /></Guard>} />
          <Route path="*" element={<Message title="الصفحة غير موجودة" text="تحقق من الرابط." />} />
        </Route>
      </Routes>
    </MeContext.Provider>
  );
}

export default function App() {
  useEffect(() => {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
    document.title = 'نظام ERP المصنع';
  }, []);
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
