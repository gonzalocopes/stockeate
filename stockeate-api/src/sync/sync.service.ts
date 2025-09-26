import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SyncService {
  constructor(private prisma: PrismaService) {}

  // ---------- PULL (forzado full para propagar deletes) ----------
  async pull(branchId: string, _since?: number) {
    const clock = Date.now();
    const full = true; // 👈 siempre full

    // Productos (snapshot completo de la sucursal)
    const list = await this.prisma.product.findMany({
      where: { branchId } as any,
      orderBy: { name: 'asc' },
      take: 5000,
    });

    const products = list.map((p: any) => ({
      code: p.code,
      name: p.name,
      price: p.price ?? 0,
      stock: p.stock ?? 0,
      branch_id: p.branchId ?? p.branch_id,
      updated_at: p.updatedAt ? new Date(p.updatedAt).getTime() : undefined,
    }));

    // Movimientos (por si querés mantenerlos; no necesarios para el delete)
    let moves: any[] = [];
    try {
      moves = await this.prisma.stockMove.findMany({
        where: { branchId } as any,
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

    return { clock, full, products, stockMoves };
  }

  // ---------- PUSH ----------
  async process(dto: any) {
    const branchId = dto.branchId ?? dto.branch_id;
    const products = dto.products ?? [];
    const stockMoves = dto.stockMoves ?? [];
    const remitos = dto.remitos ?? [];
    const remitoItems = dto.remitoItems ?? [];
    const deletes: string[] = Array.isArray(dto.deletes) ? dto.deletes.filter(Boolean) : [];

    const mapping: Record<string, string> = {};
    const patched: any[] = [];
    const conflicts: any[] = [];

    await this.prisma.$transaction(async (tx) => {
      // 0) Deletes por código (de esta sucursal)
      if (deletes.length > 0) {
        // buscamos ids primero para respetar branchId
        const prods = await tx.product.findMany({
          where: { code: { in: deletes }, branchId },
          select: { id: true },
        });
        const ids = prods.map((p) => p.id);
        if (ids.length > 0) {
          // si tu schema tiene FKs, borrar dependencias primero
          try {
            await tx.remitoItem.deleteMany({ where: { productId: { in: ids } } as any });
          } catch {}
          try {
            await tx.stockMove.deleteMany({ where: { productId: { in: ids } } as any });
          } catch {}
          await tx.product.deleteMany({ where: { id: { in: ids } } as any });
        }
      }

      // 1) Upsert de productos (por code)
      for (const p of products) {
        const code = p.code;
        if (!code) continue;
        const existing = await tx.product.findUnique({ where: { code } });
        if (!existing) {
          await tx.product.create({
            data: {
              branchId,
              code,
              name: p.name ?? code,
              price: p.price ?? 0,
              stock: p.stock ?? 0,
              version: p.version ?? 0,
            },
          });
          continue;
        }
        if ((p.version ?? 0) < (existing as any).version) {
          conflicts.push({ entity: 'product', code, server: existing });
          continue;
        }
        await tx.product.update({
          where: { id: (existing as any).id },
          data: {
            name: p.name ?? (existing as any).name,
            price: p.price ?? (existing as any).price,
            // si viene stock en la edición, lo respetamos (fijado por cliente)
            ...(typeof p.stock === 'number' ? { stock: p.stock } : {}),
            version: ((existing as any).version ?? 0) + 1,
          },
        });
      }

      // 2) Movimientos de stock
      for (const m of stockMoves) {
        const productId = m.productId ?? m.product_id;
        if (!productId) continue;

        const prod = await tx.product.findUnique({ where: { id: productId } });
        if (!prod) continue;

        const type: 'IN' | 'OUT' = m.type ?? (m.delta >= 0 ? 'IN' : 'OUT');
        const qty = m.qty ?? Math.abs(m.delta ?? 0);

        await tx.stockMove.create({
          data: { productId, branchId, qty, type, ref: m.ref ?? null },
        });

        const delta = type === 'IN' ? qty : -qty;
        const updated = await tx.product.update({
          where: { id: productId },
          data: { stock: ((prod as any).stock ?? 0) + delta, version: ((prod as any).version ?? 0) + 1 },
        });

        patched.push({ entity: 'product', id: (updated as any).id, stock: (updated as any).stock, version: (updated as any).version });
      }

      // 3) Remitos + items
      for (const r of remitos) {
        const tmpNumber = r.tmpNumber ?? r.tmp_number ?? null;
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
          if (!productId) continue;
          await tx.remitoItem.create({
            data: { remitoId: (rem as any).id, productId, qty: it.qty, unitPrice: it.unitPrice ?? it.unit_price ?? 0 },
          });
        }
      }
    });

    return { mapping, patched, conflicts };
  }
}
