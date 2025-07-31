// backend/buscaminas.js

const express = require('express');
const router = express.Router();
const { initDb } = require('./db');

// Middleware para verificar sesión
function verificarSesion(req, res, next) {
  if (!req.session.usuario || !req.session.usuario.id) {
    return res.status(401).json({ error: 'No has iniciado sesión.' });
  }
  next();
}

// Iniciar partida
router.post('/buscaminas/iniciar', verificarSesion, async (req, res) => {
  const { apuesta } = req.body;
  const userId = req.session.usuario?.id;


  if (!apuesta || apuesta <= 0) {
    return res.status(400).json({ error: 'Apuesta inválida.' });
  }

  const db = await initDb();

  try {
    // Obtener monedas actuales del usuario
    const [rows] = await db.query('SELECT monedasTotales FROM usuarios WHERE id = ?', [userId]);
    const usuario = rows[0];

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    if (usuario.monedasTotales < apuesta) {
      return res.status(400).json({ error: 'No tienes suficientes monedas para apostar.' });
    }

    // Actualizar la base de datos: restar monedas, sumar apuesta y aumentar partidas jugadas
    await db.query(`
      UPDATE usuarios
      SET 
        monedasTotales = monedasTotales - ?,
        cant_apostada_juego2 = cant_apostada_juego2 + ?,
        cant_creada_juego2 = cant_creada_juego2 + 1
      WHERE id = ?
    `, [apuesta, apuesta, userId]);

    res.json({ ok: true });

  } catch (err) {
    console.error('Error al iniciar partida de buscaminas:', err);
    res.status(500).json({ error: 'Error en el servidor.' });
  }
});

// Finalizar partida
router.post('/buscaminas/finalizar', verificarSesion, async (req, res) => {
  const { resultado, ganancia, apuesta, reintegro } = req.body;  // resultado = 'ganar' o 'perder'
  const userId = req.session.usuario?.id;

   if (!userId) {
    return res.status(400).json({ error: 'Usuario no identificado.' });
  }


  const db = await initDb();

  try {
    const reintegroVal = reintegro || 0;
    const gananciaVal = ganancia || 0;

    if (resultado === 'ganar') {
      await db.query(`
        UPDATE usuarios
        SET 
          monedasTotales = monedasTotales + ? + ?,  -- reintegro + ganancia
          cant_ganada_juego2 = cant_ganada_juego2 + ?
        WHERE id = ?
      `, [reintegroVal, gananciaVal, gananciaVal, userId]);

    } else if (resultado === 'perder') {
      await db.query(`
        UPDATE usuarios
        SET 
          cant_perdida_juego2 = cant_perdida_juego2 + ?
        WHERE id = ?
      `, [apuesta, userId]);
    }


    res.json({ ok: true });
  } catch (err) {
    console.error('Error al finalizar partida de buscaminas:', err);
    res.status(500).json({ error: 'Error en el servidor.' });
  }
});

module.exports = router;
