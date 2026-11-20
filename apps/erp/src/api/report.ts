import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { fail, num, requireAccess } from '../server/core';
import { customerBalances, supplierBalances } from '../server/finance';
import { inventoryValue, pnl, range } from '../server/analytics';

const REPORTS = ['sales', 'purchases', 'pnl', 'inventory', 'movements', 'production', 'product_cost', 'materials_consumed', 'waste', 'suppliers', 'customers', 'debts', 'payroll', 'cashflow'] as const;
type Col = { key: string; label: string; type?: 'money' | 'number' | 'text' };
type Row = Record<string, string | number>;

const DOC_LABEL: Record<string, string> = { sales_invoice: 'فاتورة بيع', sales_return: 'مرتجع مبيعات', purchase_invoice: 'فاتورة شراء', purchase_return: 'مرتجع مشتريات' };

async function docsReport(types: string[], from: string, to: string, partyLabel: string) {
  const r = await zite.sql({
    query: `SELECT d."number", d."docType", to_char(d."docDate",'YYYY-MM-DD') AS date, d."subtotal", d."discount", d."total", COALESCE(d."paid",0) AS paid,
        COALESCE(c."name", s."name") AS party, d."status"
      FROM "Documents" d
      LEFT JOIN "CustomersDocuments" cl ON cl."documentsId" = d.id LEFT JOIN "Customers" c ON c.id = cl."customersId"
      LEFT JOIN "DocumentsSuppliers" sl ON sl."documentsId" = d.id LEFT JOIN "Suppliers" s ON s.id = sl."suppliersId"
      WHERE d."stockPosted" = true AND d."docType" = ANY($1) AND d."docDate" >= $2::date AND d."docDate" <= $3::date
      ORDER BY d."docDate" DESC`,
    params: [types, from, to],
  });
  const cols: Col[] = [
    { key: 'number', label: 'الرقم' }, { key: 'type', label: 'النوع' }, { key: 'date', label: 'التاريخ' }, { key: 'party', label: partyLabel },
    { key: 'discount', label: 'الخصم', type: 'money' }, { key: 'total', label: 'الإجمالي', type: 'money' }, { key: 'paid', label: 'المدفوع', type: 'money' },
    { key: 'remaining', label: 'المتبقي', type: 'money' }, { key: 'status', label: 'الحالة' },
  ];
  const rows = r.rows.map((x) => ({
    number: String(x.number ?? ''), type: DOC_LABEL[String(x.docType)] ?? '', date: String(x.date ?? ''), party: String(x.party ?? ''),
    discount: num(x.discount), total: num(x.total), paid: num(x.paid), remaining: num(x.total) - num(x.paid), status: String(x.status ?? ''),
  }));
  return { cols, rows };
}

