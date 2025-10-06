const LS_KEYS = {
  products: "stk_products",
  moves: "stk_stock_moves",
  remitos: "stk_remitos",
  items: "stk_remito_items",
} as const;

type Prod = { id:string; code:string; name:string; price:number; stock:number; version:number; branch_id:string; updated_at?:string; archived?:number };
type Move = { id:string; product_id:string; branch_id:string; qty:number; type:string; ref?:string; created_at:string; synced?:number };
type Rem = { id:string; tmp_number?:string; official_number?:string|null; branch_id:string; customer?:string|null; notes?:string|null; created_at:string; synced?:number; pdf_path?:string|null };
type RItem = { id:string; remito_id:string; product_id:string; qty:number; unit_price:number };

function now(){ return new Date().toISOString(); }
function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }

function read<T>(k:string, def:T){ try{ const s=localStorage.getItem(k); return s? JSON.parse(s) as T : def; }catch{ return def; } }
function write<T>(k:string, v:T){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }

let PRODUCTS: Prod[] = [];
let MOVES: Move[] = [];
let REMITOS: Rem[] = [];
let RITEMS: RItem[] = [];

export function initDb(){
  PRODUCTS = read(LS_KEYS.products, [] as Prod[]);
  MOVES    = read(LS_KEYS.moves,    [] as Move[]);
  REMITOS  = read(LS_KEYS.remitos,  [] as Rem[]);
  RITEMS   = read(LS_KEYS.items,    [] as RItem[]);
}

function flush(){
  write(LS_KEYS.products, PRODUCTS);
  write(LS_KEYS.moves, MOVES);
  write(LS_KEYS.remitos, REMITOS);
  write(LS_KEYS.items, RITEMS);
}

