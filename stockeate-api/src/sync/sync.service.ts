import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SyncService {
  constructor(private prisma: PrismaService) {}

  // ---------- PULL ----------
  async pull(branchId: string, since?: number) {
    const clock = Date.now();
    const full = !since;

    // Productos
    let products: any[] = [];
    if (full) {
      // Snapshot completo
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
    } else {
      // ⚠️ Incremental: productos creados/actualizados desde "since"
      const list = await this.prisma.product.findMany({
        where: {
          branchId,
          archived: false,
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

    // Movimientos desde “since” (sin include)
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

    // Resolver productCode por productId (evitamos include)
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
    // Aceptar camelCase y snake_case desde el cliente
    const branchId = dto.branchId ?? dto.branch_id;
    const products = dto.products ?? [];
    const stockMoves = dto.stockMoves ?? [];
    const remitos = dto.remitos ?? [];
    const remitoItems = dto.remitoItems ?? [];

    const mapping: Record<string, string> = {};
    const patched: any[] = [];
    const conflicts: any[] = [];

    await this.prisma.$transaction(async (tx) => {
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
        if ((p.version ?? 0) < existing.version) {
          conflicts.push({ entity: 'product', code, server: existing });
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

      // 2) Movimientos de stock (espera { productId, type: 'IN'|'OUT', qty, ref? })
      for (const m of stockMoves) {
        const productId = m.productId ?? m.product_id; // por si viniera snake
        if (!productId) continue;

        const prod = await tx.product.findUnique({ where: { id: productId } });
        if (!prod) continue;

        const type: 'IN' | 'OUT' = m.type ?? (m.delta >= 0 ? 'IN' : 'OUT'); // fallback p/ clientes viejos
        const qty = m.qty ?? Math.abs(m.delta ?? 0);

        await tx.stockMove.create({
          data: { productId, branchId, qty, type, ref: m.ref ?? null },
        });

        const delta = type === 'IN' ? qty : -qty;
        const updated = await tx.product.update({
          where: { id: productId },
          data: { stock: (prod.stock ?? 0) + delta, version: (prod.version ?? 0) + 1 },
        });

        patched.push({ entity: 'product', id: updated.id, stock: updated.stock, version: updated.version });
      }

      // 3) Remitos + items (acepta snake y camel)
      for (const r of remitos) {
        const tmpNumber = r.tmpNumber ?? r.tmp_number ?? null;
        const customer = r.customer ?? null;
        const notes = r.notes ?? null;

        const count = await tx.remito.count({ where: { branchId } });
        const official = `A-${String(count + 1).padStart(6, '0')}`;

        const rem = await tx.remito.create({
          data: {
            branchId,
            tmpNumber,
            officialNumber: official,
            customer,
            notes,
          },
        });

        if (tmpNumber) mapping[tmpNumber] = official;

        // Vincular items por r.id (camel) o r.remito_id (snake)
        const rId = r.id ?? r.remito_id;
        const items = remitoItems.filter(
          (ri: any) => (ri.remitoId ?? ri.remito_id) === rId
        );

        for (const it of items) {
          const productId = it.productId ?? it.product_id;
          if (!productId) continue;
          await tx.remitoItem.create({
            data: {
              remitoId: rem.id,
              productId,
              qty: it.qty,
              unitPrice: it.unitPrice ?? it.unit_price ?? 0,
            },
          });
        }
      }
    });

    return { mapping, patched, conflicts };
  }
}
