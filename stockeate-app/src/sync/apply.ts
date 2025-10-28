// src/sync/apply.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PullPayload } from "../api";
import { DB } from "../db";

// (dedupe de movimientos por ID)
async function loadAppliedMoveIds(branchId: string): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(`applied_moves:${branchId}`);
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}
async function saveAppliedMoveIds(branchId: string, ids: Set<string>) {
  const MAX = 5000;
  const arr = Array.from(ids);
  const sliced = arr.slice(Math.max(0, arr.length - MAX));
  await AsyncStorage.setItem(`applied_moves:${branchId}`, JSON.stringify(sliced));
}

function applyStockDelta(productId: string, delta: number, branchId: string, reason: string) {
  const anyDB: any = DB as any;
  if (delta >= 0) {
    if (typeof anyDB.incrementStock === "function") {
      anyDB.incrementStock(productId, delta);
    } else {
      anyDB.setStock?.(productId, (anyDB.getStock?.(productId) ?? 0) + delta);
    }
    DB.insertStockMove({ product_id: productId, branch_id: branchId, qty: delta, type: "IN", ref: reason });
  } else {
    const qty = Math.abs(delta);
    if (typeof anyDB.decrementStock === "function") {
      anyDB.decrementStock(productId, qty);
    } else if (typeof anyDB.incrementStock === "function") {
      anyDB.incrementStock(productId, -qty);
    } else {
      anyDB.setStock?.(productId, (anyDB.getStock?.(productId) ?? 0) - qty);
    }
    DB.insertStockMove({ product_id: productId, branch_id: branchId, qty, type: "OUT", ref: reason });
  }
}

export async function applyPull(branchId: string, payload: PullPayload) {
  // 1) upsert de productos (si viene snapshot, fijamos stock)
  for (const p of payload.products) {
    DB.upsertProduct({
      code: p.code,
      name: p.name ?? p.code,
      price: p.price ?? 0,
      branch_id: branchId,
      ...(payload.full && typeof p.stock === "number" ? { stock: p.stock } : {}),
    });
  }

  // 2) movimientos (dedupe por id)
  const applied = await loadAppliedMoveIds(branchId);
  let newApplied = false;

  for (const mv of payload.stockMoves) {
    if (mv.branchId !== branchId) continue;
    if (!mv.id || applied.has(mv.id)) continue;

    let p = DB.getProductByCode(mv.productCode);
    if (!p) {
      p = DB.upsertProduct({
        code: mv.productCode,
        name: mv.productCode,
        price: 0,
        branch_id: branchId,
        stock: 0,
      });
    }

    applyStockDelta(p.id, mv.delta, branchId, mv.reason || "Sync");
    applied.add(mv.id);
    newApplied = true;
  }

  if (newApplied) {
    await saveAppliedMoveIds(branchId, applied);
  }

  // 3) 👇 PODA local cuando el payload es snapshot completo
  if (payload.full) {
    const keepCodes = payload.products.map((p) => p.code);
    DB.pruneProductsNotIn(branchId, keepCodes);
  }
}
