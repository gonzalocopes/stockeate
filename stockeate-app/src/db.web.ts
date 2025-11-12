// src/db.web.ts - Implementación web usando localStorage
export function initDb() {
  // Inicializar localStorage si es necesario
  if (!localStorage.getItem('stockeate_products')) {
    localStorage.setItem('stockeate_products', JSON.stringify([]));
  }
  if (!localStorage.getItem('stockeate_stock_moves')) {
    localStorage.setItem('stockeate_stock_moves', JSON.stringify([]));
  }
  if (!localStorage.getItem('stockeate_remitos')) {
    localStorage.setItem('stockeate_remitos', JSON.stringify([]));
  }
  if (!localStorage.getItem('stockeate_remito_items')) {
    localStorage.setItem('stockeate_remito_items', JSON.stringify([]));
  }
}

const now = () => new Date().toISOString();
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// Funciones helper para localStorage
const getProducts = () => JSON.parse(localStorage.getItem('stockeate_products') || '[]');
const setProducts = (products: any[]) => localStorage.setItem('stockeate_products', JSON.stringify(products));
const getStockMoves = () => JSON.parse(localStorage.getItem('stockeate_stock_moves') || '[]');
const setStockMoves = (moves: any[]) => localStorage.setItem('stockeate_stock_moves', JSON.stringify(moves));
const getRemitos = () => JSON.parse(localStorage.getItem('stockeate_remitos') || '[]');
const setRemitos = (remitos: any[]) => localStorage.setItem('stockeate_remitos', JSON.stringify(remitos));
const getRemitoItems = () => JSON.parse(localStorage.getItem('stockeate_remito_items') || '[]');
const setRemitoItems = (items: any[]) => localStorage.setItem('stockeate_remito_items', JSON.stringify(items));

