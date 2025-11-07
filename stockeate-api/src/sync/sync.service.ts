import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client'; // Importar Prisma para TransactionClient

@Injectable()
export class SyncService {
  constructor(private prisma: PrismaService) {}

  // ---------- PULL (ACTUALIZADO) ----------
  async pull(branchId: string, since?: number) {
    const clock = Date.now();
    const full = !since;

    // --- Productos (Tu lógica existente) ---
    let products: any[] = [];
    if (full) {
      const list = await this.prisma.product.findMany({
        where: { branchId, isActive: true } as any, // Mantenemos tu lógica de 'isActive'
        orderBy: { name: 'asc' },
        take: 5000,
      });
      products = list.map((p: any) => ({
        code: p.code, name: p.name, price: p.price ?? 0, stock: p.stock ?? 0,
        branch_id: p.branchId,
        updated_at: p.updatedAt ? new Date(p.updatedAt).getTime() : undefined,
        archived: p.isActive ? 0 : 1 // Mapeamos isActive a archived para la app
      }));
    } else {
      const list = await this.prisma.product.findMany({
        where: {
          branchId,
          OR: [
            { updatedAt: { gt: new Date(since!) } },
            // Tu versión anterior también tenía createdAt, la mantenemos por si acaso
            { createdAt: { gt: new Date(since!) } }, 
          ],
        } as any,
        orderBy: { updatedAt: 'asc' } as any,
        take: 5000,
      });
      products = list.map((p: any) => ({
        code: p.code, name: p.name, price: p.price ?? 0, stock: p.stock ?? 0,
        branch_id: p.branchId,
        updated_at: p.updatedAt ? new Date(p.updatedAt).getTime() : undefined,
        archived: p.isActive ? 0 : 1
      }));
    }

    // --- Movimientos de stock (Tu lógica existente) ---
    let moves: any[] = [];
    try {
      moves = await this.prisma.stockMove.findMany({
        where: { branchId, ...(since ? { createdAt: { gt: new Date(since) } } : {}) } as any,
        orderBy: { createdAt: 'asc' } as any,
        take: 5000,
      });
    } catch { moves = []; }
    const productIds = Array.from(new Set(moves.map((m) => m.productId).filter(Boolean)));
    const prodList = productIds.length
      ? await this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, code: true } })
      : [];
    const codeById = new Map<string, string>(prodList.map((p) => [p.id, p.code]));
    const stockMoves = moves.map((m: any) => ({
      id: String(m.id), productCode: codeById.get(m.productId) ?? '', branchId: m.branchId,
      delta: m.type === 'IN' ? m.qty : -m.qty,
      reason: m.ref ?? undefined,
      created_at: m.createdAt ? new Date(m.createdAt).getTime() : undefined,
    }));

    // --- 👇 LÓGICA DE REMITOS QUE FALTABA ---
    
    // 1. Buscamos los remitos nuevos
    const newRemitos = await this.prisma.remito.findMany({
      where: {
        branchId,
        ...(since ? { createdAt: { gt: new Date(since) } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 5000,
    });

    // 2. Buscamos los items de esos remitos
    const newRemitoIds = newRemitos.map(r => r.id);
    const newRemitoItems = newRemitoIds.length > 0
      ? await this.prisma.remitoItem.findMany({
          where: { remitoId: { in: newRemitoIds } }
          // (Si remitoItem tuviera 'createdAt', también filtraríamos por 'since' aquí)
        })
      : [];
    
    // --- FIN DE LA LÓGICA FALTANTE ---

    return {
      clock,
      full,
      products,
      stockMoves,
      remitos: newRemitos,     // <-- 3. Añadimos los remitos al paquete
      remitoItems: newRemitoItems, // <-- 3. Añadimos los items al paquete
    };
  }

  // ---------- PUSH (Tu lógica 'process' robusta se mantiene) ----------
  async process(dto: any) {
    const branchId = dto.branchId ?? dto.branch_id;
    const products = dto.products ?? [];
    const stockMoves = dto.stockMoves ?? [];
    const remitos = dto.remitos ?? [];
    const remitoItems = dto.remitoItems ?? [];
    const deletes: string[] = dto.deletes ?? dto.deletedCodes ?? [];

    const mapping: Record<string, string> = {};
    const patched: any[] = [];
    const conflicts: any[] = [];

    await this.prisma.$transaction(async (tx) => {
      // 0) Deletes por code (y branch)
      for (const code of deletes) {
        if (!code) continue;
        const prod = await tx.product.findFirst({ where: { code, branchId } });
        if (!prod) continue;
        await tx.remitoItem.deleteMany({ where: { productId: prod.id } }).catch(() => {});
        await tx.stockMove.deleteMany({ where: { productId: prod.id } }).catch(() => {});
        // Usamos la lógica de tu versión final (desactivar, no borrar)
        await tx.product.updateMany({ where: { id: prod.id }, data: { isActive: false } });
      }

      // 1) Upsert de productos
      for (const p of products) {
        const code = p.code;
        if (!code) continue;
        const existing = await tx.product.findUnique({ where: { code } });
        if (!existing) {
          await tx.product.create({
            data: {
              branchId, code, name: p.name ?? code, price: p.price ?? 0,
              stock: p.stock ?? 0, version: typeof p.version === 'number' ? p.version : 0,
              isActive: true, // Asegurarse de crearlo activo
            },
          });
          continue;
        }
        if (!existing.isActive) { // Reactivar si existe pero está inactivo
          await tx.product.update({ where: { id: existing.id }, data: { isActive: true } });
        }
        const incomingVersion = typeof p.version === 'number' ? p.version : existing.version;
        if (incomingVersion < existing.version) {
          conflicts.push({ entity: 'product', code, server: existing });
          continue;
        }
        await tx.product.update({
          where: { id: existing.id },
          data: {
            name: p.name ?? existing.name, price: p.price ?? existing.price,
            version: existing.version + 1,
          },
        });
      }

      // 2) Movimientos de stock
      for (const m of stockMoves) {
        const productId = m.productId ?? m.product_id;
        const productCode = m.productCode ?? m.product_code;
        let pid = productId as string | undefined;
        if (!pid && productCode) {
          const found = await tx.product.findUnique({ where: { code: productCode } });
          pid = found?.id;
        }
        if (!pid) continue;
        const prod = await tx.product.findUnique({ where: { id: pid } });
        if (!prod) continue;
        let type: 'IN' | 'OUT' = m.type;
        let qty: number | undefined = m.qty;
        if (!type || qty == null) {
          const delta = Number(m.delta ?? 0);
          if (delta === 0) continue;
          type = delta >= 0 ? 'IN' : 'OUT';
          qty = Math.abs(delta);
        }
        await tx.stockMove.create({
          data: { productId: pid, branchId, qty, type, ref: m.ref ?? m.reason ?? null },
        });
        const delta = type === 'IN' ? qty : -qty;
        const updated = await tx.product.update({
          where: { id: pid },
          data: { stock: (prod.stock ?? 0) + delta, version: (prod.version ?? 0) + 1 },
        });
        patched.push({ entity: 'product', id: updated.id, stock: updated.stock, version: updated.version });
      }

      // 3) Remitos + items
      for (const r of remitos) {
        const tmpNumber = r.tmpNumber ?? r.tmp_number ?? null;
        if (!tmpNumber) continue;
        const existingRemito = await tx.remito.findUnique({ where: { tmpNumber } });
        if (existingRemito) continue; // Si ya existe por tmpNumber, no lo creamos de nuevo

        const customer = r.customer ?? null;
        const notes = r.notes ?? null;
        const count = await tx.remito.count({ where: { branchId } });
        const official = `A-${String(count + 1).padStart(6, '0')}`;
        const rem = await tx.remito.create({
          data: { branchId, tmpNumber, officialNumber: official, customer, notes },
        });
        if (tmpNumber) mapping[tmpNumber] = official;
        const rId = r.id ?? r.remito_id;
        const items = remitoItems.filter((ri: any) => (ri.remitoId ?? ri.remito_id) === rId);
        for (const it of items) {
          const productId = it.productId ?? it.product_id;
          const productCode = it.productCode ?? it.product_code; // Si la app envía código en lugar de ID
          let pid = productId as string | undefined;
          if (!pid && productCode) {
              const found = await tx.product.findUnique({ where: { code: productCode } });
              pid = found?.id;
          }
          if (!pid) continue;
          await tx.remitoItem.create({
            data: { remitoId: rem.id, productId: pid, qty: it.qty, unitPrice: it.unitPrice ?? it.unit_price ?? 0 },
          });
        }
      }
    });
    return { mapping, patched, conflicts };
  }
}