export default createEndpoint({
  description: 'Generates a report (sales, purchases, P&L, inventory, production, costs, debts, payroll...) for a period',
  inputSchema: z.object({ report: z.enum(REPORTS), from: z.string().optional(), to: z.string().optional() }),
  outputSchema: z.object({ title: z.string(), columns: z.array(z.object({ key: z.string(), label: z.string(), type: z.string().optional() })), rows: z.array(z.record(z.string(), z.union([z.string(), z.number()]))), totals: z.record(z.string(), z.number()) }),
  execute: async ({ input, context }) => {
    await requireAccess(context, 'reports');
    const { from, to } = range(input.from, input.to);
    let title = '';
    let cols: Col[] = [];
    let rows: Row[] = [];
    const p = [from, to];

    switch (input.report) {
      case 'sales': title = 'تقرير المبيعات'; ({ cols, rows } = await docsReport(['sales_invoice', 'sales_return'], from, to, 'العميل')); break;
      case 'purchases': title = 'تقرير المشتريات'; ({ cols, rows } = await docsReport(['purchase_invoice', 'purchase_return'], from, to, 'المورد')); break;
      case 'pnl': {
        title = 'تقرير الأرباح والخسائر';
        const x = await pnl(from, to);
        cols = [{ key: 'item', label: 'البند' }, { key: 'amount', label: 'المبلغ', type: 'money' }];
        rows = [
          { item: 'صافي المبيعات (بدون ضريبة)', amount: x.salesNet },
          { item: 'تكلفة البضاعة المباعة', amount: -x.cogs },
          { item: 'مجمل الربح', amount: x.grossProfit },
          { item: 'المصروفات', amount: -x.expenses },
          { item: 'الرواتب', amount: -x.salaries },
          { item: 'خسائر الهالك وعجز الجرد', amount: -x.losses },
          { item: 'إيرادات أخرى', amount: x.otherRevenue },
          { item: 'صافي الربح / الخسارة', amount: x.netProfit },
        ];
        return { title, columns: cols, rows, totals: {} };
      }
      case 'inventory': {
        title = 'تقرير المخزون';
        const inv = await inventoryValue();
        cols = [{ key: 'code', label: 'الكود' }, { key: 'name', label: 'الصنف' }, { key: 'type', label: 'النوع' }, { key: 'qty', label: 'الرصيد', type: 'number' }, { key: 'unit', label: 'الوحدة' }, { key: 'minStock', label: 'الحد الأدنى', type: 'number' }, { key: 'cost', label: 'متوسط التكلفة', type: 'money' }, { key: 'value', label: 'القيمة', type: 'money' }];
        rows = inv.map((i) => ({ code: i.code, name: i.name, type: i.itemType === 'product' ? 'منتج' : 'خامة', qty: i.qty, unit: i.unit, minStock: i.minStock, cost: i.cost, value: i.value }));
        break;
      }
      case 'movements':
      case 'waste':
      case 'materials_consumed': {
        title = input.report === 'movements' ? 'تقرير حركة المخازن' : input.report === 'waste' ? 'تقرير الهالك والتالف' : 'تقرير الخامات المستهلكة';
        const filter = input.report === 'waste' ? `AND m."movementType" IN ('هالك وتالف','تسوية جرد - عجز')` : input.report === 'materials_consumed' ? `AND m."movementType" = 'صرف للإنتاج'` : '';
        const r = await zite.sql({
          query: `SELECT to_char(m."movementDate",'YYYY-MM-DD') AS date, m."reference", m."movementType", i."name" AS item, wh."name" AS wh, m."qtyIn", m."qtyOut", m."unitCost", m."notes"
            FROM "StockMovements" m JOIN "ItemsStockMovements" l ON l."stockMovementsId" = m.id JOIN "Items" i ON i.id = l."itemsId"
            JOIN "StockMovementsWarehouses" w ON w."stockMovementsId" = m.id JOIN "Warehouses" wh ON wh.id = w."warehousesId"
            WHERE m."movementDate" >= $1::date AND m."movementDate" <= $2::date ${filter} ORDER BY m.created_at DESC LIMIT 2000`, params: p,
        });
        cols = [{ key: 'date', label: 'التاريخ' }, { key: 'reference', label: 'المرجع' }, { key: 'type', label: 'نوع الحركة' }, { key: 'item', label: 'الصنف' }, { key: 'wh', label: 'المخزن' }, { key: 'qtyIn', label: 'وارد', type: 'number' }, { key: 'qtyOut', label: 'منصرف', type: 'number' }, { key: 'value', label: 'القيمة', type: 'money' }, { key: 'notes', label: 'ملاحظات' }];
        rows = r.rows.map((x) => ({ date: String(x.date ?? ''), reference: String(x.reference ?? ''), type: String(x.movementType ?? ''), item: String(x.item ?? ''), wh: String(x.wh ?? ''), qtyIn: num(x.qtyIn), qtyOut: num(x.qtyOut), value: (num(x.qtyIn) + num(x.qtyOut)) * num(x.unitCost), notes: String(x.notes ?? '') }));
        break;
      }
      case 'production':
      case 'product_cost': {
        title = input.report === 'production' ? 'تقرير الإنتاج' : 'تقرير تكلفة المنتجات';
        const r = await zite.sql({
          query: `SELECT o."number", i."name" AS product, o."quantity", o."status", o."completedQty", o."rejectedQty", o."wasteQty", o."materialCost", o."laborCost", o."overheadCost",
              COALESCE(o."directExpenses",0) + COALESCE(o."indirectExpenses",0) AS expenses, o."totalCost", o."unitCost", COALESCE(i."salePrice",0) AS price, to_char(o."endDate",'YYYY-MM-DD') AS "endDate"
            FROM "ProductionOrders" o LEFT JOIN "ItemsProductionOrders" l ON l."productionOrdersId" = o.id LEFT JOIN "Items" i ON i.id = l."itemsId"
            WHERE o.created_at >= $1::date AND o.created_at < ($2::date + 1) ${input.report === 'product_cost' ? `AND o."status" = 'مكتمل'` : ''}
            ORDER BY o.created_at DESC`, params: p,
        });
        if (input.report === 'production') {
          cols = [{ key: 'number', label: 'الأمر' }, { key: 'product', label: 'المنتج' }, { key: 'quantity', label: 'المطلوب', type: 'number' }, { key: 'completedQty', label: 'المقبول', type: 'number' }, { key: 'rejectedQty', label: 'المرفوض', type: 'number' }, { key: 'wasteQty', label: 'الهالك', type: 'number' }, { key: 'status', label: 'الحالة' }, { key: 'endDate', label: 'تاريخ الانتهاء' }];
        } else {
          cols = [{ key: 'number', label: 'الأمر' }, { key: 'product', label: 'المنتج' }, { key: 'completedQty', label: 'الكمية', type: 'number' }, { key: 'materialCost', label: 'الخامات', type: 'money' }, { key: 'laborCost', label: 'العمالة', type: 'money' }, { key: 'overheadCost', label: 'التشغيل', type: 'money' }, { key: 'expenses', label: 'مصروفات مباشرة وغير مباشرة', type: 'money' }, { key: 'totalCost', label: 'إجمالي التكلفة', type: 'money' }, { key: 'unitCost', label: 'تكلفة الوحدة', type: 'money' }, { key: 'price', label: 'سعر البيع', type: 'money' }, { key: 'margin', label: 'هامش الربح %', type: 'number' }];
        }
        rows = r.rows.map((x) => ({
          number: String(x.number ?? ''), product: String(x.product ?? ''), quantity: num(x.quantity), status: String(x.status ?? ''), completedQty: num(x.completedQty),
          rejectedQty: num(x.rejectedQty), wasteQty: num(x.wasteQty), materialCost: num(x.materialCost), laborCost: num(x.laborCost), overheadCost: num(x.overheadCost),
          expenses: num(x.expenses), totalCost: num(x.totalCost), unitCost: num(x.unitCost), price: num(x.price), endDate: String(x.endDate ?? ''),
          margin: num(x.price) > 0 ? Math.round(((num(x.price) - num(x.unitCost)) / num(x.price)) * 1000) / 10 : 0,
        }));
        break;
      }
      case 'customers':
      case 'suppliers':
      case 'debts': {
        title = input.report === 'customers' ? 'تقرير العملاء' : input.report === 'suppliers' ? 'تقرير الموردين' : 'تقرير الديون والمستحقات';
        const list = input.report === 'customers' ? (await customerBalances()).map((x) => ({ ...x, kind: 'عميل' }))
          : input.report === 'suppliers' ? (await supplierBalances()).map((x) => ({ ...x, kind: 'مورد' }))
          : [...(await customerBalances()).map((x) => ({ ...x, kind: 'عميل (مدين لنا)' })), ...(await supplierBalances()).map((x) => ({ ...x, kind: 'مورد (دائن لنا)' }))].filter((x) => Math.abs(x.balance) > 0.009);
        cols = [{ key: 'name', label: 'الاسم' }, { key: 'kind', label: 'النوع' }, { key: 'phone', label: 'الهاتف' }, { key: 'opening', label: 'رصيد افتتاحي', type: 'money' }, { key: 'invoiced', label: 'صافي الفواتير', type: 'money' }, { key: 'paid', label: 'المسدد', type: 'money' }, { key: 'balance', label: 'الرصيد المستحق', type: 'money' }];
        rows = list.map((x) => ({ name: x.name, kind: x.kind, phone: x.phone, opening: x.opening, invoiced: x.invoiced, paid: x.paid, balance: x.balance }));
        break;
      }
      case 'payroll': {
        title = 'تقرير الموظفين والرواتب';
        const r = await zite.sql({
          query: `SELECT p."month", e."name", e."department", e."jobTitle", p."base", p."bonuses", p."deductions", p."advances", p."net", p."paid"
            FROM "Payslips" p JOIN "EmployeesPayslips" l ON l."payslipsId" = p.id JOIN "Employees" e ON e.id = l."employeesId"
            WHERE p."month" >= to_char($1::date,'YYYY-MM') AND p."month" <= to_char($2::date,'YYYY-MM') ORDER BY p."month" DESC, e."name"`, params: p,
        });
        cols = [{ key: 'month', label: 'الشهر' }, { key: 'name', label: 'الموظف' }, { key: 'department', label: 'القسم' }, { key: 'base', label: 'الأساسي', type: 'money' }, { key: 'bonuses', label: 'مكافآت', type: 'money' }, { key: 'deductions', label: 'خصومات', type: 'money' }, { key: 'advances', label: 'سلف', type: 'money' }, { key: 'net', label: 'الصافي', type: 'money' }, { key: 'paid', label: 'الحالة' }];
        rows = r.rows.map((x) => ({ month: String(x.month ?? ''), name: String(x.name ?? ''), department: String(x.department ?? ''), base: num(x.base), bonuses: num(x.bonuses), deductions: num(x.deductions), advances: num(x.advances), net: num(x.net), paid: x.paid ? 'مصروف' : 'غير مصروف' }));
        break;
      }
      case 'cashflow': {
        title = 'تقرير الإيرادات والمصروفات والتدفقات النقدية';
        const r = await zite.sql({
          query: `SELECT "category", COALESCE(SUM("amount") FILTER (WHERE "direction"='in'),0) AS "in", COALESCE(SUM("amount") FILTER (WHERE "direction"='out'),0) AS "out"
            FROM "Transactions" WHERE "txDate" >= $1::date AND "txDate" <= $2::date AND "category" <> 'تحويل بين الحسابات' GROUP BY 1 ORDER BY 1`, params: p,
        });
        cols = [{ key: 'category', label: 'البند' }, { key: 'in', label: 'مقبوضات', type: 'money' }, { key: 'out', label: 'مدفوعات', type: 'money' }, { key: 'net', label: 'الصافي', type: 'money' }];
        rows = r.rows.map((x) => ({ category: String(x.category ?? ''), in: num(x.in), out: num(x.out), net: num(x.in) - num(x.out) }));
        break;
      }
      default: fail('BAD_REQUEST', 'تقرير غير معروف');
    }
    const totals: Record<string, number> = {};
    for (const c of cols) if (c.type === 'money' || (c.type === 'number' && c.key !== 'margin' && c.key !== 'minStock')) totals[c.key] = rows.reduce((s, r) => s + num(r[c.key]), 0);
    return { title, columns: cols, rows, totals };
  },
});
