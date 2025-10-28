// src/types/db.ts
import type { Prod } from "../screens/BranchProducts";

export interface DBType {
  listProductsByBranch: (branchId: string, search?: string, limit?: number, offset?: number) => Prod[];
  updateProductNamePrice: (productId: string, name: string, price: number) => Prod;
  deleteProduct: (productId: string) => void;
  archiveProduct: (productId: string) => void;
}