export const DB = {
  getProductByCode(code: string) {
    const products = getProducts();
    return products.find((p: any) => p.code === code) || null;
  },

  upsertProduct(p: any) {
    const products = getProducts();
    const existing = products.findIndex((prod: any) => prod.code === p.code);
    
    const product = {
      id: p.id || uid(),
      code: p.code,
      name: p.name || p.code,
      price: p.price || 0,
      stock: p.stock || 0,
      version: p.version || 0,
      branch_id: p.branch_id,
      updated_at: now(),
      archived: p.archived || 0,
    };

    if (existing >= 0) {
      products[existing] = { ...products[existing], ...product };
    } else {
      products.push(product);
    }
    
    setProducts(products);
    return product;
  },

  incrementStock(productId: string, qty: number) {
    const products = getProducts();
    const index = products.findIndex((p: any) => p.id === productId);
    if (index >= 0) {
      products[index].stock = (products[index].stock || 0) + qty;
      products[index].version = (products[index].version || 0) + 1;
      products[index].updated_at = now();
      setProducts(products);
    }
  },

  insertRemito(data: any) {
    const remitos = getRemitos();
    const id = uid();
    const remito = {
      id,
      tmp_number: data.tmp_number,
      official_number: data.official_number || null,
      branch_id: data.branch_id,
      customer: data.customer || null,
      notes: data.notes || null,
      created_at: now(),
      synced: 0,
      pdf_path: data.pdf_path || null,
    };
    remitos.push(remito);
    setRemitos(remitos);
    return id;
  },

  insertRemitoItem(data: any) {
    const items = getRemitoItems();
    const item = {
      id: uid(),
      remito_id: data.remito_id,
      product_id: data.product_id,
      qty: data.qty,
      unit_price: data.unit_price || 0,
    };
    items.push(item);
    setRemitoItems(items);
  },

  insertStockMove(data: any) {
    const moves = getStockMoves();
    const move = {
      id: uid(),
      product_id: data.product_id,
      branch_id: data.branch_id,
      qty: data.qty,
      type: data.type,
      ref: data.ref || null,
      created_at: now(),
      synced: 0,
    };
    moves.push(move);
    setStockMoves(moves);
  }, // <-- IMPORTANTE: coma aquí

  setRemitoPdfPath(remitoId: string, path: string) {
    const remitos = getRemitos();
    const index = remitos.findIndex((r: any) => r.id === remitoId);
    if (index >= 0) {
      remitos[index].pdf_path = path;
      setRemitos(remitos);
    }
  },

  getRemitoById(remitoId: string) {
    const remitos = getRemitos();
    return remitos.find((r: any) => r.id === remitoId) || null;
  },

  getRemitoItems(remitoId: string) {
    const items = getRemitoItems();
    const products = getProducts();
    return items
      .filter((item: any) => item.remito_id === remitoId)
      .map((item: any) => {
        const product = products.find((p: any) => p.id === item.product_id);
        return {
          ...item,
          code: product?.code || '',
          name: product?.name || '',
        };
      });
  },

  listProductsByBranch(branchId: string, search: string = "", limit = 200, offset = 0) {
    const products = getProducts();
    let filtered = products.filter((p: any) => p.branch_id === branchId && !p.archived);
    
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((p: any) => 
        p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
      );
    }
    
    return filtered
      .sort((a: any, b: any) => a.name.localeCompare(b.name))
      .slice(offset, offset + limit);
  },

  listArchivedByBranch(branchId: string, search: string = "", limit = 200, offset = 0) {
    const products = getProducts();
    let filtered = products.filter((p: any) => p.branch_id === branchId && p.archived);
    
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((p: any) => 
        p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
      );
    }
    
    return filtered
      .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(offset, offset + limit);
  },

  updateProductNamePrice(productId: string, name: string, price: number) {
    const products = getProducts();
    const index = products.findIndex((p: any) => p.id === productId);
    if (index >= 0) {
      products[index].name = name;
      products[index].price = price;
      products[index].version = (products[index].version || 0) + 1;
      products[index].updated_at = now();
      setProducts(products);
      return products[index];
    }
    return null;
  },

  adjustStock(productId: string, branchId: string, delta: number, reason: string = "Ajuste inventario") {
    this.incrementStock(productId, delta);
    this.insertStockMove({
      product_id: productId,
      branch_id: branchId,
      qty: delta,
      type: "adjust",
      ref: reason,
    });
    const products = getProducts();
    return products.find((p: any) => p.id === productId) || null;
  },

  setStockExact(productId: string, branchId: string, target: number, reason = "Fijar stock") {
    const products = getProducts();
    const product = products.find((p: any) => p.id === productId);
    if (product) {
      const current = product.stock || 0;
      const delta = target - current;
      product.stock = target;
      product.version = (product.version || 0) + 1;
      product.updated_at = now();
      setProducts(products);
      
      this.insertStockMove({
        product_id: productId,
        branch_id: branchId,
        qty: delta,
        type: "set",
        ref: reason,
      });
      
      return product;
    }
    return null;
  },

  canDeleteProduct(productId: string): boolean {
    const items = getRemitoItems();
    return !items.some((item: any) => item.product_id === productId);
  },

  deleteProduct(productId: string) {
    const products = getProducts().filter((p: any) => p.id !== productId);
    const moves = getStockMoves().filter((m: any) => m.product_id !== productId);
    setProducts(products);
    setStockMoves(moves);
  },

  archiveProduct(productId: string) {
    const products = getProducts();
    const index = products.findIndex((p: any) => p.id === productId);
    if (index >= 0) {
      products[index].archived = 1;
      products[index].updated_at = now();
      products[index].version = (products[index].version || 0) + 1;
      setProducts(products);
    }
  },

  unarchiveProduct(productId: string) {
    const products = getProducts();
    const index = products.findIndex((p: any) => p.id === productId);
    if (index >= 0) {
      products[index].archived = 0;
      products[index].updated_at = now();
      products[index].version = (products[index].version || 0) + 1;
      setProducts(products);
    }
  },

  pruneProductsNotIn(branchId: string, keepCodes: string[]) {
    const products = getProducts();
    const filtered = products.filter((p: any) => 
      p.branch_id !== branchId || keepCodes.includes(p.code)
    );
    setProducts(filtered);
  },

  // Métodos adicionales que podrían estar en el archivo original
  getAllProducts() {
    return getProducts();
  },

  clearAll() {
    localStorage.removeItem('stockeate_products');
    localStorage.removeItem('stockeate_stock_moves');
    localStorage.removeItem('stockeate_remitos');
    localStorage.removeItem('stockeate_remito_items');
    this.initDb();
  }, // <-- coma agregada

  // Añadidos para compatibilidad con apply.ts
  upsertRemito(r: any) {
    const remitos = getRemitos();
    const idx = remitos.findIndex((x: any) => x.id === r.id);
  
    const remito = {
      id: r.id,
      tmp_number: r.tmp_number,
      official_number: r.official_number ?? null,
      branch_id: r.branch_id,
      customer: r.customer ?? null,
      notes: r.notes ?? null,
      created_at: r.created_at ?? now(),
      synced: 1,
      pdf_path: null,
    };
  
    if (idx >= 0) {
      remitos[idx] = { ...remitos[idx], ...remito };
    } else {
      remitos.push(remito);
    }
    setRemitos(remitos);
  },

  upsertRemitoItem(item: any) {
    const items = getRemitoItems();
    const idx = items.findIndex((x: any) => x.id === item.id);
  
    const normalized = {
      id: item.id,
      remito_id: item.remito_id,
      product_id: item.product_id,
      qty: item.qty,
      unit_price: item.unit_price ?? 0,
    };
  
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...normalized };
    } else {
      items.push(normalized);
    }
    setRemitoItems(items);
  },

  // Listar todos los remitos (web) para el historial
  listAllRemitos() {
    return getRemitos();
  },
};