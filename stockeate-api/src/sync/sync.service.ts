import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SyncService {
  constructor(private prisma: PrismaService) {}

  // ---------- PULL ----------
  async pull(branchId: string, since?: number) {
    const clock = Date.now();
    const full = !since;

    // Productos (snapshot o incremental)
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

    // Movimientos desde “since”
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

    // Resolver productCode por productId
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
    const deletes: string[] = dto.deletes ?? dto.deletedCodes ?? []; // <- NUEVO

    const mapping: Record<string, string> = {};
    const patched: any[] = [];
    const conflicts: any[] = [];

    await this.prisma.$transaction(async (tx) => {
      // 0) Deletes por code (y branch)
      for (const code of deletes) {
        if (!code) continue;
        // borrar hijos primero por seguridad
        const prod = await tx.product.findFirst({ where: { code, branchId } });
        if (!prod) continue;
        await tx.remitoItem.deleteMany({ where: { productId: prod.id } }).catch(() => {});
        await tx.stockMove.deleteMany({ where: { productId: prod.id } }).catch(() => {});
        await tx.product.deleteMany({ where: { id: prod.id } });
      }

      // 1) Upsert de productos por code (sin pisar stock en updates)
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
              stock: p.stock ?? 0, // stock inicial solo al crear
              version: typeof p.version === 'number' ? p.version : 0,
            },
          });
          continue;
        }

        const incomingVersion =
          typeof p.version === 'number' ? p.version : existing.version;
        if (incomingVersion < existing.version) {
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

      // 2) Movimientos de stock (acepta productCode o productId, delta o type+qty)
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
        const newStock = Math.max(0, (prod.stock ?? 0) + delta);
        const updated = await tx.product.update({
          where: { id: pid },
          data: { stock: newStock, version: (prod.version ?? 0) + 1 },
        });

        patched.push({ entity: 'product', id: updated.id, stock: updated.stock, version: updated.version });
      }

      // 3) Remitos + items (igual que antes)
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
            data: { remitoId: rem.id, productId, qty: it.qty, unitPrice: it.unitPrice ?? it.unit_price ?? 0 },
          });
        }
      }
    });

    return { mapping, patched, conflicts };
  }
}
