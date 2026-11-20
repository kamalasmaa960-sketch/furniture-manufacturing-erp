import { z } from 'zod';
import { zite } from 'zitejs/db';
import type { Module } from './core';

const str = z.string().trim().max(500).optional();
const long = z.string().max(5000).optional();
const money = z.coerce.number().min(0).max(1e12).optional();
const id = z.string().uuid().optional();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional().or(z.literal('').transform(() => undefined));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export interface EntityDef {
  client: Client;
  module: Module;
  label: string;
  publicRead: boolean; // reference data any active user may read
  schema: z.ZodTypeAny;
  blockDeleteIfLinked?: string[]; // inverse link fields that must be empty to delete
}

export const ENTITIES: Record<string, EntityDef> = {
  warehouses: {
    client: zite.warehouses, module: 'inventory', label: 'المخازن', publicRead: true,
    schema: z.object({ name: z.string().trim().min(1).max(200), location: str, notes: long, active: z.boolean().optional() }),
    blockDeleteIfLinked: ['stockMovements', 'documents'],
  },
  suppliers: {
    client: zite.suppliers, module: 'purchases', label: 'الموردون', publicRead: true,
    schema: z.object({
      name: z.string().trim().min(1).max(200), phone: str, email: z.string().email().optional().or(z.literal('').transform(() => undefined)),
      address: str, taxNumber: str, openingBalance: money, notes: long,
    }),
    blockDeleteIfLinked: ['documents', 'transactions'],
  },
  customers: {
    client: zite.customers, module: 'sales', label: 'العملاء', publicRead: true,
    schema: z.object({
      name: z.string().trim().min(1).max(200), phone: str, email: z.string().email().optional().or(z.literal('').transform(() => undefined)),
      address: str, taxNumber: str, openingBalance: money, notes: long,
    }),
    blockDeleteIfLinked: ['documents', 'transactions'],
  },
  items: {
    client: zite.items, module: 'products', label: 'الأصناف', publicRead: true,
    schema: z.object({
      name: z.string().trim().min(1).max(200), code: z.string().trim().min(1).max(60),
      itemType: z.enum(['product', 'material']), category: str, productGroup: str, unit: str,
      size: str, color: str, material: str, salePrice: money, unitCost: money,
      minStock: z.coerce.number().min(0).optional(), description: long, supplier: id,
      active: z.boolean().optional(),
      image: z.array(z.string().url().refine((u) => /^https:\/\/(eu-)?uploads\.zite\.com\//.test(u), 'رابط صورة غير مسموح')).max(1).optional(),
    }),
    blockDeleteIfLinked: ['stockMovements', 'documentLines', 'productionOrders'],
  },
  bomLines: {
    client: zite.bomLines, module: 'products', label: 'مكونات المنتج', publicRead: true,
    schema: z.object({
      product: z.string().uuid(), component: z.string().uuid(),
      quantityPerUnit: z.coerce.number().positive(), wastePercent: z.coerce.number().min(0).max(100).optional(),
    }),
  },
  financeAccounts: {
    client: zite.financeAccounts, module: 'finance', label: 'الخزائن والبنوك', publicRead: true,
    schema: z.object({ name: z.string().trim().min(1).max(200), accountType: z.enum(['cash', 'bank']), openingBalance: money, accountNumber: str }),
    blockDeleteIfLinked: ['transactions'],
  },
  productionStages: {
    client: zite.productionStages, module: 'production', label: 'مراحل الإنتاج', publicRead: true,
    schema: z.object({ name: z.string().trim().min(1).max(100), sortOrder: z.coerce.number().int().min(0).max(1000) }),
  },
  employees: {
    client: zite.employees, module: 'hr', label: 'الموظفون', publicRead: false,
    schema: z.object({
      name: z.string().trim().min(1).max(200), jobTitle: str, department: str, phone: str,
      baseSalary: money, hireDate: date, active: z.boolean().optional(), notes: long,
    }),
    blockDeleteIfLinked: ['payslips', 'transactions'],
  },
  attendance: {
    client: zite.attendance, module: 'hr', label: 'الحضور', publicRead: false,
    schema: z.object({
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}/), employee: z.string().uuid(),
      status: z.enum(['present', 'absent', 'late', 'leave']), checkIn: str, checkOut: str, notes: str,
    }),
  },
  leaves: {
    client: zite.leaves, module: 'hr', label: 'الإجازات', publicRead: false,
    schema: z.object({
      leaveType: z.string().trim().min(1).max(100), employee: z.string().uuid(),
      fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/), toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
      status: z.enum(['pending', 'approved', 'rejected']), notes: long,
    }),
  },
  employeeAdjustments: {
    client: zite.employeeAdjustments, module: 'hr', label: 'المكافآت والخصومات والسلف', publicRead: false,
    schema: z.object({
      description: z.string().trim().min(1).max(200), employee: z.string().uuid(),
      adjustmentType: z.enum(['bonus', 'deduction', 'advance']), amount: z.coerce.number().positive(),
      month: z.string().regex(/^\d{4}-\d{2}$/), adjDate: date,
    }),
  },
};
