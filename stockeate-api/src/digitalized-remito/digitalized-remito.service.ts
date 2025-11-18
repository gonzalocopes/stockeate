// src/digitalized-remito/digitalized-remito.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DigitalizationStatus, Prisma } from '@prisma/client';
import { ValidationDataDto } from './dto/validation-data.dto';
import { createWorker } from 'tesseract.js';

type ParsedItem = {
  detectedCode: string;
  detectedName: string;
  qty: number;
};

type ParsedData = {
  provider: string;
  date: string;
  customerCuit: string;
  customerAddress: string;
  customerTaxCondition: string;
  items: ParsedItem[];
};

@Injectable()
export class DigitalizedRemitoService {
  private readonly logger = new Logger(DigitalizedRemitoService.name);

  constructor(private prisma: PrismaService) {}

  // userId ahora puede venir null si el token no está o es inválido
  async createInitialRemito(
    file: Express.Multer.File,
    userId: string | null,
    branchId: string,
  ) {
    this.logger.log(
      `[createInitialRemito] file=${file?.originalname ?? file?.filename
      } userId=${userId ?? 'anonymous'} branchId=${branchId}`,
    );

    let newDigitalizedRemito;

    try {
      newDigitalizedRemito = await this.prisma.digitalizedRemito.create({
        data: {
          userId, // puede ser null
          branchId,
          originalFileUrl: file.path,
          status: DigitalizationStatus.PROCESSING,
        },
      });
    } catch (err: any) {
      // Si fallara por FK inválida (por si algún día vuelve a ser requerido)
      if (err.code === 'P2003') {
        this.logger.error(
          `[createInitialRemito] FK userId inválido (${userId}), creando remito sin usuario`,
        );
        newDigitalizedRemito = await this.prisma.digitalizedRemito.create({
          data: {
            userId: null,
            branchId,
            originalFileUrl: file.path,
            status: DigitalizationStatus.PROCESSING,
          },
        });
      } else {
        this.logger.error(
          '[createInitialRemito] Error creando remito digitalizado',
          err,
        );
        throw err;
      }
    }

    // Lanzamos el OCR en background (no bloquea la respuesta al móvil)
    this.processOcr(newDigitalizedRemito.id, file.path).catch((err) => {
      this.logger.error(
        `[createInitialRemito] processOcr failed for ${newDigitalizedRemito.id}`,
        err,
      );
    });

    // El móvil recibe de inmediato el ID del remito digitalizado
    return newDigitalizedRemito;
  }

  private async processOcr(remitoId: string, filePath: string) {
    this.logger.log(`[OCR] Iniciando Tesseract para: ${remitoId}`);
    const worker = await createWorker('spa'); // OCR en español

    try {
      const { data } = await worker.recognize(filePath);
      const textoExtraido = data.text || '';

      this.logger.log(
        `[OCR] Texto extraído (primeros 400 chars): ${textoExtraido.substring(
          0,
          400,
        )}...`,
      );

      let parsedData: ParsedData;

      try {
        parsedData = this.parsearTextoDeTesseract(textoExtraido);
      } catch (err) {
        this.logger.error('[OCR] Error parseando texto, usando fallback', err);
        parsedData = this.buildFallbackParsedData();
      }

      await this.prisma.digitalizedRemito.update({
        where: { id: remitoId },
        data: {
          extractedData: parsedData as Prisma.InputJsonValue,
          status: DigitalizationStatus.PENDING_VALIDATION,
        },
      });

      this.logger.log(`[OCR] Procesamiento Tesseract exitoso para: ${remitoId}`);
    } catch (error) {
      this.logger.error(
        `[OCR] Falló el procesamiento para: ${remitoId}`,
        error,
      );

      await this.prisma.digitalizedRemito.update({
        where: { id: remitoId },
        data: {
          status: DigitalizationStatus.FAILED,
          errorMessage: (error as Error).message,
          extractedData: this.buildFallbackParsedData() as Prisma.InputJsonValue,
        },
      });
    } finally {
      await worker.terminate();
      this.logger.log(`[OCR] Trabajador Tesseract terminado para: ${remitoId}`);
    }
  }

