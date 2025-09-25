import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SyncService {
  constructor(private prisma: PrismaService) {}

  // ---------- PULL ----------
  async pull(branchId: string, since?: number) {
    const clock = Date.now();
    const full = !since;

    // Productos: en snapshot completo mando todos los no archivados
    let products: any[] = [];
    if (full) {
      const list = await this.prisma.product.findMany({
        where: { branchId, archived: false } as any,
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
    }

    // Movimientos desde “since”
    let moves: any[] = [];
    try {
      moves = await this.prisma.stockMove.findMany({
        where: {
          branchId,
          ...(since ? { createdAt: { gt: new Date(since) } } : {}),
        } as any,
        include: { product: true } as any,
        orderBy: { createdAt: 'asc' } as any,
        take: 5000,
      });
    } catch {
      moves = [];
    }

    const stockMoves = moves.map((m: any) => ({
      id: String(m.id),
      productCode: m.product?.code ?? '',
      branchId: m.branchId ?? m.branch_id,
      delta: m.type === 'IN' ? m.qty : -m.qty,
      reason: m.ref ?? undefined,
      created_at: m.createdAt ? new Date(m.createdAt).getTime() : undefined,
    }));

    return { clock, full, products, stockMoves };
  }

  // ---------- Mantengo tu “push” tal cual lo tenías ----------
  async process(dto: any) {
    const { branchId, products = [], stockMoves = [], remitos = [], remitoItems = [] } = dto;
    const mapping: Record<string, string> = {};
    const patched: any[] = [];
    const conflicts: any[] = [];

    await this.prisma.$transaction(async (tx) => {
      // 1) Upsert de productos (con versionado simple)
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

      // 3) Remitos + items
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
    });

    return { mapping, patched, conflicts };
  }
}
