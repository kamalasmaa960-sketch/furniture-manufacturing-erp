import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calculator, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { generatePayslips, listPayslips, payPayslip } from 'zitejs/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import DataTable from '../components/DataTable';
import EntityPage from '../components/EntityPage';
import { RefSelect } from '../components/EntityForm';
import { Confirm, PageHeader } from '../components/ui-kit';
import { useInvalidate, useNameMap } from '../lib/data';
import { errMsg, first, fmtDate, fmtMoney, monthStr, todayStr } from '../lib/format';

const ATT = [{ value: 'present', label: 'حاضر' }, { value: 'late', label: 'متأخر' }, { value: 'absent', label: 'غائب' }, { value: 'leave', label: 'إجازة' }];
const LEAVE = [{ value: 'pending', label: 'قيد المراجعة' }, { value: 'approved', label: 'موافق عليها' }, { value: 'rejected', label: 'مرفوضة' }];
const ADJ = [{ value: 'bonus', label: 'مكافأة' }, { value: 'deduction', label: 'خصم' }, { value: 'advance', label: 'سلفة' }];
const lbl = (opts: { value: string; label: string }[], v: string) => opts.find((o) => o.value === v)?.label ?? v;

function Payroll() {
  const [month, setMonth] = useState(monthStr());
  const [account, setAccount] = useState('');
  const names = useNameMap('employees');
  const invalidate = useInvalidate();
  const { data, isLoading } = useQuery({ queryKey: ['payslips', month], queryFn: () => listPayslips({ month }) });
  const total = (data?.payslips ?? []).reduce((s, p) => s + p.net, 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div><Label className="mb-1 block">الشهر</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" /></div>
        <div className="w-56"><Label className="mb-1 block">خزينة/بنك الصرف</Label><RefSelect entity="financeAccounts" value={account} onChange={setAccount} /></div>
        <Button onClick={async () => { try { const r = await generatePayslips({ month }); toast.success(`تم احتساب ${r.count} كشف راتب`); invalidate(); } catch (e) { toast.error(errMsg(e)); } }}><Calculator className="ml-1 h-4 w-4" />احتساب رواتب الشهر</Button>
        <span className="text-sm">إجمالي الصافي: <b className="num">{fmtMoney(total)}</b></span>
      </div>
      <DataTable rows={data?.payslips} loading={isLoading} exportName={`رواتب ${month}`} emptyText="اضغط احتساب رواتب الشهر لإنشاء الكشوف" columns={[
        { key: 'employee', label: 'الموظف', value: (r) => names.get(r.employeeId) ?? '' },
        { key: 'base', label: 'الأساسي', render: (r) => <span className="num">{fmtMoney(r.base)}</span> },
        { key: 'bonuses', label: 'مكافآت', render: (r) => <span className="num">{fmtMoney(r.bonuses)}</span> },
        { key: 'deductions', label: 'خصومات', render: (r) => <span className="num">{fmtMoney(r.deductions)}</span> },
        { key: 'advances', label: 'سلف', render: (r) => <span className="num">{fmtMoney(r.advances)}</span> },
        { key: 'net', label: 'الصافي', render: (r) => <span className="num font-semibold">{fmtMoney(r.net)}</span> },
        { key: 'paid', label: 'الصرف', value: (r) => (r.paid ? 'مصروف' : 'غير مصروف'), render: (r) => r.paid ? <span className="text-emerald-700">تم الصرف</span> : (
          <Confirm title="صرف الراتب؟" description={`سيتم صرف ${fmtMoney(r.net)} وتسجيله في الحسابات.`} trigger={<Button size="sm" variant="outline"><Banknote className="ml-1 h-4 w-4" />صرف</Button>}
            onConfirm={async () => { if (!account) throw new Error('اختر خزينة/بنك الصرف أولاً'); await payPayslip({ id: r.id, accountId: account }); toast.success('تم صرف الراتب'); invalidate(); }} />
        ) },
      ]} />
    </div>
  );
}

