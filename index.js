// backend/index.js

const express = require('express');
const path = require('path');
const session = require('express-session');
const { initDb } = require('./db');

const cors = require('cors');

// Configura CORS para permitir el acceso desde el frontend
const corsOptions = {
  origin: 'https://frontend-sqcoins-production.up.railway.app', // Reemplaza con la URL pública de tu frontend
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
const app = express();
app.use(cors(corsOptions)); // Usar CORS en todas las rutas


// Routers
const perfilRoutes  = require('./perfil');
const sorteosRoutes = require('./sorteos');
const coinflipSetup = require('./coinflip');
const principalRoutes = require('./principal');
const buscaminasRoutes = require('./buscaminas');



const frontendPath = path.join(__dirname, '../frontend');

// Middleware
app.use(express.static(frontendPath));
app.use(express.json());
app.use(session({
  secret: 'pagina_web_sqcoins_trabajo_practico_facultad',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000, httpOnly: true }
}));

// Rutas API
app.use('/api', perfilRoutes);            // /api/registro, /api/login, /api/sesion-activa, etc.
app.use('/api/sorteos', sorteosRoutes);   // /api/sorteos/crear, /api/sorteos/activos, /api/sorteos/unirse
app.use('/api', principalRoutes);
app.use('/api', buscaminasRoutes);


// Coinflip
coinflipSetup(app, frontendPath);         // monta /coinflip/*

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Inicializar DB y arrancar servidor
initDb()
  .then(() => {
    console.log('✅ Base de datos inicializada correctamente');
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Error al inicializar la base de datos:', err);
    process.exit(1);
  });
