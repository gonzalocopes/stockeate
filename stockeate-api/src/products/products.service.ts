import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ProductDto } from './products.controller';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  private toApi(p: any) {
    if (!p) return null;
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      isActive: p.isActive ?? true,
      price: p.price ?? 0,
      stock: p.stock ?? 0,
      branch_id: p.branchId ?? p.branch_id,
      updated_at: p.updatedAt ?? p.updated_at ?? null,
      archived:
        typeof p.archived === 'boolean' ? p.archived : (p.archived ?? false),
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

  async createProduct(branchId: string, product: ProductDto) {
    return this.prisma.product.create({
      data: {
        branch: { connect: { id: branchId } },
        code: product.code,
        name: product.name,
        price: new Decimal(product.price),
        stock: product.stock,
      },
    });
  }

  async deleteProduct(code: string, branchId: string) {
    return await this.prisma.product.delete({
      where: { code, branchId },
    });
  }

  async updateProduct(code: string, branchId: string, product: ProductDto) {
    return await this.prisma.product.update({
      where: { code, branchId },
      data: {
        name: product.name,
        price: new Decimal(product.price),
        stock: product.stock,
      },
    });
  }

  async markProductAsInactive(code: string, branchId: string) {
    return await this.prisma.product.update({
      where: { code, branchId },
      data: { isActive: false },
    });
  }
}