export default function HrPage() {
  const names = useNameMap('employees');
  const emp = (r: Record<string, unknown>) => names.get(first(r.employee)) ?? '';
  return (
    <div>
      <PageHeader title="الموظفون والرواتب" subtitle="بيانات الموظفين والحضور والإجازات والمستحقات" />
      <Tabs defaultValue="employees" dir="rtl">
        <TabsList className="mb-3 flex-wrap"><TabsTrigger value="employees">الموظفون</TabsTrigger><TabsTrigger value="attendance">الحضور والانصراف</TabsTrigger><TabsTrigger value="leaves">الإجازات</TabsTrigger><TabsTrigger value="adj">مكافآت وخصومات وسلف</TabsTrigger><TabsTrigger value="payroll">الرواتب</TabsTrigger></TabsList>
        <TabsContent value="employees">
          <EntityPage entity="employees" title="موظف" exportName="الموظفون" fields={[
            { key: 'name', label: 'الاسم', type: 'text', required: true }, { key: 'jobTitle', label: 'الوظيفة', type: 'text' }, { key: 'department', label: 'القسم', type: 'text' },
            { key: 'phone', label: 'الهاتف', type: 'text' }, { key: 'baseSalary', label: 'الراتب الأساسي', type: 'money' }, { key: 'hireDate', label: 'تاريخ التعيين', type: 'date' },
            { key: 'active', label: 'على رأس العمل', type: 'checkbox', defaultValue: true }, { key: 'notes', label: 'ملاحظات', type: 'textarea' },
          ]} columns={[
            { key: 'name', label: 'الاسم', className: 'font-medium' }, { key: 'jobTitle', label: 'الوظيفة' }, { key: 'department', label: 'القسم' }, { key: 'phone', label: 'الهاتف' },
            { key: 'baseSalary', label: 'الراتب', value: (r) => r.baseSalary ?? 0, render: (r) => <span className="num">{fmtMoney(r.baseSalary)}</span> },
            { key: 'active', label: 'الحالة', value: (r) => (r.active ? 'نشط' : 'متوقف') },
          ]} />
        </TabsContent>
        <TabsContent value="attendance">
          <EntityPage entity="attendance" title="سجل حضور" exportName="الحضور" fields={[
            { key: 'employee', label: 'الموظف', type: 'ref', ref: 'employees', required: true }, { key: 'day', label: 'اليوم', type: 'date', required: true, defaultValue: todayStr() },
            { key: 'status', label: 'الحالة', type: 'select', options: ATT, required: true, defaultValue: 'present' }, { key: 'checkIn', label: 'وقت الحضور (مثال 08:00)', type: 'text' },
            { key: 'checkOut', label: 'وقت الانصراف', type: 'text' }, { key: 'notes', label: 'ملاحظات', type: 'text' },
          ]} columns={[
            { key: 'day', label: 'اليوم', value: (r) => r.day ?? '', render: (r) => fmtDate(r.day) }, { key: 'employee', label: 'الموظف', value: emp },
            { key: 'status', label: 'الحالة', value: (r) => lbl(ATT, r.status) }, { key: 'checkIn', label: 'حضور' }, { key: 'checkOut', label: 'انصراف' },
          ]} />
        </TabsContent>
        <TabsContent value="leaves">
          <EntityPage entity="leaves" title="إجازة" exportName="الإجازات" fields={[
            { key: 'employee', label: 'الموظف', type: 'ref', ref: 'employees', required: true }, { key: 'leaveType', label: 'نوع الإجازة', type: 'text', required: true, defaultValue: 'اعتيادية' },
            { key: 'fromDate', label: 'من', type: 'date', required: true }, { key: 'toDate', label: 'إلى', type: 'date', required: true },
            { key: 'status', label: 'الحالة', type: 'select', options: LEAVE, required: true, defaultValue: 'pending' }, { key: 'notes', label: 'ملاحظات', type: 'textarea' },
          ]} columns={[
            { key: 'employee', label: 'الموظف', value: emp }, { key: 'leaveType', label: 'النوع' }, { key: 'fromDate', label: 'من', render: (r) => fmtDate(r.fromDate) },
            { key: 'toDate', label: 'إلى', render: (r) => fmtDate(r.toDate) }, { key: 'status', label: 'الحالة', value: (r) => lbl(LEAVE, r.status) },
          ]} />
        </TabsContent>
        <TabsContent value="adj">
          <EntityPage entity="employeeAdjustments" title="حركة موظف" exportName="المكافآت والخصومات" fields={[
            { key: 'employee', label: 'الموظف', type: 'ref', ref: 'employees', required: true }, { key: 'adjustmentType', label: 'النوع', type: 'select', options: ADJ, required: true },
            { key: 'amount', label: 'المبلغ', type: 'money', required: true }, { key: 'month', label: 'يُحتسب في راتب شهر', type: 'month', required: true, defaultValue: monthStr() },
            { key: 'adjDate', label: 'التاريخ', type: 'date', defaultValue: todayStr() }, { key: 'description', label: 'البيان', type: 'text', required: true, full: true },
          ]} columns={[
            { key: 'employee', label: 'الموظف', value: emp }, { key: 'adjustmentType', label: 'النوع', value: (r) => lbl(ADJ, r.adjustmentType) },
            { key: 'amount', label: 'المبلغ', value: (r) => r.amount ?? 0, render: (r) => <span className="num">{fmtMoney(r.amount)}</span> }, { key: 'month', label: 'الشهر' }, { key: 'description', label: 'البيان' },
          ]} />
          <p className="mt-2 text-xs text-muted-foreground">السلفة تُخصم من راتب الشهر المحدد. لصرف مبلغ السلفة نقداً سجّل مصروفاً بند "سلف موظفين" من صفحة الحسابات.</p>
        </TabsContent>
        <TabsContent value="payroll"><Payroll /></TabsContent>
      </Tabs>
    </div>
  );
}
