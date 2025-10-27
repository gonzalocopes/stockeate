/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
  RemitoType,
  RemitosStatsResponseDto,
  RemitoWithTypeDto,
} from './remitos.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';

@Injectable()
export class RemitosService {
  constructor(private readonly prisma: PrismaService) {}

  // Helper para determinar el tipo de remito basado en los movimientos de stock
  private async getRemitoType(remitoId: string): Promise<RemitoType> {
    // Primero intentamos buscar por el número de remito en los movimientos
    const remito = await this.prisma.remito.findUnique({
      where: { id: remitoId },
      select: { tmpNumber: true },
    });

    if (!remito) {
      return RemitoType.OUT;
    }

    const stockMoves = await this.prisma.stockMove.findMany({
      where: {
        ref: {
          contains: `REMITO-${remito.tmpNumber}`,
        },
      },
    });

    if (stockMoves.length === 0) {
      // Si no hay movimientos, es difícil determinar el tipo
      // Podríamos considerar OUT por defecto o buscar otra estrategia
      return RemitoType.OUT;
    }

    // Si encontramos movimientos, determinamos el tipo por el primer movimiento
    const firstMove = stockMoves[0];
    return firstMove.qty > 0 ? RemitoType.IN : RemitoType.OUT;
  }

  // Helper para enriquecer remitos con su tipo
  private async enrichRemitoWithType(remito: any): Promise<RemitoWithTypeDto> {
    const type = await this.getRemitoType(remito.id);
    return {
      ...remito,
      type,
    };
  }

  private async enrichRemitosWithType(
    remitos: any[],
  ): Promise<RemitoWithTypeDto[]> {
    return Promise.all(
      remitos.map((remito) => this.enrichRemitoWithType(remito)),
    );
  }

  // // Crear remito con transacción para manejar stock
  // async create(createRemitoDto: CreateRemitoDto): Promise<RemitoWithTypeDto> {
  //   const { branchId, items, type, ...remitoData } = createRemitoDto;

  //   // Verificar que el branch existe
  //   const branch = await this.prisma.branch.findUnique({
  //     where: { id: branchId },
  //   });

  //   if (!branch) {
  //     throw new NotFoundException(`Branch con id ${branchId} no encontrada`);
  //   }

  //   // Verificar que todos los productos existen
  //   const productsMap = new Map();

  //   for (const item of items) {
  //     const product = await this.prisma.product.findUnique({
  //       where: { code: item.productCode },
  //     });

  //     if (!product) {
  //       throw new NotFoundException(
  //         `Producto con código ${item.productCode} no encontrado`,
  //       );
  //     }

  //     // Para remitos de salida, verificar stock suficiente
  //     if (type === RemitoType.OUT && product.stock < item.qty) {
  //       throw new BadRequestException(
  //         `Stock insuficiente para el producto ${product.name}. Stock disponible: ${product.stock}, solicitado: ${item.qty}`,
  //       );
  //     }

  //     productsMap.set(item.productCode, product);
  //   }

  //   // Crear remito con items y actualizar stock en una transacción
  //   return await this.prisma.$transaction(async (tx) => {
  //     // Crear el remito con sus items
  //     const remito = await tx.remito.create({
  //       data: {
  //         ...remitoData,
  //         branch: { connect: { id: branchId } },
  //         items: {
  //           create: items.map((item) => {
  //             const product = productsMap.get(item.productCode);
  //             return {
  //               productId: product.id,
  //               qty: item.qty,
  //               unitPrice: new Decimal(item.unitPrice),
  //             };
  //           }),
  //         },
  //       },
  //       include: {
  //         items: {
  //           include: {
  //             product: true,
  //           },
  //         },
  //         branch: true,
  //       },
  //     });

  //     // Actualizar stock y crear movimientos según el tipo
  //     for (const item of items) {
  //       const product = productsMap.get(item.productCode);
  //       const stockChange = type === RemitoType.IN ? item.qty : -item.qty;
  //       const moveType = type === RemitoType.IN ? 'IN' : 'OUT';

  //       // Actualizar stock del producto
  //       await tx.product.update({
  //         where: { id: product.id },
  //         data: {
  //           stock: { increment: stockChange },
  //         },
  //       });

  //       // Crear movimiento de stock
  //       await tx.stockMove.create({
  //         data: {
  //           productId: product.id,
  //           branchId: branchId,
  //           qty: stockChange,
  //           type: moveType,
  //           ref: `REMITO-${remito.tmpNumber}`,
  //         },
  //       });
  //     }

  //     // Enriquecer el remito con el tipo antes de retornar
  //     return this.enrichRemitoWithType(remito);
  //   });
  // }

  async create(createRemitoDto: CreateRemitoDto): Promise<RemitoWithTypeDto> {
    const { branchId, items, type, ...remitoData } = createRemitoDto;

    // Verificar que el branch existe
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw new NotFoundException(`Branch con id ${branchId} no encontrada`);
    }

    // Verificar que todos los productos existen
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

