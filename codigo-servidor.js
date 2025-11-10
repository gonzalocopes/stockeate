// AGREGAR ESTAS LÍNEAS A TU ARCHIVO PRINCIPAL DEL SERVIDOR (app.js o server.js)

const path = require('path');

// Servir archivos estáticos (agregar si no lo tienes)
app.use(express.static('public'));

// Nueva ruta para visualizar remitos
app.get('/remito/:data', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'remito-viewer.html'));
});

// Eso es todo - solo estas 4 líneas