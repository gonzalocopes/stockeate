# Google Vision Service

Servicio de integración con **Google Cloud Vision API** para digitalización de remitos con OCR.

## Descripción

Este servicio proporciona análisis de imágenes de remitos usando Google Cloud Vision API, extrayendo:

- **Texto completo** del documento
- **Items/productos**: código, descripción, cantidad, precio
- **Datos del proveedor**: razón social, dirección, CUIT
- **Información del comprobante**: fecha, condición tributaria

## Archivos

- `google-vision.service.ts` - Implementación del servicio
- `google-vision.module.ts` - Módulo NestJS

## Uso

### Inyección

```typescript
import { GoogleVisionService } from '../google-vision/google-vision.service';

@Injectable()
export class MiServicio {
  constructor(private googleVisionService: GoogleVisionService) {}
}
```

### Analizar imagen

```typescript
// Ruta local a imagen o PDF
const filePath = './uploads/remito.jpg';

// Analizar
const resultado = await this.googleVisionService.analyzeRemitoImage(filePath);

// Resultado contiene:
// {
//   rawText: "Texto completo extraído...",
//   items: [
//     { code: "ARZ-001", name: "Arroz", qty: 50, unitPrice: 15.50 }
//   ],
//   provider: "ABC Distribuidora",
//   date: "15/11/2024",
//   customerCuit: "30-71234567-8",
//   customerAddress: "Av. Principal 123",
//   customerTaxCondition: "IVA Responsable Inscripto"
// }
```

### Verificar disponibilidad

```typescript
if (this.googleVisionService.isAvailable()) {
  // API está lista
  const resultado = await this.googleVisionService.analyzeRemitoImage(path);
} else {
  // GOOGLE_APPLICATION_CREDENTIALS no configurada
}
```

## Configuración

### Variable de entorno

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/ruta/a/credentials.json"
```

### Credenciales

Descargar desde [Google Cloud Console](https://console.cloud.google.com):

1. **IAM & Admin → Service Accounts**
2. **Create Service Account**
3. **Add Key → Create new key → JSON**
4. Guardar archivo

### Permisos requeridos

Rol mínimo: `roles/ml.viewer`

```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member=serviceAccount:SERVICE_ACCOUNT_EMAIL \
  --role=roles/ml.viewer
```

## API de Google Vision utilizada

- **TEXT_DETECTION**: Detecta todo el texto en la imagen
- **DOCUMENT_TEXT_DETECTION**: Optimizado para documentos (mejor para remitos)

Retorna: `fullTextAnnotation` con texto completo y estructura de páginas/párrafos.

## Parsing

El servicio incluye lógica de parsing para extraer:

### Campos principales

- **Proveedor**: Busca patrones como "Razón Social", "Señor", "De"
- **Fecha**: Detecta formatos DD/MM/YYYY o DD-MM-YYYY
- **CUIT**: Formato XX-XXXXXXXX-X
- **Dirección**: Busca "Dirección", "Domicilio", "Sito en"
- **Condición tributaria**: "IVA", "Responsable Inscripto", etc.

### Items/Líneas

Usa múltiples patrones regex:

1. **Tabla estructurada**: `CÓDIGO | DESCRIPCIÓN | CANTIDAD | PRECIO`
2. **Códigos alfanuméricos**: Seguidos de descripción y cantidad
3. **Formato alternativo**: Cuando cantidad está en línea separada

## Logs

```
[GoogleVision] Cliente inicializado correctamente
[analyzeRemito] Procesando: ./uploads/remito.jpg
[analyzeRemito] Enviando a Google Vision API...
[analyzeRemito] Texto extraído (1234 chars)
[parseRemitoText] Analizando estructura del remito...
[parseRemitoText] Item detectado: ARZ-001 | Arroz Blanco | Qty: 50
```

## Limitaciones

- **Cuota**: 300 solicitudes/mes (gratis)
- **Tamaño**: Máximo ~50MB
- **Formatos**: PNG, JPEG, GIF, PDF
- **Privacidad**: Imágenes se envían a Google

## Errores comunes

### "Google Vision client no está inicializado"

```
GOOGLE_APPLICATION_CREDENTIALS no configurada
```

**Solución**:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="./credentials.json"
```

### "Permission denied"

```
Cuenta de servicio sin permisos para Cloud Vision API
```

**Solución**:

```bash
gcloud services enable vision.googleapis.com
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member=serviceAccount:SA_EMAIL \
  --role=roles/ml.viewer
```

### Extracción incompleta

Para remitos complejos, los items pueden no detectarse correctamente.

**Solución**:

1. Verificar calidad de imagen (mínimo 300 DPI)
2. Mejorar patrones regex en `parseRemitoText()`
3. Permitir edición manual en ValidationScreen

## Mejoras futuras

- [ ] Análisis por confianza
- [ ] Detección automática de tabla
- [ ] Cacheo de resultados
- [ ] Machine Learning para items
- [ ] Soporte multi-idioma explícito
- [ ] Análisis de imágenes de baja calidad

## Referencias

- [Google Cloud Vision API](https://cloud.google.com/vision/docs)
- [Client Library](https://www.npmjs.com/package/@google-cloud/vision)
- [Pricing](https://cloud.google.com/vision/pricing)
- [Quotas](https://cloud.google.com/docs/quotas)
