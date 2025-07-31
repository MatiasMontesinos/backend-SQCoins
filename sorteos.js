const express = require('express');
const router = express.Router();
const { initDb } = require('./db');

router.use(express.json());

// POST /api/sorteos/crear
router.post('/crear', async (req, res) => {
  const { cantidad_sorteo, limite_participantes, id_creador } = req.body;

  try {
    const connection = await initDb();

    // Verificar monedas disponibles
    const [[usuario]] = await connection.execute(
      'SELECT monedasTotales FROM usuarios WHERE id = ?',
      [id_creador]
    );

    if (!usuario || usuario.monedasTotales < cantidad_sorteo) {
      return res.status(400).json({ success: false, message: 'SQCoins insuficientes' });
    }

    // Descontar monedas y actualizar estadísticas de creación
    await connection.execute(
      `UPDATE usuarios 
       SET monedasTotales = monedasTotales - ?, 
           cant_creados_sorteo = cant_creados_sorteo + 1,
           cant_gastada_creados_sorteo = cant_gastada_creados_sorteo + ?
       WHERE id = ?`,
      [cantidad_sorteo, cantidad_sorteo, id_creador]
    );

    // Insertar sorteo
    const [result] = await connection.execute(`
      INSERT INTO sorteos (id_creador, cantidad_sorteo, limite_participantes, completado)
      VALUES (?, ?, ?, false)
    `, [id_creador, cantidad_sorteo, limite_participantes]);

    const insertId = result.insertId;
    const [rows] = await connection.execute(
      'SELECT * FROM sorteos WHERE id_sorteo = ?',
      [insertId]
    );

    res.json({ success: true, sorteo: rows[0] });
  } catch (err) {
    console.error('Error al crear sorteo:', err);
    res.status(500).json({ success: false, message: 'Error al crear sorteo' });
  }
});

// POST /api/sorteos/actualizar
router.post('/actualizar', async (req, res) => {
  const { id_sorteo, nuevaCantidad, id_usuario } = req.body;

  try {
    const connection = await initDb();

    const [[sorteo]] = await connection.execute(
      'SELECT * FROM sorteos WHERE id_sorteo = ? AND id_creador = ? AND completado = false',
      [id_sorteo, id_usuario]
    );

    if (!sorteo) {
      return res.status(403).json({ success: false, message: 'No autorizado o sorteo completado' });
    }

    if (nuevaCantidad < sorteo.cantidad_sorteo) {
      return res.status(400).json({ success: false, message: 'La nueva cantidad debe ser mayor o igual' });
    }

    const diferencia = nuevaCantidad - sorteo.cantidad_sorteo;

    if (diferencia > 0) {
      const [[usuario]] = await connection.execute(
        'SELECT monedasTotales FROM usuarios WHERE id = ?',
        [id_usuario]
      );
      if (usuario.monedasTotales < diferencia) {
        return res.status(400).json({ success: false, message: 'SQCoins insuficientes para actualizar' });
      }

      await connection.execute(
        `UPDATE usuarios 
         SET monedasTotales = monedasTotales - ?, 
             cant_gastada_creados_sorteo = cant_gastada_creados_sorteo + ?
         WHERE id = ?`,
        [diferencia, diferencia, id_usuario]
      );
    }

    await connection.execute(
      'UPDATE sorteos SET cantidad_sorteo = ? WHERE id_sorteo = ?',
      [nuevaCantidad, id_sorteo]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error al actualizar sorteo:', err);
    res.status(500).json({ success: false, message: 'Error al actualizar sorteo' });
  }
});

// GET /api/sorteos/activos
router.get('/activos', async (req, res) => {
  try {
    const connection = await initDb();
    const [rows] = await connection.execute(`
      SELECT s.*, u.nombre AS creador,
        (SELECT COUNT(*) FROM sorteos_participantes sp WHERE sp.id_sorteo = s.id_sorteo) AS participantes
      FROM sorteos s
      JOIN usuarios u ON s.id_creador = u.id
      WHERE s.completado = false
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error al listar sorteos:', err);
    res.status(500).json({ error: 'Error al listar sorteos' });
  }
});

// POST /api/sorteos/unirse
router.post('/unirse', async (req, res) => {
  const { id_usuario, id_sorteo } = req.body;
  try {
    const connection = await initDb();

    const [check] = await connection.execute(
      'SELECT * FROM sorteos_participantes WHERE id_usuario = ? AND id_sorteo = ?',
      [id_usuario, id_sorteo]
    );
    if (check.length > 0) {
      return res.status(400).json({ success: false, message: 'Ya estás inscrito' });
    }

    // Insertar nuevo participante
    await connection.execute(
      'INSERT INTO sorteos_participantes (id_usuario, id_sorteo) VALUES (?, ?)',
      [id_usuario, id_sorteo]
    );

    // Actualizar estadísticas del usuario
    await connection.execute(
      'UPDATE usuarios SET cant_unidos_sorteo = cant_unidos_sorteo + 1 WHERE id = ?',
      [id_usuario]
    );

    const [counts] = await connection.execute(`
      SELECT COUNT(*) AS cantidad, limite_participantes
      FROM sorteos s
      JOIN sorteos_participantes sp ON sp.id_sorteo = s.id_sorteo
      WHERE s.id_sorteo = ?
      GROUP BY limite_participantes
    `, [id_sorteo]);

    if (counts.length > 0 && counts[0].cantidad >= counts[0].limite_participantes) {
      const [parts] = await connection.execute(
        'SELECT id_usuario FROM sorteos_participantes WHERE id_sorteo = ?',
        [id_sorteo]
      );
      const ganador = parts[Math.floor(Math.random() * parts.length)].id_usuario;

      // Marcar sorteo como completado y asignar ganador
      await connection.execute(
        'UPDATE sorteos SET completado = true, id_ganador = ? WHERE id_sorteo = ?',
        [ganador, id_sorteo]
      );

      // Sumar recompensa y estadísticas al ganador
      await connection.execute(`
        UPDATE usuarios u
        JOIN sorteos s ON s.id_sorteo = ?
        SET 
          u.monedasTotales = u.monedasTotales + s.cantidad_sorteo,
          u.cant_ganada_sorteo = u.cant_ganada_sorteo + s.cantidad_sorteo
        WHERE u.id = ?
      `, [id_sorteo, ganador]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error al unirse al sorteo:', err);
    res.status(500).json({ success: false, message: 'Error al unirse al sorteo' });
  }
});

// POST /api/sorteos/eliminar
router.post('/eliminar', async (req, res) => {
  const { id_sorteo, id_usuario } = req.body;
  try {
    const connection = await initDb();

    const [[sorteo]] = await connection.execute(
      'SELECT * FROM sorteos WHERE id_sorteo = ? AND id_creador = ? AND completado = false',
      [id_sorteo, id_usuario]
    );

    if (!sorteo) {
      return res.status(403).json({ success: false, message: 'No autorizado o sorteo ya completado' });
    }

    // Devolver monedas al creador
    await connection.execute(
      'UPDATE usuarios SET monedasTotales = monedasTotales + ? WHERE id = ?',
      [sorteo.cantidad_sorteo, id_usuario]
    );

    // Eliminar sorteo y participantes
    await connection.execute('DELETE FROM sorteos_participantes WHERE id_sorteo = ?', [id_sorteo]);
    await connection.execute('DELETE FROM sorteos WHERE id_sorteo = ?', [id_sorteo]);

    res.json({ success: true });
  } catch (err) {
    console.error('Error al eliminar sorteo:', err);
    res.status(500).json({ success: false, message: 'Error al eliminar sorteo' });
  }
});

module.exports = router;
