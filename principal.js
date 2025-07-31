const express = require('express');
const router = express.Router();
const { initDb } = require('./db');

// GET /api/rankings
router.get('/rankings', async (req, res) => {
  try {
    const connection = await initDb();

    const [juego1] = await connection.query(
      `SELECT username, cant_ganada_juego1 AS monedas
       FROM usuarios
       WHERE cant_ganada_juego1 >= 110
       ORDER BY cant_ganada_juego1 DESC
       LIMIT 5`
    );

    const [juego2] = await connection.query(
      `SELECT username, cant_ganada_juego2 AS monedas
       FROM usuarios
       WHERE cant_ganada_juego2 >= 110
       ORDER BY cant_ganada_juego2 DESC
       LIMIT 5`
    );

    const [sorteo] = await connection.query(
      `SELECT username, cant_ganada_sorteo AS monedas
       FROM usuarios
       WHERE cant_ganada_sorteo >= 110
       ORDER BY cant_ganada_sorteo DESC
       LIMIT 5`
    );

    res.json({ juego1, juego2, sorteo });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener rankings' });
  }
});

module.exports = router;
