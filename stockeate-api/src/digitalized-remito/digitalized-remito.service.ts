// src/digitalized-remito/digitalized-remito.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DigitalizationStatus, Prisma } from '@prisma/client';
import { ValidationDataDto } from './dto/validation-data.dto';
import { createWorker } from 'tesseract.js';

// --- DEFINICIONES DE TIPOS ---
type ParsedItem = {
  detectedCode: string;
  detectedName: string;
  qty: number;
  price?: number; // Mantenemos opcional en la interfaz por si el DTO del cliente lo requiere, pero el parser lo ignorará.
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

// ---------------------------------------------------------------------
// -------- 1) Crear registro inicial y lanzar OCR en background -------
// ---------------------------------------------------------------------
  async createInitialRemito(
    file: Express.Multer.File,
    userIdOrNull: string | null,
    branchId: string,
  ) {
    this.logger.log(
      `[createInitialRemito] file=${file?.originalname} userId=${userIdOrNull} branchId=${branchId}`,
    );

    let userIdToSave: string | null = userIdOrNull;

    // Verificar que el userId exista (Lógica original)
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
        // Parche para error de tipado de Prisma si userId es String y no String?
        userId: userIdToSave,
        branchId,
        originalFileUrl: file.path,
        status: DigitalizationStatus.PROCESSING,
      } as any, 
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

// ---------------------------------------------------------------------
// -------- 2) Procesar OCR con Tesseract -------------------
// ---------------------------------------------------------------------
  private async processOcr(remitoId: string, filePath: string) {
    this.logger.log(`[OCR] Iniciando Tesseract para: ${remitoId}`);
    // Usamos 'spa+eng' para mejor detección de códigos y marcas
    const worker = await createWorker('spa+eng'); 

    try {
        await worker.load();
        await worker.setParameters({
            // Usamos el modo Single Column para las listas de ítems
            tessedit_pageseg_mode: 6 as any, 
        });

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

// ---------------------------------------------------------------------
// -------- FUNCIONES HELPER AVANZADAS (Limpieza y RegEx) ----------------
// ---------------------------------------------------------------------

  private cleanText(texto: string): string {
    let cleaned = texto.replace(/[\r\n]+/g, '\n').trim();
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    // UNIFICAR GUIONES Y CORRECCIÓN DE CARACTERES COMUNES EN OCR
    cleaned = cleaned.replace(/—/g, '-'); 
    cleaned = cleaned.replace(/\|/g, '1'); // | suele ser un 1

    return cleaned;
  }

  private findFirstMatch(texto: string, patrones: RegExp[]): string | null {
    for (const patron of patrones) {
        const match = texto.match(patron);
        if (match && match[1]) {
            // Limita la captura a 100 caracteres y detiene en el primer salto de línea
            const limpio = match[1].trim().split('\n')[0].substring(0, 100).trim();
            if (limpio) return limpio;
        }
    }
    return null;
  }

// ---------------------------------------------------------------------
// -------- 3) Parser "inteligente" del texto del OCR -------------------
// ---------------------------------------------------------------------
// ... (Tus funciones cleanText y findFirstMatch se mantienen igual)

// ---------------------------------------------------------------------
// -------- 3) Parser "inteligente" del texto del OCR -------------------
// ---------------------------------------------------------------------
private parsearTextoDeTesseract(textoBruto: string): ParsedData {
    this.logger.log('[Parser] Analizando texto con RegEx optimizado para códigos cortos y Cantidad opcional...');

    const texto = this.cleanText(textoBruto);
    const lines = texto.split('\n');
    let items: ParsedItem[] = [];

    // --- A) Patrones de cabecera (Se mantienen igual) ---
    // ... (patronesProveedor, patronesFecha, patronesCuit, etc. aquí) ...

    // (Se asume que la extracción de datos de cabecera sigue aquí y funciona correctamente)
    const provider = this.findFirstMatch(texto, [/* ... */]) || 'Proveedor (no detectado)';
    const date = this.findFirstMatch(texto, [/* ... */]) || new Date().toISOString().slice(0, 10);
    const cuitRaw = this.findFirstMatch(texto, [/* ... */]);
    const cuit = cuitRaw ? cuitRaw.replace(/[-.\s]/g, '') : '';
    const address = this.findFirstMatch(texto, [/* ... */]) || '';
    const customerTaxCondition = this.findFirstMatch(texto, [/* ... */]) || '';


    // --- B) Extracción de Ítems (RegEx Súper Agresiva) ---

    // 1. Delimitación de Tabla
    const startOfItemsKeywords = /(?:N[o°]|\s)C[OÓ]DIGO|ART[IÍ]CULO|CANTIDAD|DETALLE|DESCRIPCI[OÓ]N|PRODUCTO|CANT\. ENVIADA/i;
    let startIndex = lines.findIndex(line => line.match(startOfItemsKeywords));
    
    startIndex = startIndex !== -1 ? startIndex + 1 : (lines.length > 5 ? 5 : 0); 

    // 2. RegEx ÚNICA: Solo busca [Código] [Nombre/Descripción] [Cantidad (Opcional)]
    const itemRegexAgresiva = new RegExp(
        [
            /^\s*(?:\d{1,4}\s*)?/.source, // Opcional: Número de línea (Ej: 1, 2, 3...)
            
            // 1. Código: Acepta números cortos (1 o 2 dígitos) o alfanuméricos (min 2 chars)
            /\b(?<code>[A-Z0-9\-\.\/\s]{1,20})\b/.source, 
            /\s{1,}/.source, 
            
            // 2. Nombre/Descripción: Captura caracteres amplios, hasta que encuentra el patrón de número final.
            /(?<name>[A-ZÁÉÍÓÚÑ0-9 ,.\-\/\(\)\[\]\%]{3,80}?)/i.source, 
            /\s{1,}/.source, 
            
            // 3. Cantidad: El último valor numérico esperado. (LO HACEMOS OPCIONAL)
            /(?<qty>\d{1,8}(?:[.,]\d{1,3})?)?/.source, 
            /.*$/i.source // Captura el resto de la línea
        ].join(''), 
        'i'
    );

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.length < 5) continue; // Si la línea es muy corta, ignoramos.

        // Condición de fin de tabla (delimitación)
        if (line.match(/(SUBTOTAL|TOTAL|IVA|PERCEPCIONES|NOTAS|OBSERVACIONES|RECIBI|FIRMA|PESO TOTAL|SUMA)/i)) {
            break;
        }

        const m = line.match(itemRegexAgresiva);
        if (!m || !m.groups || !m.groups.code) continue; // Si no hay match válido, seguimos.

        // Extracción de grupos
        const code = m.groups.code.trim();
        const name = m.groups.name.trim();
        const qtyRaw = m.groups.qty; // Puede ser undefined si la cantidad es opcional

        let qty: number;
        
        // 1. Asignación de Cantidad: Si se detecta, se parsea. Si no, se asigna 1 (por defecto).
        if (qtyRaw) {
            qty = parseFloat(qtyRaw.replace(',', '.'));
        } else {
            qty = 1; // Asumimos 1 si no se detectó la columna QTY.
        }


        // Filtro de calidad final:
        // Aseguramos que el código no sea solo una letra o un símbolo, y que el nombre sea útil.
        if (code.length < 1 || name.length < 3 || !Number.isFinite(qty) || qty <= 0) continue;

        items.push({
            detectedCode: code,
            detectedName: name,
            qty: qty, 
            price: undefined, // Siempre indefinido por regla de negocio
        });
    }

    // Fallback si no se encontró nada
    if (items.length === 0) {
        this.logger.warn('[Parser] No se detectaron ítems válidos. Usando fallback.');
        items.push({
            detectedCode: 'FALLBACK-ITEM',
            detectedName: 'Ítem no detectado (Requiere edición)',
            qty: 1,
            price: 0
        });
    }

    this.logger.log(
      `[Parser] Detectado: ${provider}, CUIT: ${cuit}, Fecha: ${date}, Items: ${items.length}`,
    );

    return {
        provider,
        date,
        customerCuit: cuit,
        customerAddress: address,
        customerTaxCondition,
        items,
    };
}

// ---------------------------------------------------------------------
// -------- 4) Listar pendientes por sucursal -------------------
// ---------------------------------------------------------------------
  async findPendingByBranch(branchId: string) {
    return this.prisma.digitalizedRemito.findMany({
      where: { branchId, status: DigitalizationStatus.PENDING_VALIDATION },
      orderBy: { createdAt: 'desc' },
    });
  }

// ---------------------------------------------------------------------
// -------- 5) Traer uno por ID -------------------
// ---------------------------------------------------------------------
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

// ---------------------------------------------------------------------
// -------- 6) Validar y crear Remito de entrada + stock  ----------
// ---------------------------------------------------------------------
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
          // Normalizar códigos nulos o de fallback (ej: '???', 'ingresar código')
          if (!rawCode || ['???', 'ingresar código'].includes(rawCode.toLowerCase())) {
            rawCode = '';
          }

          const name =
            (item.detectedName || '').trim() || 'Producto sin nombre';

          // Cantidad: acepta decimales si los hubiera
          const parsedQty = Number(item.qty);
          const qty =
            Number.isFinite(parsedQty) && parsedQty > 0
              ? parsedQty
              : 1;

          // Precio: SE FUERZA A 0 O SE IGNORA, ya que los remitos no lo traen.
          const unitPriceNumber = 0;
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

          // Si no existe, lo creamos SIEMPRE
          if (!product) {
            product = await tx.product.create({
              data: {
                branchId,
                code,
                name,
                price: unitPriceDecimal, // Precio 0
                stock: 0,
                isActive: true,
              },
            });

            this.logger.log(
              `[validateAndFinalizeRemito] Producto creado -> id=${product.id}, code=${code}, price=${unitPriceNumber}`,
            );
          } else {
                // Si existe, NO ACTUALIZAMOS EL PRECIO porque el remito no es fuente de precio.
                this.logger.log(`[validateAndFinalizeRemito] Producto existente, NO actualizando precio.`);
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

      // 4. Actualizar stock y movimientos
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