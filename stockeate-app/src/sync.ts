// src/sync.ts
import { api } from "./api";
import { DB } from "./db.native";

/**
 * Descarga el catálogo de una sucursal desde la API
 * y lo mergea en la DB local (SQLite).
 */
export async function pullBranchCatalog(branchId: string) {
  if (!branchId) return;

  // Espera: GET /products?branchId=xxx => [{id, code, name, price, stock, branch_id, updated_at}]
  const { data } = await api.get("/products", { params: { branchId } });

  if (!Array.isArray(data)) return;

  for (const p of data) {
    DB.upsertProduct({
      id: p.id,
      code: p.code,
      name: p.name,
      price: p.price ?? 0,
      stock: p.stock ?? 0,
      branch_id: p.branch_id ?? branchId,
      // la función upsert ya setea updated_at
    });
  }
}
