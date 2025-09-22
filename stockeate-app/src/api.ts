// src/api.ts
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Base URL: ENV o Render
const baseURL =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  "https://stockeate.onrender.com";

console.log("[API baseURL]", baseURL);

export const api = axios.create({
  baseURL,
  timeout: 30000,
});

// Token en cada request
api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem("token");
    if (token) {
      config.headers = {
        ...(config.headers ?? {}),
        Authorization: `Bearer ${token}`,
      };
    }
  } catch {}
  return config;
});

// ---------- Tipos de sync ----------
export type PullProduct = {
  code: string;
  name: string;
  price?: number;
  branch_id: string;
  updated_at?: number;
  stock?: number;
};

export type PullMove = {
  id: string;                 // id único de movimiento en el servidor
  productCode: string;
  branchId: string;
  delta: number;              // +IN / -OUT
  reason?: string;
  created_at?: number;
};

export type PullPayload = {
  clock: number;              // “reloj” del servidor (ej: Date.now())
  full: boolean;              // true si es snapshot completo
  products: PullProduct[];
  stockMoves: PullMove[];
};

// ---------- Utilidades ----------
export async function wakeServer() {
  try {
    await api.get("/health", { timeout: 5000 });
  } catch {
    try {
      await api.get("/branches", { timeout: 8000 });
    } catch {
      // ignoramos
    }
  }
}

// ---------- GET pull (con fallback si /sync/pull no existe) ----------
export async function pullFromServer(
  branchId: string,
  since?: number
): Promise<PullPayload> {
  // 1) Camino “ideal”: /sync/pull
  try {
    const { data } = await api.get<PullPayload>("/sync/pull", {
      params: { branchId, since },
    });
    return data;
  } catch (e: any) {
    const status = e?.response?.status;
    if (status && status !== 404) {
      // Si falló con un error real (no 404), propagamos
      throw e;
    }
  }

  // 2) Fallback: snapshot de productos con rutas comunes
  const products = await tryGetBranchProductsSnapshot(branchId);
  const payload: PullPayload = {
    clock: Date.now(),
    full: true,
    products,
    stockMoves: [],
  };
  return payload;
}

/**
 * Intenta varias rutas típicas para traer productos de una sucursal y
 * los normaliza al formato PullProduct. Si ninguna existe -> lanza error.
 */
async function tryGetBranchProductsSnapshot(branchId: string): Promise<PullProduct[]> {
  const candidates: Array<{ path: string; query?: boolean }> = [
    { path: `/branches/${encodeURIComponent(branchId)}/products` },
    { path: `/api/branches/${encodeURIComponent(branchId)}/products` },
    { path: `/products`, query: true },
    { path: `/api/products`, query: true },
  ];

  let raw: any = null;
  let ok = false;

  for (const c of candidates) {
    try {
      const url = c.query
        ? `${c.path}?branchId=${encodeURIComponent(branchId)}`
        : c.path;
      const { data } = await api.get(url, { timeout: 20000 });
      raw = data;
      ok = true;
      break;
    } catch (e: any) {
      const st = e?.response?.status;
      if (st && st !== 404) {
        // otro error (500, 401, etc.) -> abortamos con ese error
        throw e;
      }
      // 404 -> seguimos probando candidato siguiente
    }
  }

  if (!ok) {
    throw new Error("NO_COMPAT_PRODUCTS_ENDPOINT");
  }

  // Normalización
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
    ? raw.items
    : [];

  const norm: PullProduct[] = arr
    .map((r: any) => {
      const code =
        r?.code ??
        r?.codigo ??
        r?.barcode ??
        r?.sku ??
        r?.barras ??
        (r?.id ? String(r.id) : null);

      if (!code) return null;

      const name =
        r?.name ?? r?.nombre ?? r?.title ?? String(code);

      const priceRaw = r?.price ?? r?.precio ?? 0;
      const price = Number(priceRaw) || 0;

      const stockRaw = r?.stock ?? r?.qty ?? r?.quantity ?? 0;
      const stock = Number.isFinite(Number(stockRaw)) ? Number(stockRaw) : 0;

      return {
        code,
        name,
        price,
        branch_id: r?.branch_id ?? branchId,
        stock,
        updated_at: Number(r?.updated_at ?? r?.updatedAt ?? Date.now()),
      } as PullProduct;
    })
    .filter(Boolean) as PullProduct[];

  return norm;
}

