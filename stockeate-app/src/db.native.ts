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
      -- 👇 CAMPOS NUEVOS AÑADIDOS
      customer_cuit TEXT,
      customer_address TEXT,
      customer_tax_condition TEXT,
      -- 👆 FIN CAMPOS NUEVOS
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
    db.runSync(
      `INSERT INTO products(id, code, name, price, stock, version, branch_id, updated_at, archived)
       VALUES(?,?,?,?,?,?,?,?,?)
       ON CONFLICT(code) DO UPDATE SET name=excluded.name, price=excluded.price, stock=COALESCE(excluded.stock, products.stock), updated_at=excluded.updated_at, archived=COALESCE(excluded.archived, products.archived)`,
      [p.id ?? uid(), p.code, p.name ?? p.code, p.price ?? 0, p.stock ?? 0, p.version ?? 0, p.branch_id, now(), p.archived ?? 0]
    );
    return db.getFirstSync<any>("SELECT * FROM products WHERE code = ?", [p.code]);
  },

  incrementStock(productId: string, qty: number) {
    db.runSync(
      "UPDATE products SET stock = stock + ?, version = version + 1, updated_at = ? WHERE id = ?",
      [qty, now(), productId]
    );
  },

  // 👇 ACTUALIZADO CON NUEVOS CAMPOS
  insertRemito(data: any) {
    const id = uid();
    db.runSync(
      `INSERT INTO remitos(id, tmp_number, official_number, branch_id, customer, customer_cuit, customer_address, customer_tax_condition, notes, created_at, synced, pdf_path)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        data.tmp_number,
        data.official_number ?? null,
        data.branch_id,
        data.customer ?? null,
        data.customer_cuit ?? null,         // Nuevo
        data.customer_address ?? null,      // Nuevo
        data.customer_tax_condition ?? null,// Nuevo
        data.notes ?? null,
        now(),
        0,
        data.pdf_path ?? null
      ]
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

  pruneProductsNotIn(branchId: string, keepCodes: string[]) {
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
    try { db.runSync(`DELETE FROM remito_items WHERE product_id IN (${ph})`, ids); } catch {}
    try { db.runSync(`DELETE FROM stock_moves WHERE product_id IN (${ph})`, ids); } catch {}
    db.runSync(`DELETE FROM products WHERE id IN (${ph})`, ids);
  },

  // --- 👇 FUNCIONES DE SINCRONIZACIÓN RESTAURADAS Y ACTUALIZADAS ---
  
  upsertRemito(r: any) {
    try {
      db.runSync(
        `INSERT INTO remitos(id, tmp_number, customer, customer_cuit, customer_address, customer_tax_condition, notes, created_at, branch_id)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           tmp_number=excluded.tmp_number,
           customer=excluded.customer,
           customer_cuit=excluded.customer_cuit,
           customer_address=excluded.customer_address,
           customer_tax_condition=excluded.customer_tax_condition,
           notes=excluded.notes`,
        [
          r.id,
          r.tmp_number,
          r.customer ?? null,
          r.customerCuit ?? null,         // Mapeo de camelCase (API) a la columna
          r.customerAddress ?? null,
          r.customerTaxCondition ?? null,
          r.notes ?? null,
          r.created_at,
          r.branch_id
        ]
      );
    } catch (e) {
      console.error(`Error guardando remito ${r.id}:`, e);
    }
  },

  upsertRemitoItem(item: any) {
    try {
      db.runSync(
        `INSERT INTO remito_items(id, remito_id, product_id, qty, unit_price)
         VALUES(?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           qty=excluded.qty,
           unit_price=excluded.unit_price`,
        [item.id, item.remito_id, item.product_id, item.qty, item.unit_price ?? 0]
      );
    } catch (e) {
      console.error(`Error guardando item ${item.id}:`, e);
    }
  },
};