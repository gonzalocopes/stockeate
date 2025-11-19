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

  // ---------------------------------------------------------------------------
  // 1) Crear el registro inicial cuando se sube el archivo
  // ---------------------------------------------------------------------------
  async createInitialRemito(
    file: Express.Multer.File,
    userId: string | null,
    branchId: string,
  ) {
    this.logger.log(
      `[createInitialRemito] file=${file?.originalname} userId=${userId ?? 'anonymous'} branchId=${branchId}`,
    );

    // Intentamos verificar que el userId exista
    let finalUserId: string | null = userId;
    if (userId) {
      try {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
          this.logger.error(
            `[createInitialRemito] userId inválido (${userId}), creando remito sin usuario`,
          );
          finalUserId = null;
        }
      } catch (err) {
        this.logger.error(
          `[createInitialRemito] Error consultando usuario (${userId}), creando remito sin usuario: ${(
            err as Error
          ).message}`,
        );
        finalUserId = null;
      }
    }

    // Creamos el DigitalizedRemito (userId puede ser null)
    const newDigitalizedRemito = await this.prisma.digitalizedRemito.create({
      data: {
        userId: finalUserId,
        branchId,
        originalFileUrl: file.path,
        status: DigitalizationStatus.PROCESSING,
      },
    });

    // Lanzamos OCR en background (no esperamos)
    this.processOcr(newDigitalizedRemito.id, file.path).catch((err) => {
      this.logger.error(`[createInitialRemito] Error lanzando OCR: ${(err as Error).message}`);
    });

    return newDigitalizedRemito;
  }

  // ---------------------------------------------------------------------------
  // 2) Procesar OCR (JPG/PNG) o fallback para PDF
  // ---------------------------------------------------------------------------
  private async processOcr(remitoId: string, filePath: string) {
    this.logger.log(`[OCR] Iniciando Tesseract para: ${remitoId} (${filePath})`);

    const isPdf = filePath.toLowerCase().endsWith('.pdf');

    // Si es PDF y todavía no tenés soporte real, hacemos un fallback
    if (isPdf) {
      this.logger.warn(
        `[OCR] Archivo PDF detectado (${filePath}). Por ahora no se procesa con Tesseract, se envía a validación manual.`,
      );

      const fallback = {
        provider: 'Proveedor (no detectado)',
        date: new Date().toISOString().slice(0, 10),
        customerCuit: '',
        customerAddress: '',
        customerTaxCondition: '',
        items: [
          {
            detectedCode: '???',
            detectedName: 'Ítem no detectado (Editar manualmente)',
            qty: 1,
            price: 0,
          },
        ],
      };

      await this.prisma.digitalizedRemito.update({
        where: { id: remitoId },
        data: {
          extractedData: fallback as Prisma.InputJsonValue,
          status: DigitalizationStatus.PENDING_VALIDATION,
        },
      });

      this.logger.log(
        `[OCR] PDF ${filePath} enviado a PENDING_VALIDATION con datos genéricos para edición manual.`,
      );
      return;
    }

    // ---- IMAGEN (JPG/PNG) → OCR real ----
    const worker = await createWorker('spa');
    try {
      const ret = await worker.recognize(filePath);
      const textoExtraido = ret.data.text || '';
      this.logger.log(
        `[OCR] Texto extraído (primeros 400 chars): ${textoExtraido.substring(0, 400)}...`,
      );

      const parsedData = this.parsearTextoDeTesseract(textoExtraido);

      await this.prisma.digitalizedRemito.update({
        where: { id: remitoId },
        data: {
          extractedData: parsedData as Prisma.InputJsonValue,
          status: DigitalizationStatus.PENDING_VALIDATION,
        },
      });

      this.logger.log(`[OCR] Procesamiento Tesseract exitoso para: ${remitoId}`);
    } catch (error) {
      this.logger.error(`[OCR] Falló el procesamiento para: ${remitoId}`, error as Error);

      const fallback = {
        provider: 'Proveedor (no detectado)',
        date: new Date().toISOString().slice(0, 10),
        customerCuit: '',
        customerAddress: '',
        customerTaxCondition: '',
        items: [
          {
            detectedCode: '???',
            detectedName: 'Ítem no detectado (Editar manualmente)',
            qty: 1,
            price: 0,
          },
        ],
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
      this.logger.log(`[OCR] Trabajador Tesseract terminado para: ${remitoId}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 3) Parser de texto OCR → estructura básica para la app
  // ---------------------------------------------------------------------------
  private parsearTextoDeTesseract(texto: string): any {
    this.logger.log('[Parser] Analizando texto real con Regex...');

    type ExtractedItem = {
      detectedCode: string;
      detectedName: string;
      qty: number;
      price?: number;
    };
    const items: ExtractedItem[] = [];

    // --- Patrones auxiliares ---
    const patronesProveedor: RegExp[] = [
      /Raz[oó]n Social\s*[:—-]\s*(.*)/im,
      /Señor\(es\)\s*[:—-]\s*(.*)/im,
      /Cliente\s*[:—-]\s*(.*)/im,
    ];

    const patronesFecha: RegExp[] = [
      /Fecha(?: de Emisi[oó]n)?\s*[:—-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/im,
      /(\d{2}[\/-]\d{2}[\/-]\d{4})/im,
    ];

    const patronesCuit: RegExp[] = [
      /C\.?U\.?I\.?T\.?\s*N?°?\s*[:—-]?\s*(\d{2}-\d{8}-\d{1})/im,
      /(\d{2}-\d{8}-\d{1})/im,
    ];

    const patronesDireccion: RegExp[] = [
      /Direcci[oó]n\s*[:—-]?\s*(.*)/im,
      /Domicilio\s*[:—-]?\s*(.*)/im,
    ];

    const provider =
      this.findFirstMatch(texto, patronesProveedor) || 'Proveedor (no detectado)';
    const date =
      this.findFirstMatch(texto, patronesFecha) ||
      new Date().toISOString().slice(0, 10);
    const cuit = this.findFirstMatch(texto, patronesCuit) || '';
    const address = this.findFirstMatch(texto, patronesDireccion) || '';

    // 👇 Por ahora no parseamos tabla real; sólo un ítem dummy.
    if (items.length === 0) {
      items.push({
        detectedCode: '???',
        detectedName: 'Ítem no detectado (Editar)',
        qty: 1,
        price: 0,
      });
    }

    this.logger.log(
      `[Parser] Detectado: provider=${provider}, CUIT=${cuit}, Fecha=${date}, Dirección=${address}`,
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

  // ---------------------------------------------------------------------------
  // 4) Consultas auxiliares
  // ---------------------------------------------------------------------------
  async findPendingByBranch(branchId: string) {
    return this.prisma.digitalizedRemito.findMany({
      where: { branchId, status: DigitalizationStatus.PENDING_VALIDATION },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const remito = await this.prisma.digitalizedRemito.findUnique({ where: { id } });
    if (!remito) {
      throw new NotFoundException(`Remito digitalizado con ID ${id} no encontrado.`);
    }
    return remito;
  }

  // ---------------------------------------------------------------------------
  // 5) Validar y finalizar remito → CREA productos + remito + stockMove
  // ---------------------------------------------------------------------------
  async validateAndFinalizeRemito(id: string, validationData: ValidationDataDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Busca el remito digitalizado
      const digitalizedRemito = await tx.digitalizedRemito.findUnique({
        where: { id },
      });

      if (!digitalizedRemito || digitalizedRemito.status !== 'PENDING_VALIDATION') {
        throw new NotFoundException('Remito no encontrado o ya fue procesado.');
      }

      // 2. Normalizamos items (evitar qty 0 y asegurar código/nombre)
      const sanitizedItems = (validationData.items || []).filter(
        (i) => i.qty && i.qty > 0,
      );

      if (!sanitizedItems.length) {
        throw new NotFoundException(
          'No hay ítems válidos para procesar (cantidad > 0).',
        );
      }

      const processedItems = await Promise.all(
        sanitizedItems.map(async (item, index) => {
          const rawCode = item.detectedCode?.trim() || '';
          const rawName = item.detectedName?.trim() || '';
          const qty = item.qty || 0;
          const price =
            (item as any).price !== undefined && (item as any).price !== null
              ? Number((item as any).price)
              : 0;

          const code =
            rawCode === '' ? `REM-${Date.now()}-${index + 1}` : rawCode;
          const name = rawName === '' ? 'Producto sin nombre' : rawName;

          // 2.a) Busca o crea el producto por código
          let product = await tx.product.findUnique({
            where: { code },
          });

          if (!product) {
            product = await tx.product.create({
              data: {
                branchId: digitalizedRemito.branchId,
                code,
                name,
                stock: 0,
                isActive: true,
                price: price || 0,
              },
            });
          }

          return {
            ...item,
            productId: product.id,
            qty,
            price,
            code,
            name,
          };
        }),
      );

      // 3. Crea el Remito de ENTRADA oficial con los nuevos campos
      const newRemito = await tx.remito.create({
        data: {
          branchId: digitalizedRemito.branchId,
          tmpNumber: `ENT-${Date.now()}`,
          customer: validationData.provider || 'Sin proveedor',
          notes: `Ingreso por digitalización. Origen: ${id}`,
          digitalizedOriginId: id,
          customerCuit: validationData.customerCuit || '',
          customerAddress: validationData.customerAddress || '',
          customerTaxCondition: validationData.customerTaxCondition || '',
          items: {
            create: processedItems.map((item) => ({
              productId: item.productId,
              qty: item.qty,
              unitPrice: item.price || 0,
            })),
          },
        },
      });

      // 4. Actualiza el stock + crea movimientos
      for (const item of processedItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.qty },
            // Si el precio > 0, actualizamos el price del producto
            ...(item.price && item.price > 0 ? { price: item.price } : {}),
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

      // 5. Marca el remito digitalizado como COMPLETADO
      return tx.digitalizedRemito.update({
        where: { id },
        data: { status: DigitalizationStatus.COMPLETED },
      });
    });
  }
}
