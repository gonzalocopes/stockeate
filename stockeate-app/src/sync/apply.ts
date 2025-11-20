import AsyncStorage from "@react-native-async-storage/async-storage";
import { PullPayload } from "../api";
import { DB } from "../db"; // Asegúrate que la ruta sea correcta (ej: ../db.native)

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
  
  // 1) upsert de productos (Se ejecuta primero, como debe ser)
  if (payload.products) {
    console.log(`[Sync] Recibidos ${payload.products.length} productos para guardar.`);
    for (const p of payload.products) {
      DB.upsertProduct({
        id: p.id, // ID del servidor
        code: p.code,
        name: p.name ?? p.code,
        price: p.price ?? 0,
        branch_id: branchId,
        ...(payload.full && typeof p.stock === "number" ? { stock: p.stock } : {}),
        archived: (p as any).archived ?? 0
      });
    }
  }

  // 2) movimientos
  if (payload.stockMoves) {
    const applied = await loadAppliedMoveIds(branchId);
    let newApplied = false;

    for (const mv of payload.stockMoves) {
      if (mv.branchId !== branchId) continue;
      if (!mv.id || applied.has(mv.id)) continue;

      let p = DB.getProductByCode(mv.productCode);
      
      // --- 👇 LA CORRECCIÓN ESTÁ AQUÍ ---
      if (!p) {
        // Si el producto no se encontró (porque no vino en el payload.products),
        // no podemos procesar el movimiento. Lo saltamos.
        // NO CREAMOS UN PRODUCTO FANTASMA.
        console.warn(`[Sync] Saltando stock_move para el producto ${mv.productCode} no encontrado localmente.`);
        continue; // <-- Esta línea es la corrección
      }
      // --- FIN DE LA CORRECCIÓN ---

      applyStockDelta(p.id, mv.delta, branchId, mv.reason || "Sync");
      applied.add(mv.id);
      newApplied = true;
    }

    if (newApplied) {
      await saveAppliedMoveIds(branchId, applied);
    }
  }

  // 3) PODA local
  if (payload.full && payload.products) {
    const keepCodes = payload.products.map((p) => p.code);
    DB.pruneProductsNotIn(branchId, keepCodes);
  }

  // 4) Guardado de remitos
  if (payload.remitos) {
    console.log(`[Sync] Recibidos ${payload.remitos.length} remitos para guardar.`);
    for (const remito of payload.remitos) {
      DB.upsertRemito({
        id: remito.id,
        tmp_number: remito.tmpNumber,
        customer: remito.customer,
        customerCuit: remito.customerCuit,
        customerAddress: remito.customerAddress,
        customerTaxCondition: remito.customerTaxCondition,
        notes: remito.notes,
        created_at: remito.createdAt,
        branch_id: remito.branchId,
      });
    }
  }

  // 5) Guardado de items
  if (payload.remitoItems) {
    console.log(`[Sync] Recibidos ${payload.remitoItems.length} items de remito para guardar.`);
    for (const item of payload.remitoItems) {
      DB.upsertRemitoItem({
        id: item.id,
        remito_id: item.remitoId,
        product_id: item.productId,
        qty: item.qty,
        unit_price: item.unitPrice,
      });
    }
  }
}