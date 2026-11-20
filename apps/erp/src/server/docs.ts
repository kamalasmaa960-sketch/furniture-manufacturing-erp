import type { Module } from './core';

export const DOC_TYPES = ['purchase_order', 'purchase_invoice', 'purchase_return', 'quote', 'sales_order', 'sales_invoice', 'sales_return'] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_META: Record<DocType, { label: string; prefix: string; module: Module; party: 'customer' | 'supplier'; stock?: { dir: 'in' | 'out'; type: string } }> = {
  purchase_order: { label: 'طلب شراء', prefix: 'PO', module: 'purchases', party: 'supplier' },
  purchase_invoice: { label: 'فاتورة شراء', prefix: 'PI', module: 'purchases', party: 'supplier', stock: { dir: 'in', type: 'شراء' } },
  purchase_return: { label: 'مرتجع مشتريات', prefix: 'PR', module: 'purchases', party: 'supplier', stock: { dir: 'out', type: 'مرتجع مشتريات' } },
  quote: { label: 'عرض سعر', prefix: 'QT', module: 'sales', party: 'customer' },
  sales_order: { label: 'طلب بيع', prefix: 'SO', module: 'sales', party: 'customer' },
  sales_invoice: { label: 'فاتورة بيع', prefix: 'SI', module: 'sales', party: 'customer', stock: { dir: 'out', type: 'بيع' } },
  sales_return: { label: 'مرتجع مبيعات', prefix: 'SR', module: 'sales', party: 'customer', stock: { dir: 'in', type: 'مرتجع مبيعات' } },
};

export const CONVERSIONS: Partial<Record<DocType, DocType[]>> = {
  quote: ['sales_order', 'sales_invoice'],
  sales_order: ['sales_invoice'],
  sales_invoice: ['sales_return'],
  purchase_order: ['purchase_invoice'],
  purchase_invoice: ['purchase_return'],
};

export const isPostable = (t: DocType) => !!DOC_META[t].stock;
