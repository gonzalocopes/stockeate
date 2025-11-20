# INSTRUCCIONES PARA IMPLEMENTAR VISUALIZADOR DE REMITOS

## Paso 1: Agregar código al servidor
1. Abre tu archivo principal del backend (app.js o server.js)
2. Copia y pega estas líneas:

```javascript
const path = require('path');
app.use(express.static('public'));
app.get('/remito/:data', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'remito-viewer.html'));
});
```

## Paso 2: Subir archivo HTML
1. En tu proyecto de backend, crea una carpeta llamada `public`
2. Copia el archivo `remito-viewer.html` dentro de esa carpeta `public`

## Paso 3: Deploy
1. Haz commit de los cambios
2. Push a tu repositorio
3. Render se redesplegará automáticamente

## Estructura final:
```
tu-backend/
├── app.js (con el código nuevo)
├── public/
│   └── remito-viewer.html
└── otros archivos...
```

## Resultado:
- Al escanear QR → aparece URL
- Al hacer clic → página hermosa con datos del remito
- Funciona en cualquier dispositivo

¡Eso es todo! 🚀