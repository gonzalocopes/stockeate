// src/sync/push.ts
import { api } from "../api";
import { DB } from "../db.native";

export async function pushMoveByCode(branchId: string, productCode: string, delta: number, reason?: string) {
  const p = DB.getProductByCode(productCode);
  if (!p) throw new Error(`Producto no encontrado por code=${productCode}`);
  const type = delta >= 0 ? "IN" : "OUT";
  const qty  = Math.abs(delta);

  await api.post("/sync", {
    branchId,
    products: [],
    stockMoves: [{ productId: p.id, type, qty, ref: reason ?? null }],
    remitos: [],
    remitoItems: [],
  });
}

export async function pushMovesBatchByCodes(branchId: string, items: Array<{ code: string; qty: number; reason?: string }>, type: "IN"|"OUT") {
  const stockMoves: any[] = [];
  for (const it of items) {
    const p = DB.getProductByCode(it.code);
    if (!p) continue;
    stockMoves.push({ productId: p.id, type, qty: Math.abs(it.qty), ref: it.reason ?? null });
  }
  if (stockMoves.length === 0) return;
  await api.post("/sync", { branchId, products: [], stockMoves, remitos: [], remitoItems: [] });
}