// ---------- PUSH (con fallback si /sync no existe) ----------
export async function pushUpsertProducts(
  branchId: string,
  products: Array<{ code: string; name: string; price?: number }>
) {
  // 1) Intento con /sync
  try {
    await api.post("/sync", {
      branchId,
      products: products.map((p) => ({
        code: p.code,
        name: p.name,
        price: p.price ?? 0,
        branch_id: branchId,
      })),
      stockMoves: [],
      remitos: [],
      remitoItems: [],
    });
    return;
  } catch (e: any) {
    if (e?.response?.status && e.response.status !== 404) {
      // error real, no 404 -> dejamos el error visible
      throw e;
    }
  }

  // 2) Fallback bulk
  const bulkCandidates = [
    `/branches/${encodeURIComponent(branchId)}/products/bulk`,
    `/api/branches/${encodeURIComponent(branchId)}/products/bulk`,
    `/products/bulk`,
    `/api/products/bulk`,
  ];
  for (const p of bulkCandidates) {
    try {
      await api.post(p, { products }, { timeout: 20000 });
      return;
    } catch (e: any) {
      if (e?.response?.status && e.response.status !== 404) throw e;
    }
  }

  // 3) Último recurso: una a una (más lento)
  const singleCandidates = [
    `/branches/${encodeURIComponent(branchId)}/products`,
    `/api/branches/${encodeURIComponent(branchId)}/products`,
    `/products`,
    `/api/products`,
  ];
  for (const prod of products) {
    let saved = false;
    for (const p of singleCandidates) {
      try {
        await api.post(
          p,
          { ...prod, branch_id: branchId },
          { timeout: 20000 }
        );
        saved = true;
        break;
      } catch (e: any) {
        if (e?.response?.status && e.response.status !== 404) throw e;
      }
    }
    if (!saved) {
      console.log("⚠️ No pude subir el producto (fallback agotado):", prod.code);
    }
  }
}

export async function pushStockMoves(
  branchId: string,
  moves: Array<{ productCode: string; delta: number; reason?: string }>
) {
  // 1) Intento con /sync
  try {
    await api.post("/sync", {
      branchId,
      products: [],
      stockMoves: moves.map((m) => ({
        productCode: m.productCode,
        branchId,
        delta: m.delta,
        reason: m.reason ?? "Ajuste",
      })),
      remitos: [],
      remitoItems: [],
    });
    return;
  } catch (e: any) {
    if (e?.response?.status && e.response.status !== 404) throw e;
  }

  // 2) Fallback bulk movimientos
  const bulkCandidates = [
    `/branches/${encodeURIComponent(branchId)}/stock-moves/bulk`,
    `/api/branches/${encodeURIComponent(branchId)}/stock-moves/bulk`,
    `/stock-moves/bulk`,
    `/api/stock-moves/bulk`,
  ];
  for (const p of bulkCandidates) {
    try {
      await api.post(p, { moves }, { timeout: 20000 });
      return;
    } catch (e: any) {
      if (e?.response?.status && e.response.status !== 404) throw e;
    }
  }

  // 3) Último recurso: uno por uno
  const singleCandidates = [
    `/branches/${encodeURIComponent(branchId)}/stock-moves`,
    `/api/branches/${encodeURIComponent(branchId)}/stock-moves`,
    `/stock-moves`,
    `/api/stock-moves`,
  ];
  for (const mv of moves) {
    let saved = false;
    for (const p of singleCandidates) {
      try {
        await api.post(
          p,
          {
            productCode: mv.productCode,
            branchId,
            delta: mv.delta,
            reason: mv.reason ?? "Ajuste",
          },
          { timeout: 20000 }
        );
        saved = true;
        break;
      } catch (e: any) {
        if (e?.response?.status && e.response.status !== 404) throw e;
      }
    }
    if (!saved) {
      console.log(
        "⚠️ No pude subir el movimiento (fallback agotado):",
        mv.productCode,
        mv.delta
      );
    }
  }
}
