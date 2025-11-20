# stockeate-api/scripts/setup-google-vision.ps1
# Script para instalar y configurar Google Vision API en Windows

Write-Host "🚀 Configurando Google Vision API para Stockeate..." -ForegroundColor Cyan
Write-Host ""

# 1. Verificar Node.js
$NODE_VERSION = node -v
Write-Host "✅ Node.js: $NODE_VERSION" -ForegroundColor Green

# 2. Instalar dependencias si no existen
$GV_INSTALLED = npm list "@google-cloud/vision" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "📦 Instalando @google-cloud/vision..." -ForegroundColor Yellow
    npm install @google-cloud/vision
} else {
    Write-Host "✅ @google-cloud/vision ya está instalado" -ForegroundColor Green
}

# 3. Verificar archivo de credenciales
$GOOGLE_CREDS = $env:GOOGLE_APPLICATION_CREDENTIALS
if (-not $GOOGLE_CREDS) {
    Write-Host ""
    Write-Host "⚠️  GOOGLE_APPLICATION_CREDENTIALS no está configurada" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pasos para configurar:" -ForegroundColor Cyan
    Write-Host "1. Ve a https://console.cloud.google.com" -ForegroundColor White
    Write-Host "2. Crea una cuenta de servicio con permisos para Cloud Vision API" -ForegroundColor White
    Write-Host "3. Descarga el archivo credentials.json" -ForegroundColor White
    Write-Host "4. Configura la variable de entorno:" -ForegroundColor White
    Write-Host ""
    Write-Host "`$env:GOOGLE_APPLICATION_CREDENTIALS=`"$(Get-Location)\credentials.json`"" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "5. Pon el archivo en la raíz del proyecto stockeate-api/" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "✅ GOOGLE_APPLICATION_CREDENTIALS=$GOOGLE_CREDS" -ForegroundColor Green
    
    if (Test-Path $GOOGLE_CREDS) {
        Write-Host "✅ Archivo de credenciales encontrado" -ForegroundColor Green
    } else {
        Write-Host "❌ Archivo de credenciales NO encontrado en: $GOOGLE_CREDS" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "✅ Configuración lista!" -ForegroundColor Green
Write-Host ""
Write-Host "Para iniciar:" -ForegroundColor Cyan
Write-Host "  npm run start:dev" -ForegroundColor White
Write-Host ""
Write-Host "Ver guía completa en: GOOGLE_VISION_SETUP.md" -ForegroundColor Gray
