import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SyncService {
  constructor(private prisma: PrismaService) {}

<<<<<<< Updated upstream
  async process(dto: any) {
    const { branchId, products = [], stockMoves = [], remitos = [], remitoItems = [] } = dto;
    const mapping: Record<string, string> = {};
    const patched: any[] = [];
    const conflicts: any[] = [];

    await this.prisma.$transaction(async (tx) => {
      // 1) Upsert de productos con versionamiento simple
      for (const p of products) {
        const existing = await tx.product.findUnique({ where: { code: p.code } });
        if (!existing) {
          await tx.product.create({
            data: {
              branchId,
              code: p.code,
              name: p.name ?? p.code,
              price: p.price ?? 0,
              stock: p.stock ?? 0,
              version: p.version ?? 0,
            },
          });
          continue;
        }
        if ((p.version ?? 0) < existing.version) {
          conflicts.push({ entity: 'product', code: p.code, server: existing });
          continue;
        }
        await tx.product.update({
          where: { id: existing.id },
          data: {
            name: p.name ?? existing.name,
            price: p.price ?? existing.price,
            version: existing.version + 1,
          },
        });
      }

      // 2) Movimientos de stock
      for (const m of stockMoves) {
        const prod = await tx.product.findUnique({ where: { id: m.productId } });
        if (!prod) continue;
        const delta = m.type === 'IN' ? m.qty : -m.qty;
        await tx.stockMove.create({
          data: { productId: m.productId, branchId, qty: m.qty, type: m.type, ref: m.ref ?? null },
        });
        const updated = await tx.product.update({
          where: { id: m.productId },
          data: { stock: prod.stock + delta, version: prod.version + 1 },
        });
        patched.push({ entity: 'product', id: updated.id, stock: updated.stock, version: updated.version });
      }

      // 3) Remitos + items + numeración oficial por sucursal
      for (const r of remitos) {
        const count = await tx.remito.count({ where: { branchId } });
        const official = `A-${String(count + 1).padStart(6, '0')}`;
        const rem = await tx.remito.create({
          data: {
            branchId,
            tmpNumber: r.tmpNumber,
            officialNumber: official,
            customer: r.customer ?? null,
            notes: r.notes ?? null,
          },
        });
        mapping[r.tmpNumber] = official;

        const items = remitoItems.filter((ri: any) => ri.remitoId === r.id);
        for (const it of items) {
          await tx.remitoItem.create({
            data: { remitoId: rem.id, productId: it.productId, qty: it.qty, unitPrice: it.unitPrice ?? 0 },
          });
        }
      }
=======
  // ---------- PULL ----------
  async pull(branchId: string, since?: number) {
    const clock = Date.now();
    const full = !since;

    // Productos (logic remains the same)
    let products: any[] = [];
    if (full) {
      const list = await this.prisma.product.findMany({
        where: { branchId } as any,
        orderBy: { name: 'asc' },
        take: 5000,
      });
      products = list.map((p: any) => ({
        code: p.code,
        name: p.name,
        price: p.price ?? 0,
        stock: p.stock ?? 0,
        branch_id: p.branchId ?? p.branch_id,
        updated_at: p.updatedAt ? new Date(p.updatedAt).getTime() : undefined,
      }));
    } else {
      const list = await this.prisma.product.findMany({
        where: {
          branchId,
          OR: [
            { updatedAt: { gt: new Date(since!) } },
            { createdAt: { gt: new Date(since!) } },
          ],
        } as any,
        orderBy: { updatedAt: 'asc' } as any,
        take: 5000,
      });
      products = list.map((p: any) => ({
        code: p.code,
        name: p.name,
        price: p.price ?? 0,
        stock: p.stock ?? 0,
        branch_id: p.branchId ?? p.branch_id,
        updated_at: p.updatedAt ? new Date(p.updatedAt).getTime() : undefined,
      }));
    }

    // Movimientos de stock (logic remains the same)
    let moves: any[] = [];
    try {
      moves = await this.prisma.stockMove.findMany({
        where: {
          branchId,
          ...(since ? { createdAt: { gt: new Date(since) } } : {}),
        } as any,
        orderBy: { createdAt: 'asc' } as any,
        take: 5000,
      });
    } catch {
      moves = [];
    }

    const productIds = Array.from(new Set(moves.map((m) => m.productId).filter(Boolean)));
    const prodList = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, code: true },
        })
      : [];
    const codeById = new Map<string, string>(prodList.map((p) => [p.id, p.code]));

    const stockMoves = moves.map((m: any) => ({
      id: String(m.id),
      productCode: codeById.get(m.productId) ?? '',
      branchId: m.branchId ?? m.branch_id,
      delta: m.type === 'IN' ? m.qty : -m.qty,
      reason: m.ref ?? undefined,
      created_at: m.createdAt ? new Date(m.createdAt).getTime() : undefined,
    }));
    
    // --- 👇 NUEVA LÓGICA AÑADIDA ---

    // 1. Buscamos los remitos nuevos desde la última sincronización
    const newRemitos = await this.prisma.remito.findMany({
      where: {
        branchId,
        ...(since ? { createdAt: { gt: new Date(since) } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 5000,
>>>>>>> Stashed changes
    });

    // 2. Buscamos todos los items que pertenecen a esos remitos nuevos
    const newRemitoIds = newRemitos.map(r => r.id);
    const newRemitoItems = newRemitoIds.length > 0
      ? await this.prisma.remitoItem.findMany({
          where: {
            remitoId: { in: newRemitoIds },
          },
        })
      : [];
    
    // --- FIN DE LA NUEVA LÓGICA ---

    return {
      clock,
      full,
      products,
      stockMoves,
      remitos: newRemitos,           // <-- 3. Añadimos los remitos al payload
      remitoItems: newRemitoItems,   // <-- 3. Añadimos los items al payload
    };
  }

  // ---------- PUSH (El método 'process' se mantiene exactamente igual) ----------
  async process(dto: any) {
    // ... (no changes needed here) ...
  }
}