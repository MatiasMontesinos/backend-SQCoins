// backend/coinflip.js
const path = require('path');
const mysql = require('mysql2/promise');

// Conexión al pool de MySQL (idéntica a la tuya)
const pool = mysql.createPool({
  host: 'localhost',
  user: 'tu_usuario',
  password: 'tu_password',
  database: 'tu_base_de_datos',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Importar lógica de salas
const {
  coinflipHandler,
  listarSalasActivas,
  cancelarSala,
  manejarUnirseASala,
  manejarResolverCoinflip,
  obtenerSalaPorID,
  actualizarSala   // <-- asegúrate que esté exportada en salas-coinflip.js
} = require('./salas-coinflip');

module.exports = function(app, frontendPath) {

  // Ruta de prueba de salud
  app.get('/health', (req, res) => {
    res.json({ status: "OK!" });
  });

  // Obtener datos de una sala
  app.get('/coinflip/sala/:idSala', async (req, res) => {
    const idSala = req.params.idSala;
    try {
      const sala = await obtenerSalaPorID(idSala);
      if (sala) return res.json(sala);
      const [rows] = await pool.query(`
        SELECT j.*, u1.nombre AS creador, u2.nombre AS oponente
        FROM juego1 j
        JOIN usuarios u1 ON j.id_jugador1 = u1.id
        LEFT JOIN usuarios u2 ON j.id_jugador2 = u2.id
        WHERE j.id_sala_juego1 = ?
      `, [idSala]);
      if (rows.length === 0) return res.status(404).json({ error: 'Sala no encontrada' });
      res.json(rows[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // Listar salas activas
  app.get('/coinflip/salas', async (req, res) => {
    try {
      const salas = await listarSalasActivas();
      res.json(salas);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Cargar la página del juego
  app.get('/coinflip/:idSala', (req, res) => {
    res.sendFile(path.join(frontendPath, 'Paginas/coinflip-juego.html'));
  });

  // Cancelar sala
  app.post('/coinflip/cancelar', async (req, res) => {
    const { idSala, idUsuario } = req.body;
    try {
      const ok = await cancelarSala(idSala, idUsuario);
      if (ok) return res.json({ status: 'cancelado' });
      res.status(400).json({ error: 'No se pudo cancelar la sala' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Crear sala
  app.post('/coinflip', coinflipHandler);

  // Unirse a sala
  app.post('/coinflip/unirse', async (req, res) => {
    const data = await manejarUnirseASala(req.body);
    res.json(data);
  });

  // Resolver coinflip
  app.post('/coinflip/resolver', async (req, res) => {
    const data = await manejarResolverCoinflip(req.body);
    res.json(data);
  });

  // ————————————————
  // NUEVA RUTA: actualizar apuesta
  // ————————————————
  app.post('/coinflip/actualizar', async (req, res) => {
    const { idSala, idUsuario, nuevoMonto } = req.body;
    if (!idSala || !idUsuario || typeof nuevoMonto !== 'number') {
      return res.status(400).json({ status: 'error', error: 'Datos incompletos' });
    }
    try {
      const sala = await actualizarSala(idSala, idUsuario, nuevoMonto);
      res.json({ status: 'ok', sala });
    } catch (err) {
      console.error('Error al actualizar sala:', err.message);
      res.status(400).json({ status: 'error', error: err.message });
    }
  });

};
