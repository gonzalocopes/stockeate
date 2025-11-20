#!/bin/bash
# stockeate-api/scripts/setup-google-vision.sh
# Script para instalar y configurar Google Vision API localmente

echo "🚀 Configurando Google Vision API para Stockeate..."
echo ""

# 1. Verificar Node.js
NODE_VERSION=$(node -v)
echo "✅ Node.js: $NODE_VERSION"

# 2. Instalar dependencias si no existen
if ! npm list @google-cloud/vision > /dev/null 2>&1; then
  echo "📦 Instalando @google-cloud/vision..."
  npm install @google-cloud/vision
else
  echo "✅ @google-cloud/vision ya está instalado"
fi

# 3. Verificar archivo de credenciales
if [ -z "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
  echo ""
  echo "⚠️  GOOGLE_APPLICATION_CREDENTIALS no está configurada"
  echo ""
  echo "Pasos:"
  echo "1. Ve a https://console.cloud.google.com"
  echo "2. Crea una cuenta de servicio con permisos para Cloud Vision API"
  echo "3. Descarga el archivo credentials.json"
  echo "4. Configura la variable de entorno:"
  echo ""
  echo "   En Linux/Mac:"
  echo "   export GOOGLE_APPLICATION_CREDENTIALS=\"\$(pwd)/credentials.json\""
  echo ""
  echo "   En Windows (PowerShell):"
  echo '   $env:GOOGLE_APPLICATION_CREDENTIALS="'"$(pwd)"'/credentials.json"'
  echo ""
  echo "5. Pon el archivo en la raíz del proyecto stockeate-api/"
  echo ""
else
  echo "✅ GOOGLE_APPLICATION_CREDENTIALS=$GOOGLE_APPLICATION_CREDENTIALS"
  
  if [ -f "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
    echo "✅ Archivo de credenciales encontrado"
  else
    echo "❌ Archivo de credenciales NO encontrado en: $GOOGLE_APPLICATION_CREDENTIALS"
    exit 1
  fi
fi

echo ""
echo "✅ Configuración lista!"
echo ""
echo "Para iniciar:"
echo "  npm run start:dev"
echo ""
echo "Ver guía completa en: GOOGLE_VISION_SETUP.md"