  // Fallback básico por si el OCR explota
  private buildFallbackParsedData(): ParsedData {
    return {
      provider: 'Proveedor (no detectado)',
      date: new Date().toISOString().slice(0, 10),
      customerCuit: '',
      customerAddress: '',
      customerTaxCondition: '',
      items: [
        {
          detectedCode: '???',
          detectedName: 'Ítem no detectado (Editar)',
          qty: 1,
        },
      ],
    };
  }

  // Parser "inteligente pero humilde": detecta encabezado + algunos items
  private parsearTextoDeTesseract(texto: string): ParsedData {
    this.logger.log('[Parser] Analizando texto real con Regex...');

    const provider =
      this.findFirstMatch(texto, [
        /Raz[oó]n Social\s*[:\-]\s*(.+)/im,
        /Señor\(es\)\s*[:\-]\s*(.+)/im,
        /Proveedor\s*[:\-]\s*(.+)/im,
        /Cliente\s*[:\-]\s*(.+)/im,
      ]) ?? 'Proveedor (no detectado)';

    const date =
      this.findFirstMatch(texto, [
        /Fecha(?: de Emisi[oó]n)?\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/im,
        /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/im,
      ]) ?? new Date().toISOString().slice(0, 10);

    const cuit =
      this.findFirstMatch(texto, [
        /C\.?U\.?I\.?T\.?\s*N?°?\s*[:\-]?\s*(\d{2}-\d{8}-\d)/im,
        /(\d{2}-\d{8}-\d)/im,
      ]) ?? '';

    const address =
      this.findFirstMatch(texto, [
        /Direcci[oó]n\s*[:\-]?\s*(.+)/im,
        /Domicilio\s*[:\-]?\s*(.+)/im,
      ]) ?? '';

    // --- Detección muy básica de renglones de productos ---
    const lines = texto.split(/\r?\n/);
    const items: ParsedItem[] = [];

    // Ejemplo de línea:
    // 123456   DESCRIPCIÓN DEL PRODUCTO   4 unid
    const itemRegex =
      /(?<code>[A-Z0-9\-]{3,})\s+(?<name>[A-ZÁÉÍÓÚÑ0-9 ,.\-]{3,})\s+(?<qty>\d{1,4})\s*(unid\.?|u\.?|kg|kgs|uds)?/i;

    for (const line of lines) {
      const m = line.match(itemRegex);
      if (!m || !m.groups) continue;

      const code = m.groups.code.trim();
      const name = m.groups.name.trim();
      const qty = parseInt(m.groups.qty, 10);

      if (!Number.isFinite(qty)) continue;

      items.push({
        detectedCode: code,
        detectedName: name,
        qty,
      });
    }

    if (items.length === 0) {
      // Si no encontramos nada, devolvemos un ítem genérico editable
      items.push({
        detectedCode: '???',
        detectedName: 'Ítem no detectado (Editar)',
        qty: 1,
      });
    }

    this.logger.log(
      `[Parser] Detectado provider=${provider}, CUIT=${cuit}, Fecha=${date}, Dirección=${address}, items=${items.length}`,
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
        return match[1].trim().split('\n')[0];
      }
    }
    return null;
  }

  async findPendingByBranch(branchId: string) {
    return this.prisma.digitalizedRemito.findMany({
      where: { branchId, status: DigitalizationStatus.PENDING_VALIDATION },
      orderBy: { createdAt: 'desc' },
    });
  }

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

  async validateAndFinalizeRemito(id: string, validationData: ValidationDataDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Busca el remito digitalizado
      const digitalizedRemito = await tx.digitalizedRemito.findUnique({
        where: { id },
      });

      if (
        !digitalizedRemito ||
        digitalizedRemito.status !== DigitalizationStatus.PENDING_VALIDATION
      ) {
        throw new NotFoundException('Remito no encontrado o ya fue procesado.');
      }

      // 2. Busca o crea los productos
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

      // 3. Crea el remito oficial de ENTRADA
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

      // 4. Actualiza stock + movimientos
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
