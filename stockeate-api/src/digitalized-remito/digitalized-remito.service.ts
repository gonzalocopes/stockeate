// src/digitalized-remito/digitalized-remito.service.ts
import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DigitalizationStatus, Prisma } from '@prisma/client';
import { ValidationDataDto } from './dto/validation-data.dto';
import { createWorker } from 'tesseract.js';

@Injectable()
export class DigitalizedRemitoService {
  private readonly logger = new Logger(DigitalizedRemitoService.name);

  constructor(private prisma: PrismaService) {}

  // --- MÉTODO 1: crear registro inicial y disparar OCR ---
  async createInitialRemito(
    file: Express.Multer.File,
    userId: string | null,
    branchId: string,
  ) {
    this.logger.log(
      `[createInitialRemito] file=${file?.originalname} userId=${userId} branchId=${branchId}`,
    );

    let newDigitalizedRemito;

    try {
      // Intento normal: con userId (si viene) + branchId
      newDigitalizedRemito = await this.prisma.digitalizedRemito.create({
        data: {
          // Si userId es null/undefined, Prisma lo ignora (campo opcional)
          userId: userId ?? undefined,
          branchId,
          originalFileUrl: file.path,
          status: DigitalizationStatus.PROCESSING,
        },
      });
    } catch (err: any) {
      // Si la FK al usuario no existe, volvemos a intentar sin userId
      if (
        err.code === 'P2003' &&
        err.meta?.constraint === 'DigitalizedRemito_userId_fkey'
      ) {
        this.logger.error(
          `[createInitialRemito] FK userId inválido (${userId}), creando remito sin usuario`,
        );

        newDigitalizedRemito = await this.prisma.digitalizedRemito.create({
          data: {
            branchId,
            originalFileUrl: file.path,
            status: DigitalizationStatus.PROCESSING,
          },
        });
      } else {
        this.logger.error(
          '[createInitialRemito] Error creando DigitalizedRemito',
          err,
        );
        throw err;
      }
    }

    // Lanzamos el OCR en segundo plano (no bloquea la respuesta)
    this.processOcr(newDigitalizedRemito.id, file.path).catch((e) =>
      this.logger.error(
        `[processOcr] Falló el procesamiento para ${newDigitalizedRemito.id}`,
        e,
      ),
    );

    return newDigitalizedRemito;
  }

  // --- MÉTODO 2: procesamiento OCR con Tesseract ---
  private async processOcr(remitoId: string, filePath: string) {
    this.logger.log(`[OCR] Iniciando Tesseract para: ${remitoId}`);

    const worker = await createWorker('spa');

    try {
      const ret = await worker.recognize(filePath);
      const textoExtraido = ret.data.text;

      this.logger.log(
        `[OCR] Texto extraído (primeros 400 chars): ${textoExtraido.substring(
          0,
          400,
        )}...`,
      );

      const parsedData = this.parsearTextoDeTesseract(textoExtraido);

      await this.prisma.digitalizedRemito.update({
        where: { id: remitoId },
        data: {
          // 👇 Prisma espera InputJsonValue / NullableJsonNullValueInput
          extractedData: parsedData as Prisma.InputJsonValue,
          status: DigitalizationStatus.PENDING_VALIDATION,
        },
      });

      this.logger.log(
        `[OCR] Procesamiento Tesseract exitoso para: ${remitoId}`,
      );
    } catch (error) {
      this.logger.error(
        `[OCR] Falló el procesamiento para: ${remitoId}`,
        error,
      );

      // Fallback: dejamos un JSON mínimo con error
      const fallback = {
        error: (error as Error).message,
      };

      await this.prisma.digitalizedRemito.update({
        where: { id: remitoId },
        data: {
          status: DigitalizationStatus.FAILED,
          errorMessage: (error as Error).message,
          extractedData: fallback as Prisma.InputJsonValue,
        },
      });
    } finally {
      await worker.terminate();
      this.logger.log(
        `[OCR] Trabajador Tesseract terminado para: ${remitoId}`,
      );
    }
  }

