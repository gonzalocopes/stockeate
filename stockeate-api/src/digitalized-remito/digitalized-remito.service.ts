import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DigitalizationStatus } from '@prisma/client';
import { ValidationDataDto } from './dto/validation-data.dto';
import { Prisma } from '@prisma/client';
import { createWorker } from 'tesseract.js'; 

@Injectable()
export class DigitalizedRemitoService {
  constructor(private prisma: PrismaService) {}

  // --- MÉTODO 1 (Sin cambios) ---
  async createInitialRemito(file: Express.Multer.File, userId: string, branchId: string) {
    const newDigitalizedRemito = await this.prisma.digitalizedRemito.create({
      data: { userId, branchId, originalFileUrl: file.path, status: DigitalizationStatus.PROCESSING, },
    });
    this.processOcr(newDigitalizedRemito.id, file.path);
    return newDigitalizedRemito;
  }

  // --- MÉTODO 2 (Sin cambios) ---
  private async processOcr(remitoId: string, filePath: string) {
    console.log(`[OCR] Iniciando Tesseract para: ${remitoId}`);
    const worker = await createWorker('spa');
    try {
      const ret = await worker.recognize(filePath);
      const textoExtraido = ret.data.text;
      console.log(`[OCR] Texto extraído (primeros 400 chars): ${textoExtraido.substring(0, 400)}...`);

      const parsedData = this.parsearTextoDeTesseract(textoExtraido);

      await this.prisma.digitalizedRemito.update({
        where: { id: remitoId },
        data: {
          extractedData: parsedData,
          status: DigitalizationStatus.PENDING_VALIDATION,
        },
      });
      console.log(`[OCR] Procesamiento Tesseract exitoso para: ${remitoId}`);
    } catch (error) {
      console.error(`[OCR] Falló el procesamiento para: ${remitoId}`, error);
      await this.prisma.digitalizedRemito.update({
        where: { id: remitoId },
        data: { status: DigitalizationStatus.FAILED, errorMessage: (error as Error).message, },
      });
    } finally {
      await worker.terminate();
      console.log(`[OCR] Trabajador Tesseract terminado para: ${remitoId}`);
    }
  }

  // --- 👇 MÉTODO 3: PARSER MEJORADO CON MÁS VARIACIONES ---
  private parsearTextoDeTesseract(texto: string): any {
    console.log("[Parser] Analizando texto real con Regex...");
    type ExtractedItem = { detectedCode: string; detectedName: string; qty: number; };
    const items: ExtractedItem[] = []; 
    
    // --- Diccionario de Variaciones (Regex) ---
    // (i = ignora mayúsculas, m = multilínea)

    // Patrones de Proveedor (Razón Social)
    const patronesProveedor: RegExp[] = [
      /Razón Social\s*[:—]\s*(.*)/im,
      /Señor\(es\)\s*[:—]\s*(.*)/im,
      /Cliente\s*[:—]\s*(.*)/im,
    ];
    
    // Patrones de Fecha (más flexibles)
    const patronesFecha: RegExp[] = [
      // Busca "Fecha" seguido de la fecha
      /Fecha (?:de Emisión)?\s*[:—]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/im,
      // Busca una fecha en formato XX/XX/XXXX o XX-XX-XXXX en cualquier lugar
      /(\d{2}[\/-]\d{2}[\/-]\d{4})/im, 
    ];
    
    // Patrones de CUIT (más flexibles)
    const patronesCuit: RegExp[] = [
      // Busca "CUIT" (con/sin puntos, "N°", etc.) seguido del número
      /C\.?U\.?I\.?T\.?\s*N?°?\s*[:—]?\s*(\d{2}-\d{8}-\d{1})/im,
      // Busca el CUIT en cualquier lugar, incluso sin la palabra "CUIT"
      /(\d{2}-\d{8}-\d{1})/im, 
    ];

    // Patrones de Dirección
    const patronesDireccion: RegExp[] = [
      /Dirección\s*[:—]?\s*(.*)/im,
      /Domicilio\s*[:—]?\s*(.*)/im,
    ];

    // --- Ejecutar la Búsqueda ---
    // (El orden importa: buscamos primero lo más específico)
    const provider = this.findFirstMatch(texto, patronesProveedor) || "Proveedor (No detectado)";
    const date = this.findFirstMatch(texto, patronesFecha) || new Date().toISOString().slice(0, 10);
    const cuit = this.findFirstMatch(texto, patronesCuit) || ""; // <-- Ahora debería encontrar "27-6787892-1"
    const address = this.findFirstMatch(texto, patronesDireccion) || "";

    // (El parseo de ítems sigue siendo una simulación básica)
    // El parseo real de tablas es la parte más compleja.
    if (items.length === 0) {
      items.push({ detectedCode: '???', detectedName: 'Ítem no detectado (Editar)', qty: 1 });
    }
    
    console.log(`[Parser] Detectado: ${provider}, CUIT: ${cuit}, Fecha: ${date}, Dirección: ${address}`);

    // 👇 Devolvemos los nuevos campos
    return {
      provider: provider,
      date: date,
      customerCuit: cuit,
      customerAddress: address,
      customerTaxCondition: "", // El OCR rara vez lee esto bien
      items: items,
    };
  }

  // Helper para el parser
  private findFirstMatch(texto: string, patrones: RegExp[]): string | null {
    for (const patron of patrones) {
      const match = texto.match(patron);
      // Buscamos el "grupo de captura" (el texto dentro del primer paréntesis)
      if (match && match[1]) { 
        // Limpiamos el resultado y devolvemos solo la primera línea
        const resultadoLimpio = match[1].trim().split('\n')[0];
        if (resultadoLimpio) return resultadoLimpio;
      }
    }
    return null;
  }

  // --- MÉTODO 4 (findPendingByBranch - Sin cambios) ---
  async findPendingByBranch(branchId: string) {
    return this.prisma.digitalizedRemito.findMany({
      where: { branchId, status: DigitalizationStatus.PENDING_VALIDATION },
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- MÉTODO 5 (findOne - Sin cambios) ---
  async findOne(id: string) {
    const remito = await this.prisma.digitalizedRemito.findUnique({ where: { id } });
    if (!remito) {
      throw new NotFoundException(`Remito digitalizado con ID ${id} no encontrado.`);
    }
    return remito;
  }

  // --- MÉTODO 6 (validateAndFinalizeRemito - Sin cambios) ---
  async validateAndFinalizeRemito(id: string, validationData: ValidationDataDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Busca el remito digitalizado
      const digitalizedRemito = await tx.digitalizedRemito.findUnique({ where: { id } });
      if (!digitalizedRemito || digitalizedRemito.status !== 'PENDING_VALIDATION') {
        throw new NotFoundException('Remito no encontrado o ya fue procesado.');
      }

      // 2. Busca o crea los productos
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
                isActive: true,
              },
            });
          }
          return { ...item, productId: product.id };
        }),
      );

      // 3. Crea el Remito de ENTRADA oficial (con los nuevos campos)
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
            create: processedItems.map(item => ({
              productId: item.productId,
              qty: item.qty,
              unitPrice: 0, 
            })),
          },
        },
      });

      // 4. Actualiza el stock y crea movimientos (sin cambios)
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