      // Para remitos de salida, verificar stock suficiente
      if (type === RemitoType.OUT && product.stock < item.qty) {
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
              const product = productsMap.get(item.productCode);
              return {
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

      // Actualizar stock y crear movimientos según el tipo
      for (const item of items) {
        const product = productsMap.get(item.productCode);
        const stockChange = type === RemitoType.IN ? item.qty : -item.qty;
        const moveType = type === RemitoType.IN ? 'IN' : 'OUT';

        // Actualizar stock del producto
        await tx.product.update({
          where: { id: product.id },
          data: {
            stock: { increment: stockChange },
          },
        });

        // Crear movimiento de stock
        await tx.stockMove.create({
          data: {
            productId: product.id,
            branchId: branchId,
            qty: stockChange,
            type: moveType,
            ref: `REMITO-${remito.tmpNumber}`,
          },
        });
      }

      // Retornar el remito con el type que recibimos, sin llamar a getRemitoType
      return {
        ...remito,
        type, // ← Usamos el type que recibimos en el DTO
      } as RemitoWithTypeDto;
    });
  }

  // Obtener todos los remitos con filtros opcionales
  async findAll(query: GetRemitosQueryDto): Promise<RemitoWithTypeDto[]> {
    const where: Prisma.RemitoWhereInput = {};

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.customer) {
      where.customer = { contains: query.customer, mode: 'insensitive' };
    }

    if (query.tmpNumber) {
      where.tmpNumber = query.tmpNumber;
    }

    if (query.officialNumber) {
      where.officialNumber = query.officialNumber;
    }

    const remitos = await this.prisma.remito.findMany({
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

    // Si no hay filtro por tipo, retornar todos enriquecidos
    if (!query.type) {
      return this.enrichRemitosWithType(remitos);
    }

    // Filtrar por tipo si se especifica
    const filteredRemitos: any[] = [];
    for (const remito of remitos) {
      const remitoType = await this.getRemitoType(remito.id);
      if (remitoType === query.type) {
        filteredRemitos.push(remito);
      }
    }

    return this.enrichRemitosWithType(filteredRemitos);
  }

  // Obtener remito por ID
  async findOne(id: string): Promise<RemitoWithTypeDto> {
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

    return this.enrichRemitoWithType(remito);
  }

  // Actualizar remito (solo campos editables)
  async update(
    id: string,
    updateRemitoDto: UpdateRemitoDto,
  ): Promise<RemitoWithTypeDto> {
    // Verificar que existe
    await this.findOne(id);

    const remito = await this.prisma.remito.update({
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

    return this.enrichRemitoWithType(remito);
  }

  // Eliminar remito (con reversión de stock)
  async remove(id: string): Promise<any> {
    const remitoWithType = await this.findOne(id);

    return await this.prisma.$transaction(async (tx) => {
      // Revertir stock según el tipo de remito
      for (const item of remitoWithType.items) {
        const stockChange =
          remitoWithType.type === RemitoType.IN ? -item.qty : item.qty;

        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: stockChange },
          },
        });

        // Crear movimiento de reversión
        await tx.stockMove.create({
          data: {
            productId: item.productId,
            branchId: remitoWithType.branchId,
            qty: Math.abs(stockChange),
            type: remitoWithType.type === RemitoType.IN ? 'OUT' : 'IN',
            ref: `REMITO-CANCEL-${remitoWithType.tmpNumber}`,
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
  async findByBranch(branchId: string): Promise<RemitoWithTypeDto[]> {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch) {
      throw new NotFoundException(`Branch con id ${branchId} no encontrada`);
    }
    const remitos = await this.prisma.remito.findMany({
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

    return this.enrichRemitosWithType(remitos);
  }

  // Obtener estadísticas de remitos
  async getStats(branchId?: string): Promise<RemitosStatsResponseDto> {
    const where: Prisma.RemitoWhereInput = branchId ? { branchId } : {};

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch) {
      throw new NotFoundException(`Branch con id ${branchId} no encontrada`);
    }

    const remitos = await this.prisma.remito.findMany({
      where,
      select: { id: true },
    });

    let inCount = 0;
    let outCount = 0;

    for (const remito of remitos) {
      const type = await this.getRemitoType(remito.id);
      if (type === RemitoType.IN) {
        inCount++;
      } else {
        outCount++;
      }
    }

    return {
      total: remitos.length,
      inCount,
      outCount,
    };
  }

  // Obtener remitos por tipo
  async findByType(
    type: RemitoType,
    branchId?: string,
  ): Promise<RemitoWithTypeDto[]> {
    const where: Prisma.RemitoWhereInput = {};

    if (branchId) {
      where.branchId = branchId;
    }
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch) {
      throw new NotFoundException(`Branch con id ${branchId} no encontrada`);
    }

    const remitos = await this.prisma.remito.findMany({
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

    // Filtrar por tipo
    const filteredRemitos: any[] = [];
    for (const remito of remitos) {
      const remitoType = await this.getRemitoType(remito.id);
      if (remitoType === type) {
        filteredRemitos.push(remito);
      }
    }

    return this.enrichRemitosWithType(filteredRemitos);
  }
}
