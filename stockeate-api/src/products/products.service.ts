import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ProductDto } from './products.controller';
import { UpdateProductDto } from './products.controller';
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

  async updateProduct(
    code: string,
    branchId: string,
    updateData: UpdateProductDto,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { code, branchId },
    });
    if (!product) {
      throw new NotFoundException(
        `No se encontró producto con código ${code} en la sucursal indicada`,
      );
    }
    const data: any = {};
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (updateData.code !== undefined) data.code = updateData.code;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (updateData.name !== undefined) data.name = updateData.name;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (updateData.stock !== undefined) data.stock = updateData.stock;
    if (updateData.price !== undefined)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      data.price = new Decimal(updateData.price);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (updateData.isActive !== undefined) data.isActive = updateData.isActive;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No hay campos válidos para actualizar');
    }

    const updated = await this.prisma.product.update({
      where: { id: product.id },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data,
    });

    return updated;
  }

  async toggleActive(code: string, branchId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        code,
        branchId,
      },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado en esta sucursal');
    }
    const updatedProduct = await this.prisma.product.update({
      where: {
        id: product.id,
      },
      data: {
        isActive: !product.isActive,
      },
    });

    return updatedProduct;
  }
}
