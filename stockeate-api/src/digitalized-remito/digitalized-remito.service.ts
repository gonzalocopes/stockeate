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

  // -------- 1) Crear registro inicial y lanzar OCR en background ----------
  async createInitialRemito(
    file: Express.Multer.File,
    userIdOrNull: string | null,
    branchId: string,
  ) {
    this.logger.log(
      `[createInitialRemito] file=${file?.originalname} userId=${userIdOrNull} branchId=${branchId}`,
    );

    let userIdToSave: string | null = userIdOrNull;

    // Verificar que el userId exista; si no, guardamos en null
    if (userIdOrNull) {
      const userExists = await this.prisma.user.findUnique({
        where: { id: userIdOrNull },
        select: { id: true },
      });

      if (!userExists) {
        this.logger.error(
          `[createInitialRemito] FK userId inválido (${userIdOrNull}), creando remito sin usuario`,
        );
        userIdToSave = null;
      }
    }

    const newDigitalizedRemito = await this.prisma.digitalizedRemito.create({
      data: {
        userId: userIdToSave,
        branchId,
        originalFileUrl: file.path,
        status: DigitalizationStatus.PROCESSING,
      },
    });

    // Lanzamos OCR en background (sin esperar)
    this.processOcr(newDigitalizedRemito.id, file.path).catch((err) => {
      this.logger.error(
        `[createInitialRemito] Error lanzando OCR para ${newDigitalizedRemito.id}`,
        err.stack,
      );
    });

    return newDigitalizedRemito;
  }

  // -------- 2) Procesar OCR con Tesseract -------------------
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
        },
      });

      this.logger.log(
        `[OCR] Procesamiento Tesseract exitoso para: ${remitoId}`,
      );
    } catch (error) {
      this.logger.error(
        `[OCR] Falló el procesamiento para: ${remitoId}`,
        (error as Error).stack,
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

  // -------- 3) Parser "inteligente" del texto del OCR -------------------
  private parsearTextoDeTesseract(texto: string): any {
    this.logger.log('[Parser] Analizando texto real con Regex...');

    type ExtractedItem = {
      detectedCode: string;
      detectedName: string;
      qty: number;
    };

    const items: ExtractedItem[] = [];

    // Patrones de proveedor / fecha / cuit / dirección
    const patronesProveedor: RegExp[] = [
      /Raz[oó]n Social\s*[:—]\s*(.*)/im,
      /Señor\(es\)\s*[:—]\s*(.*)/im,
      /Cliente\s*[:—]\s*(.*)/im,
    ];

    const patronesFecha: RegExp[] = [
      /Fecha (?:de Emisi[oó]n)?\s*[:—]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/im,
      /(\d{2}[\/-]\d{2}[\/-]\d{4})/im,
    ];

    const patronesCuit: RegExp[] = [
      /C\.?U\.?I\.?T\.?\s*N?°?\s*[:—]?\s*(\d{2}-\d{8}-\d{1})/im,
      /(\d{2}-\d{8}-\d{1})/im,
    ];

    const patronesDireccion: RegExp[] = [
      /Direcci[oó]n\s*[:—]?\s*(.*)/im,
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

    // --- Intento de parseo del bloque "DETALLE DE PRODUCTOS" ---
    try {
      const lineas = texto
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const startIdx = lineas.findIndex((l) =>
        /DETALLE\s+DE\s+PRODUCTOS/i.test(l),
      );

      if (startIdx !== -1) {
        for (let i = startIdx + 1; i < lineas.length; i++) {
          const linea = lineas[i];

          // Cortamos al llegar a OBSERVACIONES u otro título
          if (/^OBSERVACIONES/i.test(linea)) break;

          // Ejemplo: PRD001 Aceite Girasol 1L 12 56
          const match = linea.match(
            /^([A-Z0-9]{3,})\s+(.+?)\s+(\d+)\s+(\d+)\s*$/,
          );
          if (match) {
            const code = match[1].trim();
            const name = match[2].trim();
            const qtyNum = Number(match[3]);
            const qty = Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 1;

            items.push({
              detectedCode: code,
              detectedName: name,
              qty,
            });
          }
        }
      }
    } catch (e) {
      this.logger.error(
        `[Parser] Error intentando parsear DETALLE DE PRODUCTOS: ${(e as Error).message}`,
      );
    }

    // Si no se detectan ítems, dejamos uno "dummy" editable
    if (items.length === 0) {
      items.push({
        detectedCode: '', // vacío -> el placeholder se maneja en el front
        detectedName: 'Ítem no detectado (Editar)',
        qty: 1,
      });
    }

    this.logger.log(
      `[Parser] Detectado: ${provider}, CUIT: ${cuit}, Fecha: ${date}, Dirección: ${address}, items=${items.length}`,
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
        const limpio = match[1].trim().split('\n')[0];
        if (limpio) return limpio;
      }
    }
    return null;
  }

  // -------- 4) Listar pendientes por sucursal -------------------
  async findPendingByBranch(branchId: string) {
    return this.prisma.digitalizedRemito.findMany({
      where: { branchId, status: DigitalizationStatus.PENDING_VALIDATION },
      orderBy: { createdAt: 'desc' },
    });
  }

  // -------- 5) Traer uno por ID -------------------
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

  // -------- 6) Validar y crear Remito de entrada + stock  ----------
  async validateAndFinalizeRemito(
    id: string,
    validationData: ValidationDataDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Buscar el remito digitalizado
      const digitalizedRemito = await tx.digitalizedRemito.findUnique({
        where: { id },
      });

      if (
        !digitalizedRemito ||
        digitalizedRemito.status !== DigitalizationStatus.PENDING_VALIDATION
      ) {
        throw new NotFoundException(
          'Remito no encontrado o ya fue procesado.',
        );
      }

      const branchId = digitalizedRemito.branchId;

      // 2. Procesar ítems: buscar/crear productos y calcular precio
      const processedItems = await Promise.all(
        (validationData.items || []).map(async (item, index) => {
          // --- Normalizar campos básicos ---
          let rawCode = (item.detectedCode || '').trim();

          // Tratamos '???' o textos tipo "ingresar código" como "sin código"
          if (
            !rawCode ||
            rawCode === '???' ||
            rawCode.toLowerCase().includes('ingresar código')
          ) {
            rawCode = '';
          }

          const name =
            (item.detectedName || '').trim() || 'Producto sin nombre';

          // Cantidad: siempre entero >= 1
          const parsedQty = Number(item.qty);
          const qty =
            Number.isFinite(parsedQty) && parsedQty > 0
              ? Math.floor(parsedQty)
              : 1;

          // Precio: si viene lo usamos, si no 0. Nunca afecta si se procesa o no.
          const rawUnitPrice =
            (item as any).unitPrice ?? (item as any).price ?? 0;
          const parsedPrice = Number(rawUnitPrice);
          const unitPriceNumber =
            isNaN(parsedPrice) || parsedPrice < 0 ? 0 : parsedPrice;
          const unitPriceDecimal = new Prisma.Decimal(unitPriceNumber);

          // Si no trae código, generamos uno
          const code =
            rawCode ||
            `SKU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

          this.logger.log(
            `[validateAndFinalizeRemito] Ítem #${index} -> code=${code}, name="${name}", qty=${qty}, price=${unitPriceNumber}`,
          );

          // Buscar producto por código + sucursal
          let product = await tx.product.findFirst({
            where: { code, branchId },
          });

          // Si no existe, lo creamos SIEMPRE (aunque el precio sea 0)
          if (!product) {
            product = await tx.product.create({
              data: {
                branchId,
                code,
                name,
                price: unitPriceDecimal, // puede ser 0 sin problema
                stock: 0,
                isActive: true,
              },
            });

            this.logger.log(
              `[validateAndFinalizeRemito] Producto creado -> id=${product.id}, code=${code}, price=${unitPriceNumber}`,
            );
          } else {
            // Si existe y el precio > 0, actualizamos el price del producto (opcional)
            if (unitPriceNumber > 0) {
              await tx.product.update({
                where: { id: product.id },
                data: { price: unitPriceDecimal },
              });
              this.logger.log(
                `[validateAndFinalizeRemito] Precio actualizado para product=${product.id} -> ${unitPriceNumber}`,
              );
            }
          }

          return {
            productId: product.id,
            code,
            name,
            qty,
            unitPriceDecimal,
          };
        }),
      );

      // 3. Crear Remito de entrada
      const newRemito = await tx.remito.create({
        data: {
          branchId,
          tmpNumber: `ENT-${Date.now()}`,
          customer: validationData.provider || 'Cliente no especificado',
          notes: `Ingreso por digitalización. Origen: ${id}`,
          digitalizedOriginId: id,
          customerCuit: validationData.customerCuit || null,
          customerAddress: validationData.customerAddress || null,
          customerTaxCondition: validationData.customerTaxCondition || null,
          items: {
            create: processedItems.map((item) => ({
              productId: item.productId,
              qty: item.qty,
              unitPrice: item.unitPriceDecimal,
            })),
          },
        },
      });

      // 4. Actualizar stock y movimientos SIEMPRE para TODOS los ítems
      for (const item of processedItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.qty } },
        });

        await tx.stockMove.create({
          data: {
            productId: item.productId,
            branchId,
            qty: item.qty,
            type: 'IN',
            ref: `Remito de entrada ${newRemito.tmpNumber}`,
          },
        });

        this.logger.log(
          `[validateAndFinalizeRemito] Stock incrementado -> product=${item.productId}, +${item.qty}`,
        );
      }

      // 5. Marcar el remito digitalizado como COMPLETED
      return tx.digitalizedRemito.update({
        where: { id },
        data: { status: DigitalizationStatus.COMPLETED },
      });
    });
  }
}