  // --- MÉTODO 3: parser de texto del remito ---
  private parsearTextoDeTesseract(texto: string): any {
    this.logger.log('[Parser] Analizando texto real con Regex...');

    type ExtractedItem = {
      detectedCode: string;
      detectedName: string;
      qty: number;
    };

    const items: ExtractedItem[] = [];

    // Patrones de proveedor (razón social)
    const patronesProveedor: RegExp[] = [
      /Raz[oó]n Social\s*[:—-]\s*(.*)/im,
      /Señor\(es\)\s*[:—-]\s*(.*)/im,
      /Cliente\s*[:—-]\s*(.*)/im,
    ];

    // Patrones de fecha
    const patronesFecha: RegExp[] = [
      /Fecha(?: de Emisi[oó]n)?\s*[:—-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/im,
      /(\d{2}[\/-]\d{2}[\/-]\d{4})/im,
    ];

    // Patrones de CUIT
    const patronesCuit: RegExp[] = [
      /C\.?U\.?I\.?T\.?\s*N?°?\s*[:—-]?\s*(\d{2}-\d{8}-\d{1})/im,
      /(\d{2}-\d{8}-\d{1})/im,
    ];

    // Patrones de dirección
    const patronesDireccion: RegExp[] = [
      /Direcci[oó]n\s*[:—-]?\s*(.*)/im,
      /Domicilio\s*[:—-]?\s*(.*)/im,
    ];

    const provider =
      this.findFirstMatch(texto, patronesProveedor) ||
      'Proveedor (No detectado)';
    const date =
      this.findFirstMatch(texto, patronesFecha) ||
      new Date().toISOString().slice(0, 10);
    const cuit = this.findFirstMatch(texto, patronesCuit) || '';
    const address = this.findFirstMatch(texto, patronesDireccion) || '';

    // Por ahora simulamos un único ítem genérico si no pudo detectar nada
    if (items.length === 0) {
      items.push({
        detectedCode: '???',
        detectedName: 'Ítem no detectado (Editar)',
        qty: 1,
      });
    }

    this.logger.log(
      `[Parser] Detectado: ${provider}, CUIT: ${cuit}, Fecha: ${date}, Dirección: ${address}`,
    );

    return {
      provider,
      date,
      customerCuit: cuit,
      customerAddress: address,
      customerTaxCondition: '',
      items,
    };
  }

  // Helper del parser
  private findFirstMatch(
    texto: string,
    patrones: RegExp[],
  ): string | null {
    for (const patron of patrones) {
      const match = texto.match(patron);
      if (match && match[1]) {
        const resultadoLimpio = match[1].trim().split('\n')[0];
        if (resultadoLimpio) return resultadoLimpio;
      }
    }
    return null;
  }

  // --- MÉTODO 4: listar pendientes por sucursal ---
  async findPendingByBranch(branchId: string) {
    return this.prisma.digitalizedRemito.findMany({
      where: { branchId, status: DigitalizationStatus.PENDING_VALIDATION },
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- MÉTODO 5: buscar uno por ID ---
  async findOne(id: string) {
    const remito = await this.prisma.digitalizedRemito.findUnique({
      where: { id },
    });

    if (!remito) {
      throw new NotFoundException(
        `Remito digitalizado con ID ${id} no encontrado.`,
      );
    }

    return remito;
  }

  // --- MÉTODO 6: validar y generar remito de entrada + stock ---
  async validateAndFinalizeRemito(
    id: string,
    validationData: ValidationDataDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Busca el remito digitalizado
      const digitalizedRemito =
        await tx.digitalizedRemito.findUnique({
          where: { id },
        });

      if (
        !digitalizedRemito ||
        digitalizedRemito.status !== 'PENDING_VALIDATION'
      ) {
        throw new NotFoundException(
          'Remito no encontrado o ya fue procesado.',
        );
      }

      // 2. Busca o crea los productos según los ítems validados
      const processedItems = await Promise.all(
        validationData.items.map(async (item) => {
          let product = await tx.product.findUnique({
            where: { code: item.detectedCode },
          });

          if (!product) {
            product = await tx.product.create({
              data: {
                branchId: digitalizedRemito.branchId,
                code: item.detectedCode,
                name: item.detectedName,
                stock: 0,
                isActive: true,
              },
            });
          }

          return { ...item, productId: product.id };
        }),
      );

      // 3. Crea el Remito de ENTRADA oficial
      const newRemito = await tx.remito.create({
        data: {
          branchId: digitalizedRemito.branchId,
          tmpNumber: `ENT-${Date.now()}`,
          customer: validationData.provider,
          notes: `Ingreso por digitalización. Origen: ${id}`,
          digitalizedOriginId: id,
          customerCuit: validationData.customerCuit,
          customerAddress: validationData.customerAddress,
          customerTaxCondition: validationData.customerTaxCondition,
          items: {
            create: processedItems.map((item) => ({
              productId: item.productId,
              qty: item.qty,
              unitPrice: 0,
            })),
          },
        },
      });

      // 4. Actualiza el stock y crea movimientos
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

      // 5. Marca el remito digitalizado como COMPLETADO
      return tx.digitalizedRemito.update({
        where: { id },
        data: { status: DigitalizationStatus.COMPLETED },
      });
    });
  }
}
