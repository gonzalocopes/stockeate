import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client'; 

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
        where: { branchId, isActive: true } as any,
        orderBy: { name: 'asc' },
        take: 5000,
      });
      products = list.map((p: any) => ({
        id: p.id, // <-- 1. AÑADIDO EL ID QUE FALTABA
        code: p.code, name: p.name, price: p.price ?? 0, stock: p.stock ?? 0,
        branch_id: p.branchId,
        updated_at: p.updatedAt ? new Date(p.updatedAt).getTime() : undefined,
        archived: p.isActive ? 0 : 1 
      }));
    } else {
      const list = await this.prisma.product.findMany({
        where: {
          branchId,
          OR: [{ updatedAt: { gt: new Date(since!) } }, { createdAt: { gt: new Date(since!) } }],
        } as any,
        orderBy: { updatedAt: 'asc' } as any,
        take: 5000,
      });
      products = list.map((p: any) => ({
        id: p.id, // <-- 1. AÑADIDO EL ID QUE FALTABA
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

    // --- LÓGICA DE REMITOS (ACTUALIZADA) ---
    const newRemitos = await this.prisma.remito.findMany({
      where: {
        branchId,
        ...(since ? { createdAt: { gt: new Date(since) } } : {}),
      },
      select: {
        id: true,
        tmpNumber: true,
        customer: true,
        customerCuit: true,
        customerAddress: true,
        customerTaxCondition: true,
        notes: true,
        createdAt: true,
        branchId: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 5000,
    });

    const newRemitoIds = newRemitos.map(r => r.id);
    const newRemitoItems = newRemitoIds.length > 0
      ? await this.prisma.remitoItem.findMany({
          where: { remitoId: { in: newRemitoIds } }
        })
      : [];
    
    return {
      clock,
      full,
      products,
      stockMoves,
      remitos: newRemitos,
      remitoItems: newRemitoItems,
    };
  }

  // ---------- PUSH (ACTUALIZADO) ----------
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
      // 0) Deletes
      for (const code of deletes) {
        if (!code) continue;
        const prod = await tx.product.findFirst({ where: { code, branchId } });
        if (!prod) continue;
        await tx.remitoItem.deleteMany({ where: { productId: prod.id } }).catch(() => {});
        await tx.stockMove.deleteMany({ where: { productId: prod.id } }).catch(() => {});
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
              id: p.id, // <-- AÑADIDO: Usar el ID de la app si viene
              branchId, code, name: p.name ?? code, price: p.price ?? 0,
              stock: p.stock ?? 0, version: typeof p.version === 'number' ? p.version : 0,
              isActive: true,
            },
          });
          continue;
        }
        if (!existing.isActive) {
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
        const productCode = m.productCode ?? m.product_code;
        let pid = m.productId ?? m.product_id;
        if (!pid && productCode) {
          pid = (await tx.product.findUnique({ where: { code: productCode } }))?.id;
        }
        if (!pid) continue;
        const prod = await tx.product.findUnique({ where: { id: pid } });
        if (!prod) continue;
        let type: 'IN' | 'OUT' = m.type;
        let qty: number = m.qty;
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
        if (existingRemito) continue; 

        const customer = r.customer ?? null;
        const notes = r.notes ?? null;
        const count = await tx.remito.count({ where: { branchId } });
        const official = `A-${String(count + 1).padStart(6, '0')}`;
        
        const rem = await tx.remito.create({
          data: {
            id: r.id, // <-- AÑADIDO: Usar el ID de la app si viene
            branchId,
            tmpNumber,
            officialNumber: official,
            customer,
            notes,
            customerCuit: r.customerCuit ?? null,
            customerAddress: r.customerAddress ?? null,
            customerTaxCondition: r.customerTaxCondition ?? null,
          },
        });

        if (tmpNumber) mapping[tmpNumber] = official;
        const rId = r.id ?? r.remito_id;
        const items = remitoItems.filter((ri: any) => (ri.remitoId ?? ri.remito_id) === rId);
        for (const it of items) {
          const productCode = it.productCode ?? it.product_code;
          let pid = it.productId ?? it.product_id;
          if (!pid && productCode) {
              pid = (await tx.product.findUnique({ where: { code: productCode } }))?.id;
          }
          if (!pid) continue;
          await tx.remitoItem.create({
            data: { 
              id: it.id, // <-- AÑADIDO: Usar el ID de la app si viene
              remitoId: rem.id, 
              productId: pid, 
              qty: it.qty, 
              unitPrice: it.unitPrice ?? it.unit_price ?? 0 
            },
          });
        }
      }
    });
    return { mapping, patched, conflicts };
  }
}