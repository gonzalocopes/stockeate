import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DigitalizationStatus, Prisma } from '@prisma/client';
import { ValidationDataDto } from './dto/validation-data.dto';
import { createWorker } from 'tesseract.js';

@Injectable()
export class DigitalizedRemitoService {
  constructor(private prisma: PrismaService) {}

  // ========================
  // 1) CREAR REGISTRO INICIAL
  // ========================
  async createInitialRemito(
    file: Express.Multer.File,
    userId: string,
    branchId: string,
  ) {
    if (!file || !file.path) {
      throw new BadRequestException('No se recibió ningún archivo válido.');
    }

    const newDigitalizedRemito = await this.prisma.digitalizedRemito.create({
      data: {
        userId,
        branchId,
        originalFileUrl: file.path,
        status: DigitalizationStatus.PROCESSING,
      },
    });

    // Lanzamos el OCR en background (no bloquea la respuesta HTTP)
    this.processOcrSafe(newDigitalizedRemito.id, file.path);

    return newDigitalizedRemito;
  }

  // ========================
  // 2) OCR + PARSER (ROBUSTO)
  // ========================
  private async processOcrSafe(remitoId: string, filePath: string) {
    console.log(`[OCR] Iniciando Tesseract para: ${remitoId}`);
    let worker: any;

    try {
      worker = await createWorker('spa');

      const ret = await worker.recognize(filePath);
      const textoExtraido = ret.data.text || '';
      console.log(
        `[OCR] Texto extraído (primeros 400 chars): ${textoExtraido.substring(
          0,
          400,
        )}...`,
      );

      let parsedData = this.parsearTextoDeTesseract(textoExtraido);

      if (!parsedData || !parsedData.items || parsedData.items.length === 0) {
        parsedData = this.buildFallbackData();
      }

      await this.prisma.digitalizedRemito.update({
        where: { id: remitoId },
        data: {
          // ⬇️ CAMBIO: casteamos a InputJsonValue (aceptado por Prisma)
          extractedData: parsedData as Prisma.InputJsonValue,
          status: DigitalizationStatus.PENDING_VALIDATION,
          errorMessage: null,
        },
      });

      console.log(`[OCR] Procesamiento Tesseract exitoso para: ${remitoId}`);
    } catch (error) {
      console.error(`[OCR] Falló el procesamiento para: ${remitoId}`, error);

      const fallback = this.buildFallbackData();

      await this.prisma.digitalizedRemito.update({
        where: { id: remitoId },
        data: {
          // ⬇️ CAMBIO: idem acá
          extractedData: fallback as Prisma.InputJsonValue,
          status: DigitalizationStatus.PENDING_VALIDATION,
          errorMessage: (error as Error).message,
        },
      });

      console.log(
        `[OCR] Marcado como PENDING_VALIDATION con datos básicos para: ${remitoId}`,
      );
    } finally {
      if (worker) {
        await worker.terminate();
      }
      console.log(`[OCR] Trabajador Tesseract terminado para: ${remitoId}`);
    }
  }

  // =========================================
  // 3) PARSER MEJORADO (SE PUEDE IR AJUSTANDO)
  // =========================================
  private parsearTextoDeTesseract(texto: string): any {
    console.log('[Parser] Analizando texto real con Regex...');

    type ExtractedItem = {
      detectedCode: string;
      detectedName: string;
      qty: number;
    };
    const items: ExtractedItem[] = [];

    const patronesProveedor: RegExp[] = [
      /Raz[oó]n Social\s*[:—-]\s*(.+)/im,
      /Señor\(es\)\s*[:—-]\s*(.+)/im,
      /Cliente\s*[:—-]\s*(.+)/im,
      /Proveedor\s*[:—-]\s*(.+)/im,
    ];

    const patronesFecha: RegExp[] = [
      /Fecha(?: de Emisi[oó]n)?\s*[:—-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/im,
      /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/im,
    ];

    const patronesCuit: RegExp[] = [
      /C\.?U\.?I\.?T\.?\s*N?°?\s*[:—-]?\s*(\d{2}-\d{8}-\d)/im,
      /(\d{2}-\d{8}-\d)/im,
    ];

    const patronesDireccion: RegExp[] = [
      /Direcci[oó]n\s*[:—-]?\s*(.+)/im,
      /Domicilio\s*[:—-]?\s*(.+)/im,
    ];

    const provider =
      this.findFirstMatch(texto, patronesProveedor) ||
      'Proveedor (no detectado)';
    const date =
      this.findFirstMatch(texto, patronesFecha) ||
      new Date().toLocaleDateString('es-AR');
    const cuit = this.findFirstMatch(texto, patronesCuit) || '';
    const address = this.findFirstMatch(texto, patronesDireccion) || '';

    const lineas = texto
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const indiceHeader = lineas.findIndex((line) =>
      /(c[oó]digo|c[oó]d|art[ií]culo).*(descripci[oó]n|detalle).*(cant\.?|cantidad)/i.test(
        line,
      ),
    );

    if (indiceHeader >= 0) {
      for (let i = indiceHeader + 1; i < lineas.length; i++) {
        const linea = lineas[i];

        if (/total/i.test(linea)) break;

        const partes = linea.split(/\s{2,}/);

        if (partes.length >= 2) {
          const primera = partes[0].trim();
          const ultima = partes[partes.length - 1].trim();

          const qty = parseInt(ultima, 10);
          if (!isNaN(qty) && qty > 0 && qty < 10000) {
            const codigo = primera;
            const nombre = partes
              .slice(1, partes.length - 1)
              .join(' ')
              .trim();

            items.push({
              detectedCode: codigo || 'SIN-CODIGO',
              detectedName: nombre || 'Producto sin nombre',
              qty,
            });
          }
        }
      }
    }

    if (items.length === 0) {
      items.push({
        detectedCode: '',
        detectedName: 'Ítem no detectado (completar manualmente)',
        qty: 1,
      });
    }

    console.log(
      `[Parser] Detectado: ${provider}, CUIT: ${cuit}, Fecha: ${date}, Dirección: ${address}, Ítems: ${items.length}`,
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

  private buildFallbackData(): any {
    return {
      provider: 'Proveedor (completar manualmente)',
      date: new Date().toLocaleDateString('es-AR'),
      customerCuit: '',
      customerAddress: '',
      customerTaxCondition: '',
      items: [
        {
          detectedCode: '',
          detectedName: 'Ítem no detectado (completar manualmente)',
          qty: 1,
        },
      ],
    };
  }

  private findFirstMatch(texto: string, patrones: RegExp[]): string | null {
    for (const patron of patrones) {
      const match = texto.match(patron);
      if (match && match[1]) {
        const limpio = match[1].trim().split('\n')[0];
        if (limpio) return limpio;
      }
    }
    return null;
  }

  // ========================
  // 4) LISTAR PENDIENTES
  // ========================
  async findPendingByBranch(branchId: string) {
    return this.prisma.digitalizedRemito.findMany({
      where: { branchId, status: DigitalizationStatus.PENDING_VALIDATION },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ========================
  // 5) OBTENER UNO
  // ========================
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

  // ========================
  // 6) VALIDAR Y FINALIZAR
  // ========================
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
                code: item.detectedCode || `AUTO-${Date.now()}`,
                name: item.detectedName || 'Producto sin nombre',
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
