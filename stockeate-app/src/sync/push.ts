// src/sync/push.ts
import { api } from "../api";

/** Un único movimiento por CODE (delta puede ser + o -) */
export async function pushMoveByCode(
  branchId: string,
  productCode: string,
  delta: number,
  reason?: string
) {
  await api.post("/sync", {
    branchId,
    products: [],
    stockMoves: [
      { productCode, delta, reason: reason ?? "Ajuste" } // <- el backend resuelve code -> id
    ],
    remitos: [],
    remitoItems: [],
  });
}

/** Varios movimientos IN/OUT a la vez por code */
export async function pushMovesBatchByCodes(
  branchId: string,
  rows: { code: string; qty: number; reason?: string }[],
  type: "IN" | "OUT"
) {
  await api.post("/sync", {
    branchId,
    products: [],
    stockMoves: rows.map(r => ({
      productCode: r.code,
      type,
      qty: r.qty,
      reason: r.reason ?? null,
    })),
    remitos: [],
    remitoItems: [],
  });
}

/** Eliminar un producto de la sucursal por code */
export async function pushDeleteProduct(branchId: string, code: string) {
  await api.post("/sync", {
    branchId,
    deletes: [code],  // <- el backend borra y no volverá en pull
  });
}
