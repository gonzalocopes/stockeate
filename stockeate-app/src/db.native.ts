import * as SQLite from "expo-sqlite";
const db = SQLite.openDatabaseSync("stockeate.db");

export function initDb() {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS products(
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      price REAL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      version INTEGER DEFAULT 0,
      branch_id TEXT NOT NULL,
      updated_at TEXT,
      archived INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS stock_moves(
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      qty INTEGER NOT NULL,
      type TEXT NOT NULL,
      ref TEXT,
      created_at TEXT NOT NULL,
      synced INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS remitos(
      id TEXT PRIMARY KEY,
      tmp_number TEXT UNIQUE,
      official_number TEXT,
      branch_id TEXT NOT NULL,
      customer TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      synced INTEGER DEFAULT 0,
      pdf_path TEXT
    );
    CREATE TABLE IF NOT EXISTS remito_items(
      id TEXT PRIMARY KEY,
      remito_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      qty INTEGER NOT NULL,
      unit_price REAL DEFAULT 0
    );
  `);
}

const now = () => new Date().toISOString();
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export const DB = {
  getProductByCode(code: string) {
    return db.getFirstSync<any>("SELECT * FROM products WHERE code = ?", [code]) ?? null;
  },

upsertProduct(p: any) {
    const incomingVersion = p.version ?? 0;
    
    db.runSync(
      `INSERT INTO products(id, code, name, price, stock, version, branch_id, updated_at, archived)
       VALUES(?,?,?,?,?,?,?,?,?)
       ON CONFLICT(code) DO UPDATE SET
         -- Solo actualiza nombre/precio si la versión entrante es MAYOR
         name = CASE WHEN excluded.version > products.version THEN excluded.name ELSE products.name END,
         price = CASE WHEN excluded.version > products.version THEN excluded.price ELSE products.price END,
         
         -- El stock SOLO se actualiza si la versión entrante es MAYOR o IGUAL
         -- y si el stock entrante NO es NULL (para respetar la lógica del applyPull)
         stock = CASE WHEN excluded.version >= products.version AND excluded.stock IS NOT NULL THEN excluded.stock ELSE products.stock END,
         
         -- La versión SIEMPRE se actualiza a la versión más reciente
         version = CASE WHEN excluded.version > products.version THEN excluded.version ELSE products.version END,

         updated_at = excluded.updated_at,
         archived = excluded.archived
       WHERE products.code = excluded.code`,
      // Nota: El valor 'p.stock' debe ser null (o undefined) si no se pasa,
      // pero en este caso, al ser un snapshot, asumimos que viene un número.
      // Aquí estamos forzando 'p.stock ?? null' para que COALESCE trabaje mejor.
      [p.id ?? uid(), p.code, p.name ?? p.code, p.price ?? 0, p.stock ?? null, incomingVersion, p.branch_id, now(), p.archived ?? 0]
    );
    return db.getFirstSync<any>("SELECT * FROM products WHERE code = ?", [p.code]);
  },

  incrementStock(productId: string, qty: number) {
    db.runSync(
      "UPDATE products SET stock = stock + ?, version = version + 1, updated_at = ? WHERE id = ?",
      [qty, now(), productId]
    );
  },

  insertRemito(data: any) {
    const id = uid();
    db.runSync(
      `INSERT INTO remitos(id,tmp_number,official_number,branch_id,customer,notes,created_at,synced,pdf_path)
       VALUES(?,?,?,?,?,?,?,?,?)`,
      [id, data.tmp_number, data.official_number ?? null, data.branch_id, data.customer ?? null, data.notes ?? null, now(), 0, data.pdf_path ?? null]
    );
    return id;
  },

  insertRemitoItem(data: any) {
    db.runSync(
      `INSERT INTO remito_items(id,remito_id,product_id,qty,unit_price) VALUES(?,?,?,?,?)`,
      [uid(), data.remito_id, data.product_id, data.qty, data.unit_price ?? 0]
    );
  },

  insertStockMove(data: any) {
    db.runSync(
      `INSERT INTO stock_moves(id,product_id,branch_id,qty,type,ref,created_at,synced) VALUES(?,?,?,?,?,?,?,0)`,
      [uid(), data.product_id, data.branch_id, data.qty, data.type, data.ref ?? null, now()]
    );
  },

  // PDF helpers
  setRemitoPdfPath(remitoId: string, path: string) {
    db.runSync(`UPDATE remitos SET pdf_path=? WHERE id=?`, [path, remitoId]);
  },
  getRemitoById(remitoId: string) {
    return db.getFirstSync<any>("SELECT * FROM remitos WHERE id=?", [remitoId]) ?? null;
  },
  getRemitoItems(remitoId: string) {
    return db.getAllSync<any>(
      `SELECT ri.*, p.code, p.name FROM remito_items ri
       JOIN products p ON p.id=ri.product_id
       WHERE ri.remito_id=?`,
      [remitoId]
    );
  },

  // ===== Activos / Archivados =====
  listProductsByBranch(branchId: string, search: string = "", limit = 200, offset = 0) {
    const q = `%${search.trim()}%`;
    if (search.trim()) {
      return db.getAllSync<any>(
        `SELECT * FROM products
         WHERE branch_id=? AND archived=0 AND (code LIKE ? OR name LIKE ?)
         ORDER BY name ASC
         LIMIT ? OFFSET ?`,
        [branchId, q, q, limit, offset]
      );
    }
    return db.getAllSync<any>(
      `SELECT * FROM products
       WHERE branch_id=? AND archived=0
       ORDER BY name ASC
       LIMIT ? OFFSET ?`,
      [branchId, limit, offset]
    );
  },

  listArchivedByBranch(branchId: string, search: string = "", limit = 200, offset = 0) {
    const q = `%${search.trim()}%`;
    if (search.trim()) {
      return db.getAllSync<any>(
        `SELECT * FROM products
         WHERE branch_id=? AND archived=1 AND (code LIKE ? OR name LIKE ?)
         ORDER BY updated_at DESC
         LIMIT ? OFFSET ?`,
        [branchId, q, q, limit, offset]
      );
    }
    return db.getAllSync<any>(
      `SELECT * FROM products
       WHERE branch_id=? AND archived=1
       ORDER BY updated_at DESC
       LIMIT ? OFFSET ?`,
      [branchId, limit, offset]
    );
  },

  updateProductNamePrice(productId: string, name: string, price: number) {
    db.runSync(
      `UPDATE products SET name=?, price=?, version=version+1, updated_at=? WHERE id=?`,
      [name, price, now(), productId]
    );
    return db.getFirstSync<any>("SELECT * FROM products WHERE id=?", [productId]);
  },

  adjustStock(productId: string, branchId: string, delta: number, reason: string = "Ajuste inventario") {
    db.runSync(
      "UPDATE products SET stock = stock + ?, version = version + 1, updated_at=? WHERE id=?",
      [delta, now(), productId]
    );
    db.runSync(
      `INSERT INTO stock_moves(id,product_id,branch_id,qty,type,ref,created_at,synced) VALUES(?,?,?,?,?,?,?,0)`,
      [uid(), productId, branchId, delta, "adjust", reason, now()]
    );
    return db.getFirstSync<any>("SELECT * FROM products WHERE id=?", [productId]);
  },

  setStockExact(productId: string, branchId: string, target: number, reason = "Fijar stock") {
    const cur = db.getFirstSync<any>("SELECT stock FROM products WHERE id=?", [productId]);
    const current = Number(cur?.stock ?? 0);
    const delta = target - current;
    db.runSync(
      "UPDATE products SET stock = ?, version = version + 1, updated_at=? WHERE id=?",
      [target, now(), productId]
    );
    db.runSync(
      `INSERT INTO stock_moves(id,product_id,branch_id,qty,type,ref,created_at,synced) VALUES(?,?,?,?,?,?,?,0)`,
      [uid(), productId, branchId, delta, "set", reason, now()]
    );
    return db.getFirstSync<any>("SELECT * FROM products WHERE id=?", [productId]);
  },

  canDeleteProduct(productId: string): boolean {
    const r = db.getFirstSync<any>(`SELECT COUNT(*) as cnt FROM remito_items WHERE product_id=?`, [productId]);
    return Number(r?.cnt ?? 0) === 0;
  },

  deleteProduct(productId: string) {
    db.runSync(`DELETE FROM stock_moves WHERE product_id=?`, [productId]);
    db.runSync(`DELETE FROM products WHERE id=?`, [productId]);
  },

  archiveProduct(productId: string) {
    db.runSync(`UPDATE products SET archived=1, updated_at=?, version=version+1 WHERE id=?`, [now(), productId]);
  },
  unarchiveProduct(productId: string) {
    db.runSync(`UPDATE products SET archived=0, updated_at=?, version=version+1 WHERE id=?`, [now(), productId]);
  },

  // ===== PRUNE: borrar todo lo que no venga del server para esa sucursal =====
  pruneProductsNotIn(branchId: string, keepCodes: string[]) {
    // buscamos IDs a borrar
    let rows: any[] = [];
    if (keepCodes.length > 0) {
      const placeholders = keepCodes.map(() => "?").join(",");
      rows = db.getAllSync<any>(
        `SELECT id FROM products WHERE branch_id=? AND code NOT IN (${placeholders})`,
        [branchId, ...keepCodes]
      );
    } else {
      rows = db.getAllSync<any>(
        `SELECT id FROM products WHERE branch_id=?`,
        [branchId]
      );
    }
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return;

    const ph = ids.map(() => "?").join(",");

    // borrar dependencias locales para no dejar basura
    try { db.runSync(`DELETE FROM remito_items WHERE product_id IN (${ph})`, ids); } catch {}
    try { db.runSync(`DELETE FROM stock_moves WHERE product_id IN (${ph})`, ids); } catch {}

    // borrar productos
    db.runSync(`DELETE FROM products WHERE id IN (${ph})`, ids);
  },
};
