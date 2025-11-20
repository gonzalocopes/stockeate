#!/bin/bash
# stockeate-api/scripts/verify-setup.sh
# Verificar que la migración de OCR está completa

echo "🔍 Verificando migración de OCR (Tesseract → Google Vision)..."
echo ""

ERRORS=0

# 1. Verificar que google-vision.service.ts existe
if [ -f "./src/google-vision/google-vision.service.ts" ]; then
  echo "✅ google-vision.service.ts existe"
else
  echo "❌ google-vision.service.ts NO encontrado"
  ((ERRORS++))
fi

# 2. Verificar que google-vision.module.ts existe
if [ -f "./src/google-vision/google-vision.module.ts" ]; then
  echo "✅ google-vision.module.ts existe"
else
  echo "❌ google-vision.module.ts NO encontrado"
  ((ERRORS++))
fi

# 3. Verificar que @google-cloud/vision está en package.json
if grep -q "@google-cloud/vision" package.json; then
  echo "✅ @google-cloud/vision está en package.json"
else
  echo "❌ @google-cloud/vision NO está en package.json"
  ((ERRORS++))
fi

# 4. Verificar que tesseract.js NO está en package.json
if grep -q "tesseract.js" package.json; then
  echo "⚠️  tesseract.js aún está en package.json (debería removerse)"
  ((ERRORS++))
else
  echo "✅ tesseract.js removido de package.json"
fi

# 5. Verificar que GoogleVisionModule está en app.module.ts
if grep -q "GoogleVisionModule" src/app.module.ts; then
  echo "✅ GoogleVisionModule importado en app.module.ts"
else
  echo "❌ GoogleVisionModule NO importado en app.module.ts"
  ((ERRORS++))
fi

# 6. Verificar que DigitalizedRemitoService usa GoogleVisionService
if grep -q "GoogleVisionService" src/digitalized-remito/digitalized-remito.service.ts; then
  echo "✅ GoogleVisionService inyectado en DigitalizedRemitoService"
else
  echo "❌ GoogleVisionService NO inyectado en DigitalizedRemitoService"
  ((ERRORS++))
fi

# 7. Verificar que NO existe referencia a createWorker de Tesseract
if grep -q "createWorker" src/digitalized-remito/digitalized-remito.service.ts; then
  echo "⚠️  Aún hay referencias a createWorker (Tesseract)"
  ((ERRORS++))
else
  echo "✅ No hay referencias a Tesseract createWorker"
fi

# 8. Verificar documentación
if [ -f "GOOGLE_VISION_SETUP.md" ]; then
  echo "✅ GOOGLE_VISION_SETUP.md existe"
else
  echo "❌ GOOGLE_VISION_SETUP.md NO encontrado"
  ((ERRORS++))
fi

# 9. Verificar archivo .env.example
if [ -f ".env.example" ]; then
  if grep -q "GOOGLE_APPLICATION_CREDENTIALS" .env.example; then
    echo "✅ .env.example contiene GOOGLE_APPLICATION_CREDENTIALS"
  else
    echo "⚠️  .env.example no documenta GOOGLE_APPLICATION_CREDENTIALS"
  fi
else
  echo "⚠️  .env.example NO encontrado"
fi

echo ""
if [ $ERRORS -eq 0 ]; then
  echo "✅ Todas las verificaciones pasaron!"
  echo ""
  echo "Próximos pasos:"
  echo "1. npm install"
  echo "2. Configurar GOOGLE_APPLICATION_CREDENTIALS"
  echo "3. npm run start:dev"
  echo "4. Probar upload de remito"
else
  echo "❌ Hay $ERRORS error(s) que necesitan ser corregidos"
  exit 1
fi
