// src/digitalized-remito/digitalized-remito.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DigitalizationStatus, Prisma } from '@prisma/client';
import { ValidationDataDto } from './dto/validation-data.dto';
import { createWorker } from 'tesseract.js';

@Injectable()
export class DigitalizedRemitoService {
  private readonly logger = new Logger(DigitalizedRemitoService.name);

  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // 1) Crear registro inicial y disparar OCR
  // ─────────────────────────────────────────────
  async createInitialRemito(
    file: Express.Multer.File,
    userId: string,
    branchId: string,
  ) {
    this.logger.log(
      `[createInitialRemito] file=${file.originalname} mimetype=${file.mimetype} userId=${userId} branchId=${branchId}`,
    );

    // Normalizamos el userId (puede venir "anonymous")
    let finalUserId: string | null = null;
    if (userId && userId !== 'anonymous') {
      try {
        const exists = await this.prisma.user.findUnique({
          where: { id: userId },
        });
        if (exists) {
          finalUserId = userId;
        } else {
          this.logger.error(
            `[createInitialRemito] FK userId inválido (${userId}), creando remito sin usuario`,
          );
        }
      } catch (e) {
        this.logger.error(
          `[createInitialRemito] Error comprobando userId=${userId}`,
          e as any,
        );
      }
    }

    const newDigitalizedRemito = await this.prisma.digitalizedRemito.create({
      data: {
        userId: finalUserId,
        branchId,
        originalFileUrl: file.path,
        status: DigitalizationStatus.PROCESSING,
      },
    });

    // 👉 IMPORTANTE: si NO es imagen, NO corremos Tesseract (evitamos el crash con PDFs)
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      const msg =
        'Formato no soportado para OCR. Por ahora solo se admiten imágenes (JPG/PNG).';

      this.logger.error(
        `[createInitialRemito] ${msg} mimetype=${file.mimetype}`,
      );

      await this.prisma.digitalizedRemito.update({
        where: { id: newDigitalizedRemito.id },
        data: {
          status: DigitalizationStatus.FAILED,
          errorMessage: msg,
          extractedData: {
            provider: '',
            date: new Date().toISOString().slice(0, 10),
            customerCuit: '',
            customerAddress: '',
            customerTaxCondition: '',
            items: [],
          } as Prisma.InputJsonValue,
        },
      });

      // Lo devolvemos igual, pero marcado como FAILED
      return newDigitalizedRemito;
    }

    // Si es imagen, disparamos OCR en background SIN permitir que reviente el proceso
    this.processOcr(newDigitalizedRemito.id, file.path).catch((err) => {
      this.logger.error(
        `[processOcr] Error no capturado para remito=${newDigitalizedRemito.id}`,
        err,
      );
    });

    return newDigitalizedRemito;
  }

  // ─────────────────────────────────────────────
  // 2) OCR con Tesseract
  // ─────────────────────────────────────────────
  private async processOcr(remitoId: string, filePath: string) {
    this.logger.log(`[OCR] Iniciando Tesseract para: ${remitoId}`);

    const worker = await createWorker('spa');

    try {
      const ret = await worker.recognize(filePath);
      const textoExtraido = ret.data.text || '';

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
          extractedData: parsedData as Prisma.InputJsonValue,
          status: DigitalizationStatus.PENDING_VALIDATION,
          errorMessage: null,
        },
      });

      this.logger.log(
        `[OCR] Procesamiento Tesseract exitoso para: ${remitoId}`,
      );
    } catch (error) {
      this.logger.error(
        `[OCR] Falló el procesamiento para: ${remitoId}`,
        error as any,
      );

      const fallback = {
        provider: '',
        date: new Date().toISOString().slice(0, 10),
        customerCuit: '',
        customerAddress: '',
        customerTaxCondition: '',
        items: [],
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

  // ─────────────────────────────────────────────
  // 3) Parser de texto (igual que antes)
  // ─────────────────────────────────────────────
  private parsearTextoDeTesseract(texto: string): any {
    this.logger.log('[Parser] Analizando texto real con Regex...');

    type ExtractedItem = {
      detectedCode: string;
      detectedName: string;
      qty: number;
    };

    const items: ExtractedItem[] = [];

    // Patrones de Proveedor
    const patronesProveedor: RegExp[] = [
      /Razón Social\s*[:—]\s*(.*)/im,
      /Señor\(es\)\s*[:—]\s*(.*)/im,
      /Cliente\s*[:—]\s*(.*)/im,
      /Remito\s+N?[°º]?\s*.*\n(.*)/im, // línea debajo de "Remito ..."
    ];

    // Patrones de Fecha
    const patronesFecha: RegExp[] = [
      /Fecha (?:de Emisión)?\s*[:—]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/im,
      /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/im,
    ];

    // Patrones de CUIT
    const patronesCuit: RegExp[] = [
      /C\.?U\.?I\.?T\.?\s*N?°?\s*[:—]?\s*(\d{2}-\d{8}-\d{1})/im,
      /(\d{2}-\d{8}-\d{1})/im,
    ];

    // Patrones de Dirección
    const patronesDireccion: RegExp[] = [
      /Dirección\s*[:—]?\s*(.*)/im,
      /Domicilio\s*[:—]?\s*(.*)/im,
    ];

    const provider =
      this.findFirstMatch(texto, patronesProveedor) ||
      'Proveedor (no detectado)';
    const date =
      this.findFirstMatch(texto, patronesFecha) ||
      new Date().toISOString().slice(0, 10);
    const cuit = this.findFirstMatch(texto, patronesCuit) || '';
    const address = this.findFirstMatch(texto, patronesDireccion) || '';

    // Por ahora simulamos un ítem genérico si no detectamos tabla
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

  private findFirstMatch(texto: string, patrones: RegExp[]): string | null {
    for (const patron of patrones) {
      const match = texto.match(patron);
      if (match && match[1]) {
        const resultadoLimpio = match[1].trim().split('\n')[0];
        if (resultadoLimpio) return resultadoLimpio;
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────
  // 4) Listar pendientes por sucursal
  // ─────────────────────────────────────────────
  async findPendingByBranch(branchId: string) {
    return this.prisma.digitalizedRemito.findMany({
      where: {
        branchId,
        status: DigitalizationStatus.PENDING_VALIDATION,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─────────────────────────────────────────────
  // 5) Obtener uno por ID
  // ─────────────────────────────────────────────
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

  // ─────────────────────────────────────────────
  // 6) Validar y generar Remito de entrada
  // ─────────────────────────────────────────────
  async validateAndFinalizeRemito(id: string, validationData: ValidationDataDto) {
    return this.prisma.$transaction(async (tx) => {
      const digitalizedRemito = await tx.digitalizedRemito.findUnique({
        where: { id },
      });

      if (
        !digitalizedRemito ||
        digitalizedRemito.status !== DigitalizationStatus.PENDING_VALIDATION
      ) {
        throw new NotFoundException('Remito no encontrado o ya fue procesado.');
      }

      // 1) Buscar o crear productos
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

      // 2) Crear remito de ENTRADA
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

      // 3) Actualizar stock y movimientos
      for (const item of processedItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.qty },
          },
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

      // 4) Marcar digitalizado como COMPLETED
      return tx.digitalizedRemito.update({
        where: { id },
        data: {
          status: DigitalizationStatus.COMPLETED,
        },
      });
    });
  }
}