export const DB = {
  getProductByCode(code:string){
    return PRODUCTS.find(p => p.code === code) ?? null;
  },
  upsertProduct(p:any){
    const i = PRODUCTS.findIndex(x => x.code === p.code);
    if (i >= 0){
      PRODUCTS[i] = { ...PRODUCTS[i], name: p.name ?? p.code, price: p.price ?? 0, stock: (typeof p.stock === "number" ? p.stock : PRODUCTS[i].stock), updated_at: now() };
      flush();
      return PRODUCTS[i];
    }
    const obj: Prod = { id: p.id ?? uid(), code: p.code, name: p.name ?? p.code, price: p.price ?? 0, stock: p.stock ?? 0, version: 0, branch_id: p.branch_id, updated_at: now(), archived: p.archived ?? 0 };
    PRODUCTS.push(obj); flush(); return obj;
  },
  incrementStock(productId:string, qty:number){
    const p = PRODUCTS.find(x => x.id === productId); if (!p) return;
    p.stock += qty; p.version += 1; p.updated_at = now(); flush();
  },
  insertRemito(data:any){
    const id = uid();
    const r: Rem = { id, tmp_number: data.tmp_number, official_number: data.official_number ?? null, branch_id: data.branch_id, customer: data.customer ?? null, notes: data.notes ?? null, created_at: now(), synced: 0, pdf_path: data.pdf_path ?? null };
    REMITOS.push(r); flush(); return id;
  },
  insertRemitoItem(data:any){
    const it: RItem = { id: uid(), remito_id: data.remito_id, product_id: data.product_id, qty: data.qty, unit_price: data.unit_price ?? 0 };
    RITEMS.push(it); flush();
  },
  insertStockMove(data:any){
    const m: Move = { id: uid(), product_id: data.product_id, branch_id: data.branch_id, qty: data.qty, type: data.type, ref: data.ref ?? null, created_at: now(), synced: 0 };
    MOVES.push(m); flush();
  },
  setRemitoPdfPath(remitoId: string, path: string){
    const r = REMITOS.find(x => x.id === remitoId); if (!r) return;
    r.pdf_path = path; flush();
  },
  getRemitoById(remitoId: string){
    return REMITOS.find(r => r.id === remitoId) ?? null;
  },
  getRemitoItems(remitoId: string){
    return RITEMS
      .filter(it => it.remito_id === remitoId)
      .map(it => ({ ...it, code: (PRODUCTS.find(p => p.id === it.product_id)?.code ?? ''), name: (PRODUCTS.find(p => p.id === it.product_id)?.name ?? '') }));
  },

  // ===== Activos / Archivados (web usamos la misma convención que nativo) =====
  listProductsByBranch(branch_id: string, search: string = "", limit = 200, offset = 0){
    const lower = search.trim().toLowerCase();
    const all = PRODUCTS.filter(p => p.branch_id === branch_id && (p.archived ?? 0) === 0);
    const filtered = lower ? all.filter(p => (p.code + " " + p.name).toLowerCase().includes(lower)) : all;
    const ordered = filtered.sort((a,b) => a.name.localeCompare(b.name));
    return ordered.slice(offset, offset + limit);
  },

  listArchivedByBranch(branch_id: string, search: string = "", limit = 200, offset = 0){
    const lower = search.trim().toLowerCase();
    const all = PRODUCTS.filter(p => p.branch_id === branch_id && (p.archived ?? 0) === 1);
    const filtered = lower ? all.filter(p => (p.code + " " + p.name).toLowerCase().includes(lower)) : all;
    const ordered = filtered.sort((a,b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
    return ordered.slice(offset, offset + limit);
  },

  updateProductNamePrice(productId: string, name: string, price: number){
    const i = PRODUCTS.findIndex(p => p.id === productId);
    if (i >= 0){
      PRODUCTS[i] = { ...PRODUCTS[i], name, price, version: (PRODUCTS[i].version ?? 0) + 1, updated_at: now() };
      flush();
      return PRODUCTS[i];
    }
    return null;
  },

  adjustStock(productId: string, branchId: string, delta: number, _reason: string = "Ajuste inventario"){
    const p = PRODUCTS.find(x => x.id === productId); if (!p) return null;
    p.stock += delta; p.version += 1; p.updated_at = now(); flush();
    MOVES.push({ id: uid(), product_id: productId, branch_id: branchId, qty: delta, type: "adjust", ref: _reason, created_at: now(), synced: 0 }); flush();
    return p;
  },

  setStockExact(productId: string, branchId: string, target: number, reason = "Fijar stock"){
    const p = PRODUCTS.find(x => x.id === productId); if (!p) return null;
    const delta = target - (p.stock ?? 0);
    p.stock = target; p.version += 1; p.updated_at = now(); flush();
    MOVES.push({ id: uid(), product_id: productId, branch_id: branchId, qty: delta, type: "set", ref: reason, created_at: now(), synced: 0 }); flush();
    return p;
  },

  canDeleteProduct(productId: string){
    const used = RITEMS.some(it => it.product_id === productId);
    return !used;
  },

  deleteProduct(productId: string){
    MOVES = MOVES.filter(m => m.product_id !== productId);
    PRODUCTS = PRODUCTS.filter(p => p.id !== productId);
    flush();
  },

  archiveProduct(productId: string){
    const i = PRODUCTS.findIndex(p => p.id === productId); if (i<0) return;
    PRODUCTS[i] = { ...PRODUCTS[i], archived: 1, updated_at: now(), version: (PRODUCTS[i].version ?? 0) + 1 };
    flush();
  },
  unarchiveProduct(productId: string){
    const i = PRODUCTS.findIndex(p => p.id === productId); if (i<0) return;
    PRODUCTS[i] = { ...PRODUCTS[i], archived: 0, updated_at: now(), version: (PRODUCTS[i].version ?? 0) + 1 };
    flush();
  },

  // ===== PRUNE para web =====
  pruneProductsNotIn(branchId: string, keepCodes: string[]){
    const toDelete = PRODUCTS
      .filter(p => p.branch_id === branchId && !keepCodes.includes(p.code))
      .map(p => p.id);

    if (toDelete.length === 0) return;

    // borrar dependencias locales
    RITEMS = RITEMS.filter(it => !toDelete.includes(it.product_id));
    MOVES  = MOVES.filter(m  => !toDelete.includes(m.product_id));
    PRODUCTS = PRODUCTS.filter(p => !toDelete.includes(p.id));
    flush();
  },
};
