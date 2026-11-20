import { zite } from 'zitejs/db';
import { first, num } from './core';
import { balanceOf } from './stock';

export async function requirements(productId: string, qty: number, warehouseId?: string) {
  const bom = await zite.bomLines.findAll({ filters: { product: productId }, limit: 500 });
  const ids = bom.records.map((b) => first(b.component)!).filter(Boolean);
  const items = ids.length ? (await zite.items.findAll({ filters: { id: { in: ids } }, limit: 500 })).records : [];
  const map = new Map(items.map((i) => [i.id, i] as const));
  const out: { itemId: string; name: string; code: string; unit: string; perUnit: number; wastePercent: number; required: number; available: number; unitCost: number; cost: number }[] = [];
  for (const b of bom.records) {
    const cid = first(b.component);
    if (!cid) continue;
    const it = map.get(cid);
    const required = Math.round(num(b.quantityPerUnit) * qty * (1 + num(b.wastePercent) / 100) * 1000) / 1000;
    const available = warehouseId ? await balanceOf(cid, warehouseId) : 0;
    out.push({
      itemId: cid, name: it?.name ?? '', code: it?.code ?? '', unit: it?.unit ?? '', perUnit: num(b.quantityPerUnit),
      wastePercent: num(b.wastePercent), required, available, unitCost: num(it?.unitCost),
      cost: Math.round(required * num(it?.unitCost) * 100) / 100,
    });
  }
  return out;
}
