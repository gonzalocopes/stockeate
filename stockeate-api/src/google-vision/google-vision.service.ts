import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// Import Google Cloud Vision V1 types
// IMPORTANTE: Usar client library en lugar de REST API
const vision = require('@google-cloud/vision');

@Injectable()
export class GoogleVisionService {
  private readonly logger = new Logger(GoogleVisionService.name);
  private client: any;

  constructor() {
    try {
      // Inicializar el cliente de Google Vision
      // Busca automáticamente GOOGLE_APPLICATION_CREDENTIALS env var
      this.client = new vision.ImageAnnotatorClient();
      this.logger.log('[GoogleVision] Cliente inicializado correctamente');
    } catch (error) {
      this.logger.error(
        '[GoogleVision] Error inicializando cliente:',
        (error as Error).message,
      );
    }
  }

  /**
   * Analizar imagen/PDF con Google Vision API
   * Retorna texto extraído y datos estructurados del remito
   */
  async analyzeRemitoImage(filePath: string): Promise<{
    rawText: string;
    items: Array<{
      code: string;
      name: string;
      qty: number;
      unitPrice?: number;
    }>;
    provider: string;
    date: string;
    customerCuit: string;
    customerAddress: string;
    customerTaxCondition: string;
  }> {
    this.logger.log(`[analyzeRemito] Procesando: ${filePath}`);

    if (!this.client) {
      throw new Error('Google Vision client no está inicializado');
    }

    try {
      // Leer el archivo
      const fileBuffer = fs.readFileSync(filePath);

      // Crear request para Vision API
      const request = {
        image: {
          content: fileBuffer,
        },
        features: [
          {
            type: 'TEXT_DETECTION', // Detectar TODO el texto
          },
          {
            type: 'DOCUMENT_TEXT_DETECTION', // Para documentos (mejor para remitos)
          },
        ],
      };

      this.logger.log(`[analyzeRemito] Enviando a Google Vision API...`);

      // Realizar request a Google Vision
      const [result] = await this.client.annotateImage(request);

      const fullTextAnnotation = result.fullTextAnnotation || {};
      const rawText = fullTextAnnotation.text || '';

      this.logger.log(
        `[analyzeRemito] Texto extraído (${rawText.length} chars):`,
        rawText.substring(0, 500),
      );

      // Parsear el texto para extraer estructura
      const parsedData = this.parseRemitoText(rawText);

      return {
        rawText,
        ...parsedData,
      };
    } catch (error) {
      this.logger.error(
        '[analyzeRemito] Error en Google Vision:',
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Parser inteligente del texto extraído por Google Vision
   * Detecta items, proveedor, fecha, CUIT, dirección
   */
  private parseRemitoText(texto: string): {
    items: Array<{
      code: string;
      name: string;
      qty: number;
      unitPrice?: number;
    }>;
    provider: string;
    date: string;
    customerCuit: string;
    customerAddress: string;
    customerTaxCondition: string;
  } {
    this.logger.log('[parseRemitoText] Analizando estructura del remito...');

    type ExtractedItem = {
      code: string;
      name: string;
      qty: number;
      unitPrice?: number;
    };

    const items: ExtractedItem[] = [];

    // ===== EXTRACCIÓN DE CAMPOS PRINCIPALES =====

    // Proveedor / Razón Social
    const patronesProveedor: RegExp[] = [
      /Raz[oó]n\s+Social\s*[:—]\s*([^\n]+)/im,
      /Señor\(es\)\s*[:—]\s*([^\n]+)/im,
      /Proveedor\s*[:—]\s*([^\n]+)/im,
      /De\s*[:—]\s*([A-Z][^\n]{5,}?)(?:\n|$)/im,
    ];

    // Fecha de emisión
    const patronesFecha: RegExp[] = [
      /Fecha\s+(?:de\s+)?(?:Emisi[oó]n|Comprobante)?\s*[:—]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/im,
      /(\d{2}[\/-]\d{2}[\/-]\d{4})/im,
      /(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/im,
    ];

    // CUIT
    const patronesCuit: RegExp[] = [
      /C\.?U\.?I\.?T\.?\s*(?:N?[°º])?\s*[:—]?\s*(\d{2}-\d{8}-\d{1})/im,
      /CUIT[:—]?\s*(\d{2}-\d{8}-\d{1})/im,
      /(\d{2}-\d{8}-\d{1})/im,
    ];

    // Dirección
    const patronesDireccion: RegExp[] = [
      /Direcci[oó]n\s*[:—]\s*([^\n]+)/im,
      /Domicilio\s*[:—]\s*([^\n]+)/im,
      /Sito\s+en\s*[:—]\s*([^\n]+)/im,
    ];

    // Condición tributaria
    const patronesTaxCondition: RegExp[] = [
      /Condici[oó]n\s+(?:de\s+)?(?:IVA|tributaria)\s*[:—]?\s*([^\n]+)/im,
      /(?:IVA|Tributaria)\s*[:—]\s*([^\n]+)/im,
    ];

    const provider =
      this.findFirstMatch(texto, patronesProveedor) ||
      'Proveedor (no detectado)';
    const date =
      this.findFirstMatch(texto, patronesFecha) ||
      new Date().toISOString().slice(0, 10);
    const customerCuit = this.findFirstMatch(texto, patronesCuit) || '';
    const customerAddress = this.findFirstMatch(texto, patronesDireccion) || '';
    const customerTaxCondition =
      this.findFirstMatch(texto, patronesTaxCondition) || '';

    // ===== EXTRACCIÓN DE ITEMS / LÍNEAS DE PRODUCTO =====

    // Patrones para detectar filas de items en tablas/listas
    // Formato común: CÓDIGO | DESCRIPCIÓN | CANTIDAD | PRECIO
    const itemPatterns: RegExp[] = [
      // Patrón 1: código numérico + descripción + cantidad + precio
      /(\d{4,})\s+([A-Za-z0-9\s\-\.\/,]{10,80}?)\s+(\d+(?:[.,]\d+)?)\s+(?:\$\s*)?(\d+(?:[.,]\d+)?)?/gm,

      // Patrón 2: código alfanumérico + descripción + cantidad
      /([A-Z0-9\-]{3,20})\s+([A-Za-z0-9\s\-\.]{10,80}?)\s+(\d+(?:[.,]\d+)?)/gm,

      // Patrón 3: líneas con cantidad prominente seguida de descripción
      /Cantidad:\s*(\d+(?:[.,]\d+)?)\s+(?:Descripci[oó]n)?\s*[:—]?\s*([^\n]+)/gim,
    ];

    for (const pattern of itemPatterns) {
      let match;
      while ((match = pattern.exec(texto)) !== null) {
        if (match[1] && match[2] && match[3]) {
          // Parsear cantidad
          const qtyStr = match[3].replace(',', '.');
          const qty = Math.max(1, Math.floor(Number(qtyStr)));

          // Parsear precio si existe
          let unitPrice: number | undefined = undefined;
          if (match[4]) {
            const priceStr = match[4].replace(',', '.');
            const price = Number(priceStr);
            unitPrice = price > 0 ? price : undefined;
          }

          const code = (match[1] || '').trim().substring(0, 20);
          const name = (match[2] || '').trim().substring(0, 100);

          // Evitar duplicados y items inválidos
          if (code.length > 0 && name.length > 3) {
            const isDuplicate = items.some(
              (i) => i.code === code && i.name === name,
            );

            if (!isDuplicate) {
              items.push({
                code,
                name,
                qty,
                ...(unitPrice !== undefined && { unitPrice }),
              });

              this.logger.log(
                `[parseRemitoText] Item detectado: ${code} | ${name} | Qty: ${qty}`,
              );
            }
          }
        }
      }

      // Si encontramos items, no seguimos con otros patrones
      if (items.length > 0) break;
    }

    // Si no se detectan items, agregar placeholder editable
    if (items.length === 0) {
      this.logger.log(
        '[parseRemitoText] No se detectaron items, agregando placeholder',
      );
      items.push({
        code: '???',
        name: 'Ítem no detectado (Editar)',
        qty: 1,
      });
    }

    this.logger.log(
      `[parseRemitoText] Resumen: ${items.length} items, Proveedor: ${provider}, Fecha: ${date}`,
    );

    return {
      items,
      provider,
      date,
      customerCuit,
      customerAddress,
      customerTaxCondition,
    };
  }

  /**
   * Buscar el primer match en un arreglo de patrones regex
   */
  private findFirstMatch(texto: string, patrones: RegExp[]): string | null {
    for (const patron of patrones) {
      const match = texto.match(patron);
      if (match && match[1]) {
        const limpio = match[1].trim().split('\n')[0].trim().substring(0, 200);
        if (limpio && limpio.length > 0) {
          return limpio;
        }
      }
    }
    return null;
  }

  /**
   * Validar si Google Vision está disponible
   */
  isAvailable(): boolean {
    return !!this.client;
  }
}
