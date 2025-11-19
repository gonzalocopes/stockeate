// src/digitalized-remito/digitalized-remito.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
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

  // --- 1) Crear registro inicial y lanzar OCR en background ---
  async createInitialRemito(
    file: Express.Multer.File,
    userId: string | null,
    branchId: string,
  ) {
    this.logger.log(
      `[createInitialRemito] file=${file?.originalname} userId=${
        userId ?? 'anonymous'
      } branchId=${branchId}`,
    );

    // userId AHORA ES OPCIONAL → validamos que exista antes de grabar
    let safeUserId: string | null = null;
    if (userId) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });
        if (user) {
          safeUserId = user.id;
        } else {
          this.logger.error(
            `[createInitialRemito] FK userId inválido (${userId}), creando remito sin usuario`,
          );
        }
      } catch (e) {
        this.logger.error(
          '[createInitialRemito] Error verificando userId',
          e as any,
        );
      }
    }

    const newDigitalizedRemito = await this.prisma.digitalizedRemito.create({
      data: {
        userId: safeUserId,
        branchId,
        originalFileUrl: file.path,
        status: DigitalizationStatus.PROCESSING,
      },
    });

    // Lanzamos OCR en background (no bloquea la respuesta)
    this.processOcr(newDigitalizedRemito.id, file.path).catch((err) =>
      this.logger.error(
        `[processOcr] Error procesando remito ${newDigitalizedRemito.id}`,
        err,
      ),
    );

    return newDigitalizedRemito;
  }

  // --- 2) OCR con Tesseract ---
  private async processOcr(remitoId: string, filePath: string) {
    this.logger.log(
      `[OCR] Iniciando Tesseract para: ${remitoId} (${filePath})`,
    );
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
          extractedData: parsedData as Prisma.JsonValue,
          status: DigitalizationStatus.PENDING_VALIDATION,
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
      await this.prisma.digitalizedRemito.update({
        where: { id: remitoId },
        data: {
          status: DigitalizationStatus.FAILED,
          errorMessage: (error as Error).message,
        },
      });
    } finally {
      await worker.terminate();
      this.logger.log(`[OCR] Trabajador Tesseract terminado para: ${remitoId}`);
    }
  }

  // --- 3) Parser simple (igual que tenías, solo devuelvo el objeto) ---
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
      'Proveedor (no detectado)';
    const date =
      this.findFirstMatch(texto, patronesFecha) ||
      new Date().toISOString().slice(0, 10);
    const cuit = this.findFirstMatch(texto, patronesCuit) || '';
    const address = this.findFirstMatch(texto, patronesDireccion) || '';

    // ⬇ Por ahora un solo ítem genérico
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

  // --- 4) Pending por sucursal ---
  async findPendingByBranch(branchId: string) {
    return this.prisma.digitalizedRemito.findMany({
      where: { branchId, status: DigitalizationStatus.PENDING_VALIDATION },
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- 5) Obtener uno ---
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

  // --- 6) Validar y volcar a Remito + Stock ---
  async validateAndFinalizeRemito(
    id: string,
    validationData: ValidationDataDto,
  ) {
    this.logger.log(
      `[validateAndFinalizeRemito] id=${id} payload=${JSON.stringify(
        validationData,
      )}`,
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Remito digitalizado
        const digitalizedRemito = await tx.digitalizedRemito.findUnique({
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

        // 2. Normalizamos ítems (importante para evitar errores raros)
        const saneItems = (validationData.items || [])
          .map((item, index) => {
            const rawQty = (item as any).qty;
            const rawPrice = (item as any).price;

            const qty = Number.isFinite(Number(rawQty))
              ? Number(rawQty)
              : 0;
            const price = Number.isFinite(Number(rawPrice))
              ? Number(rawPrice)
              : 0;

            return {
              index,
              detectedCode: (item.detectedCode || '').trim(),
              detectedName: (item.detectedName || '').trim(),
              qty,
              price,
            };
          })
          .filter((i) => i.qty > 0); // solo mantenemos cantidades > 0

        if (!saneItems.length) {
          throw new BadRequestException(
            'Debe haber al menos un ítem con cantidad mayor a 0.',
          );
        }

        // 3. Buscar o crear productos
        const processedItems = await Promise.all(
          saneItems.map(async (item) => {
            let code = item.detectedCode;
            if (!code) {
              code = `AUTO-${Date.now()}-${item.index}`;
            }

            const name =
              item.detectedName && item.detectedName.length > 0
                ? item.detectedName
                : 'Producto sin nombre';

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
                  price: item.price ?? 0,
                },
              });
            } else if (item.price > 0) {
              // si ya existe, podemos actualizar precio y nombre
              product = await tx.product.update({
                where: { id: product.id },
                data: {
                  price: item.price,
                  name,
                },
              });
            }

            return {
              ...item,
              productId: product.id,
            };
          }),
        );

        // 4. Crear Remito de ENTRADA
        const tmpNumber = `ENT-${Date.now()}-${Math.floor(
          Math.random() * 1000,
        )}`;

        const newRemito = await tx.remito.create({
          data: {
            branchId: digitalizedRemito.branchId,
            tmpNumber,
            customer: validationData.provider || null,
            notes: `Ingreso por digitalización. Origen: ${id}`,
            digitalizedOriginId: id,
            customerCuit: validationData.customerCuit || null,
            customerAddress: validationData.customerAddress || null,
            customerTaxCondition: validationData.customerTaxCondition || null,
            items: {
              create: processedItems.map((item) => ({
                productId: item.productId,
                qty: item.qty,
                unitPrice: item.price ?? 0,
              })),
            },
          },
        });

        // 5. Actualizar stock + movimiento
        for (const item of processedItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                increment: item.qty,
              },
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

        // 6. Marcar digitalizado como COMPLETED
        return tx.digitalizedRemito.update({
          where: { id },
          data: {
            status: DigitalizationStatus.COMPLETED,
          },
        });
      });
    } catch (err) {
      this.logger.error(
        '[validateAndFinalizeRemito] Error al validar remito',
        err as any,
      );
      throw err;
    }
  }
}
