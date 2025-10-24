import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreateRemitoDto,
  UpdateRemitoDto,
  GetRemitosQueryDto,
} from './remitos.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class RemitosService {
  constructor(private readonly prisma: PrismaService) {}

  // Crear remito con transacción para manejar stock
  async create(createRemitoDto: CreateRemitoDto) {
    const { branchId, items, ...remitoData } = createRemitoDto;

    // Verificar que el branch existe
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw new NotFoundException(`Branch con id ${branchId} no encontrada`);
    }

    // Verificar que todos los productos existen y tienen stock suficiente
    // También guardamos los productos para usarlos después
    const productsMap = new Map();

    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { code: item.productCode },
      });

      if (!product) {
        throw new NotFoundException(
          `Producto con código ${item.productCode} no encontrado`,
        );
      }

      if (product.stock < item.qty) {
        throw new BadRequestException(
          `Stock insuficiente para el producto ${product.name}. Stock disponible: ${product.stock}, solicitado: ${item.qty}`,
        );
      }

      productsMap.set(item.productCode, product);
    }

    // Crear remito con items y actualizar stock en una transacción
    return await this.prisma.$transaction(async (tx) => {
      // Crear el remito con sus items
      const remito = await tx.remito.create({
        data: {
          ...remitoData,
          branch: { connect: { id: branchId } },
          items: {
            create: items.map((item) => {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              const product = productsMap.get(item.productCode);
              return {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                productId: product.id,
                qty: item.qty,
                unitPrice: new Decimal(item.unitPrice),
              };
            }),
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          branch: true,
        },
      });

      // Actualizar stock y crear movimientos
      for (const item of items) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const product = productsMap.get(item.productCode);

        // Actualizar stock del producto
        await tx.product.update({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          where: { id: product.id },
          data: {
            stock: { decrement: item.qty },
          },
        });

        // Crear movimiento de stock
        await tx.stockMove.create({
          data: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            productId: product.id,
            branchId: branchId,
            qty: -item.qty,
            type: 'OUT',
            ref: `REMITO-${remito.tmpNumber}`,
          },
        });
      }

      return remito;
    });
  }

  // Obtener todos los remitos con filtros opcionales
  async findAll(query: GetRemitosQueryDto) {
    const where: any = {};

    if (query.branchId) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      where.branchId = query.branchId;
    }

    if (query.customer) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      where.customer = { contains: query.customer, mode: 'insensitive' };
    }

    if (query.tmpNumber) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      where.tmpNumber = query.tmpNumber;
    }

    if (query.officialNumber) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      where.officialNumber = query.officialNumber;
    }

    return await this.prisma.remito.findMany({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        branch: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Obtener remito por ID
  async findOne(id: string) {
    const remito = await this.prisma.remito.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        branch: true,
      },
    });

    if (!remito) {
      throw new NotFoundException(`Remito con id ${id} no encontrado`);
    }

    return remito;
  }

  // Actualizar remito (solo campos editables)
  async update(id: string, updateRemitoDto: UpdateRemitoDto) {
    // Verificar que existe
    await this.findOne(id);

    return await this.prisma.remito.update({
      where: { id },
      data: updateRemitoDto,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        branch: true,
      },
    });
  }

  // Eliminar remito (con reversión de stock)
  async remove(id: string) {
    const remito = await this.findOne(id);

    return await this.prisma.$transaction(async (tx) => {
      // Revertir stock
      for (const item of remito.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.qty },
          },
        });

        // Crear movimiento de reversión
        await tx.stockMove.create({
          data: {
            productId: item.productId,
            branchId: remito.branchId,
            qty: item.qty,
            type: 'IN',
            ref: `REMITO-CANCEL-${remito.tmpNumber}`,
          },
        });
      }

      // Eliminar items del remito
      await tx.remitoItem.deleteMany({
        where: { remitoId: id },
      });

      // Eliminar remito
      return await tx.remito.delete({
        where: { id },
      });
    });
  }

  // Obtener remitos por branch
  async findByBranch(branchId: string) {
    return await this.prisma.remito.findMany({
      where: { branchId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
