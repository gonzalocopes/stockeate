// src/digitalized-remito/digitalized-remito.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DigitalizationStatus } from '@prisma/client';
import { ValidationDataDto } from './dto/validation-data.dto';
import { createWorker, Worker } from 'tesseract.js';

@Injectable()
export class DigitalizedRemitoService {
  private readonly logger = new Logger(DigitalizedRemitoService.name);

  constructor(private prisma: PrismaService) {}

  // --- MÉTODO 1: crear registro inicial y disparar OCR en background ---
  async createInitialRemito(
    file: Express.Multer.File,
    userId: string,
    branchId: string,
  ) {
    this.logger.log(
      `[createInitialRemito] userId=${userId} branchId=${branchId} path=${file?.path}`,
    );

    let newDigitalizedRemito;

    try {
      // Intento "normal" usando el userId del token
      newDigitalizedRemito = await this.prisma.digitalizedRemito.create({
        data: {
          userId,
          branchId,
          originalFileUrl: file.path,
          status: DigitalizationStatus.PROCESSING,
        },
      });
    } catch (err: any) {
      this.logger.error(
        `[createInitialRemito] Error creando con userId=${userId}: ${err?.message}`,
        err?.stack,
      );

      // 🔥 Parche de desarrollo: si el problema es FK con userId, reintentamos SIN userId
      try {
        newDigitalizedRemito = await this.prisma.digitalizedRemito.create({
          data: {
            // userId omitido a propósito
            branchId,
            originalFileUrl: file.path,
            status: DigitalizationStatus.PROCESSING,
          },
        });
        this.logger.warn(
          `[createInitialRemito] Creado sin userId por error anterior.`,
        );
      } catch (err2: any) {
        this.logger.error(
          `[createInitialRemito] Error también sin userId: ${err2?.message}`,
          err2?.stack,
        );
        // Si también falla, dejamos que suba la excepción (Nest responderá 500)
        throw err2;
      }
    }

    // Disparamos el OCR en background, pero siempre atrapando errores
    this.processOcr(newDigitalizedRemito.id, file.path).catch((err) => {
      this.logger.error(
        `[processOcr] Error no manejado en background: ${err?.message}`,
        err?.stack,
      );
    });

    return newDigitalizedRemito;
  }

  // --- MÉTODO 2: OCR con Tesseract protegido ---
  private async processOcr(remitoId: string, filePath: string) {
    this.logger.log(`[OCR] Iniciando Tesseract para: ${remitoId}`);
    let worker: Worker | null = null;

    try {
      worker = await createWorker('spa');

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
          extractedData: parsedData,
          status: DigitalizationStatus.PENDING_VALIDATION,
        },
      });

      this.logger.log(
        `[OCR] Procesamiento Tesseract exitoso para: ${remitoId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `[OCR] Falló el procesamiento para: ${remitoId} - ${error?.message}`,
        error?.stack,
      );

      await this.prisma.digitalizedRemito.update({
        where: { id: remitoId },
        data: {
          status: DigitalizationStatus.FAILED,
          errorMessage: error?.message ?? 'OCR error',
        },
      });
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch (e: any) {
          this.logger.warn(
            `[OCR] Error al terminar worker: ${e?.message}`,
            e?.stack,
          );
        }
      }
      this.logger.log(
        `[OCR] Trabajador Tesseract terminado para: ${remitoId}`,
      );
    }
  }

  // --- MÉTODO 3: Parser ---
  private parsearTextoDeTesseract(texto: string): any {
    this.logger.log('[Parser] Analizando texto real con Regex...');

    type ExtractedItem = {
      detectedCode: string;
      detectedName: string;
      qty: number;
    };
    const items: ExtractedItem[] = [];

    const patronesProveedor: RegExp[] = [
      /Razón Social\s*[:—]\s*(.*)/im,
      /Señor\(es\)\s*[:—]\s*(.*)/im,
      /Cliente\s*[:—]\s*(.*)/im,
    ];

    const patronesFecha: RegExp[] = [
      /Fecha (?:de Emisión)?\s*[:—]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/im,
      /(\d{2}[\/-]\d{2}[\/-]\d{4})/im,
    ];

    const patronesCuit: RegExp[] = [
      /C\.?U\.?I\.?T\.?\s*N?°?\s*[:—]?\s*(\d{2}-\d{8}-\d{1})/im,
      /(\d{2}-\d{8}-\d{1})/im,
    ];

    const patronesDireccion: RegExp[] = [
      /Dirección\s*[:—]?\s*(.*)/im,
      /Domicilio\s*[:—]?\s*(.*)/im,
    ];

    const provider =
      this.findFirstMatch(texto, patronesProveedor) ||
      'Proveedor (No detectado)';
    const date =
      this.findFirstMatch(texto, patronesFecha) ||
      new Date().toISOString().slice(0, 10);
    const cuit = this.findFirstMatch(texto, patronesCuit) || '';
    const address = this.findFirstMatch(texto, patronesDireccion) || '';

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

  // --- MÉTODO 4 ---
  async findPendingByBranch(branchId: string) {
    return this.prisma.digitalizedRemito.findMany({
      where: { branchId, status: DigitalizationStatus.PENDING_VALIDATION },
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- MÉTODO 5 ---
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

  // --- MÉTODO 6 ---
  async validateAndFinalizeRemito(id: string, validationData: ValidationDataDto) {
    return this.prisma.$transaction(async (tx) => {
      const digitalizedRemito = await tx.digitalizedRemito.findUnique({
        where: { id },
      });
      if (
        !digitalizedRemito ||
        digitalizedRemito.status !== 'PENDING_VALIDATION'
      ) {
        throw new NotFoundException('Remito no encontrado o ya fue procesado.');
      }

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
