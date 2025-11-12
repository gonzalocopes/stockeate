// stockeate-api/src/digitalized-remito/digitalized-remito.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DigitalizationStatus } from '@prisma/client';
import { ValidationDataDto } from './dto/validation-data.dto';

@Injectable()
export class DigitalizedRemitoService {
  constructor(private prisma: PrismaService) {}

  // 👇 PARÁMETROS RESTAURADOS AQUÍ
  async createInitialRemito(
    file: Express.Multer.File,
    userId: string,
    branchId: string,
  ) {
    const newDigitalizedRemito = await this.prisma.digitalizedRemito.create({
      data: {
        userId: userId,
        branchId: branchId,
        originalFileUrl: file.path,
      },
    });
    this.processOcr(newDigitalizedRemito.id, file.path);
    return newDigitalizedRemito;
  }

  private async processOcr(remitoId: string, filePath: string) {
    console.log(`[OCR] Iniciando procesamiento para el remito: ${remitoId}`);
    try {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const parsedData = {
        provider: 'Proveedor Ejemplo S.A.',
        date: '2025-10-16',
        items: [
          { detectedCode: '7790010001234', detectedName: 'Producto A', qty: 10 },
          { detectedCode: '7790010005678', detectedName: 'Producto B', qty: 5 },
        ],
      };
      await this.prisma.digitalizedRemito.update({
        where: { id: remitoId },
        data: {
          extractedData: parsedData,
          status: DigitalizationStatus.PENDING_VALIDATION,
        },
      });
      console.log(`[OCR] Procesamiento exitoso para el remito: ${remitoId}`);
    } catch (error) {
      console.error(`[OCR] Falló el procesamiento para el remito: ${remitoId}`, error);
      await this.prisma.digitalizedRemito.update({
        where: { id: remitoId },
        data: {
          status: DigitalizationStatus.FAILED,
          errorMessage: error.message,
        },
      });
    }
  }

  // 👇 PARÁMETRO RESTAURADO AQUÍ
  async findPendingByBranch(branchId: string) {
    return this.prisma.digitalizedRemito.findMany({
      where: {
        branchId: branchId,
        status: DigitalizationStatus.PENDING_VALIDATION,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 👇 PARÁMETRO RESTAURADO AQUÍ
  async findOne(id: string) {
    const remito = await this.prisma.digitalizedRemito.findUnique({ where: { id } });
    if (!remito) {
      throw new NotFoundException(`Remito con ID ${id} no encontrado.`);
    }
    return remito;
  }

  async validateAndFinalizeRemito(id: string, validationData: ValidationDataDto) {
    return this.prisma.$transaction(async (tx) => {
      const digitalizedRemito = await tx.digitalizedRemito.findUnique({ where: { id } });
      if (!digitalizedRemito || digitalizedRemito.status !== 'PENDING_VALIDATION') {
        throw new NotFoundException('Remito no encontrado o ya fue procesado.');
      }

      const processedItems = await Promise.all(
        validationData.items.map(async (item) => {
          let product = await tx.product.findUnique({ where: { code: item.detectedCode } });
          if (!product) {
            product = await tx.product.create({
              data: {
                branchId: digitalizedRemito.branchId,
                code: item.detectedCode,
                name: item.detectedName,
                stock: 0,
              },
            });
          }
          return { ...item, productId: product.id };
        }),
      );

      const newRemito = await tx.remito.create({
        data: {
          branchId: digitalizedRemito.branchId,
          tmpNumber: `ENT-${Date.now()}`,
          customer: validationData.provider,
          notes: `Ingreso por digitalización. Origen: ${id}`,
          digitalizedOriginId: id,
          items: {
            create: processedItems.map(item => ({
              productId: item.productId,
              qty: item.qty,
            })),
          },
        },
      });

      for (const item of processedItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.qty } },
        });
        await tx.stockMove.create({
          data: {
            productId: item.productId,
            branchId: digitalizedRemito.branchId,
            qty: item.qty,
            type: 'IN',
            ref: `Remito de entrada ${newRemito.tmpNumber}`,
          },
        });
      }

      return tx.digitalizedRemito.update({
        where: { id },
        data: { status: DigitalizationStatus.COMPLETED },
      });
    });
  }
}