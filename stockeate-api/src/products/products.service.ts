import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  private toApi(p: any) {
    if (!p) return null;
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      price: p.price ?? 0,
      stock: p.stock ?? 0,
      branch_id: p.branchId ?? p.branch_id,
      updated_at: p.updatedAt ?? p.updated_at ?? null,
      archived: typeof p.archived === 'boolean' ? p.archived : (p.archived ?? false),
    };
  }

  async findByCode(code: string, branchId: string | null) {
    const where: any = { code };
    if (branchId) where.branchId = branchId;
    const p = await this.prisma.product.findFirst({ where });
    return this.toApi(p);
  }

  async findMany(branchId: string, search: string, includeArchived: boolean) {
    const where: any = { branchId };
    if (!includeArchived) where.archived = false;

    if (search?.trim()) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const list = await this.prisma.product.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      take: 1000,
    });

    return list.map((p: any) => this.toApi(p));
  }
}
