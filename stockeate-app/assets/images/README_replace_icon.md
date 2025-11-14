Instrucciones para reemplazar el icono de la app
===============================================

He localizado que la app usa el siguiente archivo como icono principal (en `app.json`):

- `./assets/images/icon.png`

También hay referencias a estos archivos (útiles para Android/iOS/web):

- `android-icon-foreground.png` (usado por `android.adaptiveIcon.foregroundImage`)
- `android-icon-background.png` (fondo del adaptive icon)
- `favicon.png` (web)
- `splash-icon.png` (splash screen plugin)

Qué debes hacer ahora
---------------------

1) Guarda la imagen adjunta que me enviaste como `icon.png` en este directorio:

   stockeate-app/assets/images/icon.png

   - Si quieres, sobreescribe el actual `icon.png` (haz una copia de seguridad primero):

     cp icon.png icon.backup.png

2) Para mantener el adaptive icon de Android consistente, reemplaza también `android-icon-foreground.png` por la misma imagen (normalmente la versión sin fondo). Si usas la misma imagen cuadrada funcionará, pero Android espera una imagen con transparencia para el foreground.

   cp icon.png android-icon-foreground.png

3) Si quieres generar variantes para diferentes plataformas (recomendado):

   - Generar iconos en varios tamaños para iOS/Android/web. Puedes usar la herramienta `convert` de ImageMagick o `sharp` en Node.

     Ejemplo con ImageMagick (instala `magick` en Windows o `convert` en Linux/macOS):

     magick stockeate-app/assets/images/icon.png -resize 1024x1024 stockeate-app/assets/images/icon-1024.png
     magick stockeate-app/assets/images/icon.png -resize 512x512 stockeate-app/assets/images/icon-512.png
     magick stockeate-app/assets/images/icon.png -resize 192x192 stockeate-app/assets/images/icon-192.png

   - Para generar un `favicon.ico` a partir de la imagen:

     magick stockeate-app/assets/images/icon.png -define icon:auto-resize=64,48,32,16 stockeate-app/assets/images/favicon.ico

4) Si prefieres que yo coloque el archivo por ti aquí en el repositorio, pega el contenido base64 de la imagen en un archivo `.b64` y te doy el comando para decodificarlo. Ejemplo de comando para decodificar (Bash):

   base64 --decode icon.png.b64 > stockeate-app/assets/images/icon.png

5) Después de reemplazar los archivos, reconstruye la app con Expo / EAS:

   - Modo local (Expo CLI, si el proyecto lo usa):

     npm install
     npx expo start

   - Con EAS build (si utilizas EAS):

     npx eas build --platform android
     npx eas build --platform ios

Notas y recomendaciones
-----------------------

- Asegúrate de que la imagen sea cuadrada y tenga al menos 1024x1024 px para buena calidad en todas las plataformas.
- Para Android adaptive icons: usa una imagen con fondo transparente para `android-icon-foreground.png` y un color sólido para `android-icon-background.png`.
- Si quieres, puedo también generar los archivos de configuración actualizados en `app.json` para apuntar a una versión con otro nombre (por ejemplo `icon.webp`). Dímelo y lo hago.

Si quieres, puedo intentar automatizar la generación de variantes si me confirmas que quieres que reemplace también `android-icon-foreground.png`, `favicon.png` y `splash-icon.png` con la misma imagen. Actualmente no sobreescribí ningún binario desde aquí porque no puedo decodificar el adjunto automáticamente en este entorno.
