// Código para agregar al backend de Render
// Agregar estas líneas a tu archivo principal del servidor (app.js o server.js)

const path = require('path');

// Ruta para servir el visualizador de remitos
app.get('/remito/:data', (req, res) => {
  // Servir el archivo HTML del visualizador
  res.sendFile(path.join(__dirname, 'public', 'remito-viewer.html'));
});

// También necesitas servir archivos estáticos si no lo tienes ya
app.use(express.static('public'));

/* 
INSTRUCCIONES:
1. Crea una carpeta llamada 'public' en tu proyecto de backend
2. Copia el archivo 'remito-viewer.html' a esa carpeta 'public'
3. Agrega las líneas de arriba a tu archivo principal del servidor
4. Redeploya en Render

NO necesitas tocar la base de datos para nada.
*/