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
      customer_cuit TEXT,
      customer_address TEXT,
      customer_tax_condition TEXT,
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

  // 🔄 Migraciones suaves para dispositivos que ya tenían la tabla `remitos` vieja
  const migrations = [
    `ALTER TABLE remitos ADD COLUMN customer_cuit TEXT`,
    `ALTER TABLE remitos ADD COLUMN customer_address TEXT`,
    `ALTER TABLE remitos ADD COLUMN customer_tax_condition TEXT`,
    `ALTER TABLE remitos ADD COLUMN notes TEXT`,
    `ALTER TABLE remitos ADD COLUMN official_number TEXT`,
    `ALTER TABLE remitos ADD COLUMN synced INTEGER DEFAULT 0`,
    `ALTER TABLE remitos ADD COLUMN pdf_path TEXT`,
  ];

  for (const sql of migrations) {
    try {
      db.execSync(sql);
    } catch {
      // Si la columna ya existe, SQLite tira "duplicate column name" y lo ignoramos
    }
  }
}

const now = () => new Date().toISOString();
const uid = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

export const DB = {
  getProductByCode(code: string) {
    return (
      db.getFirstSync<any>(
        "SELECT * FROM products WHERE code = ?",
        [code]
      ) ?? null
    );
  },

  // --- 👇 FUNCIÓN 'upsertProduct' CORREGIDA Y SANEADA ---
  upsertProduct(p: any) {
    // Si no hay código, no intentamos guardar ese producto
    if (!p?.code) {
      console.warn(
        "Producto sin código recibido en upsertProduct, se ignora:",
        p
      );
      return null;
    }

    const code = p.code.toString();

    // 1) Buscamos si ya existe un producto con ese CODE
    const existing = db.getFirstSync<any>(
      "SELECT id FROM products WHERE code = ?",
      [code]
    );

    // 2) Si existe, usamos ese id; si no, usamos el del servidor o generamos uno
    const id = (
      existing?.id ??
      p.id ??
      uid()
    ).toString();

    const name = (p.name ?? code).toString();
    const price = Number.isFinite(Number(p.price))
      ? Number(p.price)
      : 0;
    const stock = Number.isFinite(Number(p.stock))
      ? Number(p.stock)
      : 0;
    const version = Number.isFinite(Number(p.version))
      ? Number(p.version)
      : 0;

    const branchId = (
      p.branch_id ??
      p.branchId ??
      p.branch ??
      ""
    ).toString();

    const archived = Number(p.archived ?? 0) ? 1 : 0;

    try {
      db.runSync(
        `INSERT INTO products(id, code, name, price, stock, version, branch_id, updated_at, archived)
         VALUES(?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET 
           code=excluded.code,
           name=excluded.name, 
           price=excluded.price, 
           stock=COALESCE(excluded.stock, products.stock), 
           updated_at=excluded.updated_at,
           archived=COALESCE(excluded.archived, products.archived)`,
        [id, code, name, price, stock, version, branchId, now(), archived]
      );
    } catch (e: any) {
      // Si llegara a quedar algún caso raro, todavía hacemos fallback por code
      console.error(
        `Error guardando producto ${code} (ID: ${id}):`,
        e?.message ?? String(e)
      );
      if ((e?.message ?? "").includes("UNIQUE constraint failed: products.code")) {
        db.runSync(
          `UPDATE products SET name=?, price=?, stock=COALESCE(?, stock), updated_at=?, archived=COALESCE(?, archived) WHERE code = ?`,
          [name, price, stock, now(), archived, code]
        );
      }
    }
    return db.getFirstSync<any>("SELECT * FROM products WHERE id = ?", [
      id,
    ]);
  },
  // --- FIN DE LA ACTUALIZACIÓN ---

  incrementStock(productId: string, qty: number) {
    db.runSync(
      "UPDATE products SET stock = stock + ?, version = version + 1, updated_at = ? WHERE id = ?",
      [qty, now(), productId]
    );
  },

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
        data.customer_cuit ?? null,
        data.customer_address ?? null,
        data.customer_tax_condition ?? null,
        data.notes ?? null,
        now(),
        0,
        data.pdf_path ?? null,
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
    return (
      db.getFirstSync<any>(
        "SELECT * FROM remitos WHERE id=?",
        [remitoId]
      ) ?? null
    );
  },

  // --- 👇 JOIN para ver nombres en remitos ---
  getRemitoItems(remitoId: string) {
    return db.getAllSync<any>(
      `SELECT ri.*, p.code, p.name 
       FROM remito_items ri
       LEFT JOIN products p ON p.id = ri.product_id
       WHERE ri.remito_id = ?`,
      [remitoId]
    );
  },

  listProductsByBranch(
    branchId: string,
    search: string = "",
    limit = 200,
    offset = 0
  ) {
    if (!branchId) return [];

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

  listArchivedByBranch(
    branchId: string,
    search: string = "",
    limit = 200,
    offset = 0
  ) {
    if (!branchId) return [];

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
    return db.getFirstSync<any>(
      "SELECT * FROM products WHERE id=?",
      [productId]
    );
  },

  adjustStock(
    productId: string,
    branchId: string,
    delta: number,
    reason: string = "Ajuste inventario"
  ) {
    db.runSync(
      "UPDATE products SET stock = stock + ?, version = version + 1, updated_at=? WHERE id=?",
      [delta, now(), productId]
    );
    db.runSync(
      `INSERT INTO stock_moves(id,product_id,branch_id,qty,type,ref,created_at,synced) VALUES(?,?,?,?,?,?,?,0)`,
      [uid(), productId, branchId, delta, "adjust", reason, now()]
    );
    return db.getFirstSync<any>(
      "SELECT * FROM products WHERE id=?",
      [productId]
    );
  },

  setStockExact(
    productId: string,
    branchId: string,
    target: number,
    reason = "Fijar stock"
  ) {
    const cur = db.getFirstSync<any>(
      "SELECT stock FROM products WHERE id=?",
      [productId]
    );
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
    return db.getFirstSync<any>(
      "SELECT * FROM products WHERE id=?",
      [productId]
    );
  },

  canDeleteProduct(productId: string): boolean {
    const r = db.getFirstSync<any>(
      `SELECT COUNT(*) as cnt FROM remito_items WHERE product_id=?`,
      [productId]
    );
    return Number(r?.cnt ?? 0) === 0;
  },

  deleteProduct(productId: string) {
    db.runSync(
      `DELETE FROM stock_moves WHERE product_id=?`,
      [productId]
    );
    db.runSync(`DELETE FROM products WHERE id=?`, [productId]);
  },

  archiveProduct(productId: string) {
    db.runSync(
      `UPDATE products SET archived=1, updated_at=?, version=version+1 WHERE id=?`,
      [now(), productId]
    );
  },
  unarchiveProduct(productId: string) {
    db.runSync(
      `UPDATE products SET archived=0, updated_at=?, version=version+1 WHERE id=?`,
      [now(), productId]
    );
  },

  pruneProductsNotIn(branchId: string, keepCodes: string[]) {
    if (!branchId) return;

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
    try {
      db.runSync(
        `DELETE FROM remito_items WHERE product_id IN (${ph})`,
        ids
      );
    } catch {}
    try {
      db.runSync(
        `DELETE FROM stock_moves WHERE product_id IN (${ph})`,
        ids
      );
    } catch {}
    db.runSync(
      `DELETE FROM products WHERE id IN (${ph})`,
      ids
    );
  },

  // --- 👇 FUNCIONES DE SINCRONIZACIÓN (RESTAURADAS) ---
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
          r.customerCuit ?? null,
          r.customerAddress ?? null,
          r.customerTaxCondition ?? null,
          r.notes ?? null,
          r.created_at,
          r.branch_id,
        ]
      );
    } catch {
      // Silenciamos errores de sync para no romper la UI
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
        [
          item.id,
          item.remito_id,
          item.product_id,
          item.qty,
          item.unit_price ?? 0,
        ]
      );
    } catch {
      // Silenciamos errores de sync para no romper la UI
    }
  },
};
