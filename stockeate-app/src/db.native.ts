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
      updated_at TEXT
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
    db.runSync(
      `INSERT INTO products(id, code, name, price, stock, version, branch_id, updated_at)
       VALUES(?,?,?,?,?,?,?,?)
       ON CONFLICT(code) DO UPDATE SET name=excluded.name, price=excluded.price, updated_at=excluded.updated_at`,
      [p.id ?? uid(), p.code, p.name ?? p.code, p.price ?? 0, p.stock ?? 0, p.version ?? 0, p.branch_id, now()]
    );
    return db.getFirstSync<any>("SELECT * FROM products WHERE code = ?", [p.code]);
  },
  incrementStock(productId: string, qty: number) {
    db.runSync("UPDATE products SET stock = stock + ?, version = version + 1, updated_at = ? WHERE id = ?", [qty, now(), productId]);
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
  // NUEVO:
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
};
