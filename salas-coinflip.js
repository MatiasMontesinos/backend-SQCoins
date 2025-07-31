const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'sqcoins123',
  database: process.env.DB_NAME || 'sqcoins',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Crear sala
async function crearSala(idJugador1, cantApostada) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [res] = await connection.query(
      'SELECT monedasTotales FROM usuarios WHERE id = ? FOR UPDATE',
      [idJugador1]
    );
    if (res.length === 0) throw new Error('Usuario no encontrado');
    if (res[0].monedasTotales < cantApostada) throw new Error('Saldo insuficiente');

    await connection.query(
      'UPDATE usuarios SET monedasTotales = monedasTotales - ? WHERE id = ?',
      [cantApostada, idJugador1]
    );

    const [result] = await connection.query(
      'INSERT INTO juego1 (id_jugador1, cant_apostada) VALUES (?, ?)',
      [idJugador1, cantApostada]
    );

    await connection.query(`
      UPDATE usuarios 
      SET 
        cant_apostada_juego1 = cant_apostada_juego1 + ?,
        cant_creada_juego1 = cant_creada_juego1 + 1
      WHERE id = ?
    `, [cantApostada, idJugador1]);

    await connection.commit();

    const [insertedRows] = await connection.query(
      'SELECT * FROM juego1 WHERE id_sala_juego1 = ?', 
      [result.insertId]
    );
    return insertedRows[0];
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// Listar salas activas
async function listarSalasActivas() {
  const [rows] = await pool.query(`
    SELECT j.id_sala_juego1, j.cant_apostada, j.id_jugador1, j.id_jugador2, u.username as creador
    FROM juego1 j
    JOIN usuarios u ON j.id_jugador1 = u.id
    WHERE j.id_jugador2 IS NULL AND (j.resuelto IS NULL OR j.resuelto = FALSE)
  `);
  return rows;
}

// Unirse a sala
async function unirseASala(idSala, idJugador2) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [salaRes] = await connection.query(
      'SELECT * FROM juego1 WHERE id_sala_juego1 = ? FOR UPDATE',
      [idSala]
    );
    if (salaRes.length === 0) throw new Error('Sala inválida');
    const sala = salaRes[0];
    if (sala.id_jugador2) throw new Error('Sala llena');

    const jugador1 = sala.id_jugador1;
    const cant = sala.cant_apostada;

    const [saldoRes] = await connection.query(
      'SELECT monedasTotales FROM usuarios WHERE id = ? FOR UPDATE',
      [idJugador2]
    );
    if (saldoRes.length === 0) throw new Error('Jugador no encontrado');
    if (saldoRes[0].monedasTotales < cant) throw new Error('Saldo insuficiente');

    await connection.query(
      'UPDATE usuarios SET monedasTotales = monedasTotales - ? WHERE id = ?',
      [cant, idJugador2]
    );

    const ganador = Math.random() < 0.5 ? jugador1 : idJugador2;

    await connection.query(`
      UPDATE juego1 
      SET id_jugador2 = ?, id_ganador = ?, resuelto = TRUE 
      WHERE id_sala_juego1 = ?
    `, [idJugador2, ganador, idSala]);

    await connection.query(`
      UPDATE usuarios
      SET monedasTotales = monedasTotales + ?
      WHERE id = ?
    `, [cant * 2, ganador]);

    await connection.query(`
      UPDATE usuarios
      SET 
        cant_apostada_juego1 = cant_apostada_juego1 + ?,
        cant_ganada_juego1 = cant_ganada_juego1 + CASE WHEN id = ? THEN ? ELSE 0 END,
        cant_perdida_juego1 = cant_perdida_juego1 + CASE WHEN id = ? THEN ? ELSE 0 END,
        cant_ganada_total = cant_ganada_total + CASE WHEN id = ? THEN ? ELSE 0 END
      WHERE id IN (?, ?)
    `, [
      cant,
      ganador, cant,
      jugador1 === ganador ? idJugador2 : jugador1, cant,
      ganador, cant,
      jugador1, idJugador2
    ]);

    const [resNombres] = await connection.query(`
      SELECT u1.username AS creador, u2.username AS oponente
      FROM juego1 j
      JOIN usuarios u1 ON j.id_jugador1 = u1.id
      LEFT JOIN usuarios u2 ON j.id_jugador2 = u2.id
      WHERE j.id_sala_juego1 = ?
    `, [idSala]);

    await connection.commit();

    return {
      status: 'ok',
      ganancia: cant * 2,
      id_jugador1: jugador1,
      id_jugador2: idJugador2,
      id_ganador: ganador,
      id_sala_juego1: idSala,
      creador: resNombres[0]?.creador || null,
      oponente: resNombres[0]?.oponente || null
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// Función manejadora para POST /coinflip/unirse
async function manejarUnirseASala(data) {
  const { id_sala_juego1, id_usuario } = data;
  if (!id_sala_juego1 || !id_usuario) {
    return { status: 'error', error: 'Datos incompletos' };
  }

  try {
    const result = await unirseASala(id_sala_juego1, id_usuario);
    return result;
  } catch (err) {
    console.error('Error al unirse a la sala:', err.message);
    return { status: 'error', error: err.message };
  }
}

// Simulación para resolver coinflip (si necesitas lógica aparte)
async function manejarResolverCoinflip(data) {
  return { status: 'pendiente', data };
}

// Cancelar sala
async function cancelarSala(idSala, idUsuario) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [salaRes] = await connection.query(
      'SELECT * FROM juego1 WHERE id_sala_juego1 = ? AND id_jugador1 = ? AND id_jugador2 IS NULL',
      [idSala, idUsuario]
    );
    if (salaRes.length === 0) {
      await connection.rollback();
      return false;
    }

    await connection.query('DELETE FROM juego1 WHERE id_sala_juego1 = ?', [idSala]);
    await connection.query(
      'UPDATE usuarios SET monedasTotales = monedasTotales + ? WHERE id = ?',
      [salaRes[0].cant_apostada, idUsuario]
    );

    await connection.commit();
    return true;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// Obtener sala por ID
async function obtenerSalaPorID(idSala) {
  const [rows] = await pool.query(`
    SELECT j.id_sala_juego1, j.cant_apostada, j.id_jugador1, j.id_jugador2,
           u1.username AS creador, u2.username AS oponente,
           j.id_ganador, j.resuelto
    FROM juego1 j
    JOIN usuarios u1 ON j.id_jugador1 = u1.id
    LEFT JOIN usuarios u2 ON j.id_jugador2 = u2.id
    WHERE j.id_sala_juego1 = ?
  `, [idSala]);
  return rows[0];
}

// Crear sala desde API
async function coinflipHandler(req, res) {
  const { id_usuario, monto } = req.body;
  if (!id_usuario || !monto) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  try {
    const sala = await crearSala(id_usuario, monto);
    res.json({ status: 'sala_creada', sala });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', error: err.message });
  }
}

// Actualizar apuesta de sala existente
async function actualizarSala(idSala, idJugador1, nuevoMonto) {
  if (nuevoMonto < 1) throw new Error('El monto mínimo es 1');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Bloquear sala
    const [rows] = await conn.query(
      'SELECT cant_apostada, id_jugador1, id_jugador2 FROM juego1 WHERE id_sala_juego1 = ? FOR UPDATE',
      [idSala]
    );
    if (!rows.length) throw new Error('Sala no encontrada');
    const sala = rows[0];
    if (sala.id_jugador1 !== idJugador1) throw new Error('No eres el creador de la sala');
    if (sala.id_jugador2) throw new Error('La sala ya tiene oponente');

    // Bloquear usuario
    const [usr] = await conn.query(
      'SELECT monedasTotales FROM usuarios WHERE id = ? FOR UPDATE',
      [idJugador1]
    );
    if (!usr.length) throw new Error('Usuario no encontrado');
    const saldo = usr[0].monedasTotales;

    const delta = nuevoMonto - sala.cant_apostada;
    // Si aumenta la apuesta, verifica saldo suficiente
    if (delta > 0 && saldo < delta) throw new Error('Saldo insuficiente para aumentar la apuesta');

    // Ajustar saldo (puede restar o devolver)
    await conn.query(
      'UPDATE usuarios SET monedasTotales = monedasTotales - ? WHERE id = ?',
      [delta, idJugador1]
    );

    // Actualizar el monto de la sala
    await conn.query(
      'UPDATE juego1 SET cant_apostada = ? WHERE id_sala_juego1 = ?',
      [nuevoMonto, idSala]
    );

    await conn.commit();

    // Devolver la sala actualizada
    const [resSala] = await conn.query(
      `SELECT j.*, u1.username AS creador, u2.username AS oponente
       FROM juego1 j
       JOIN usuarios u1 ON j.id_jugador1 = u1.id
       LEFT JOIN usuarios u2 ON j.id_jugador2 = u2.id
       WHERE j.id_sala_juego1 = ?`,
      [idSala]
    );
    return resSala[0];
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  crearSala,
  listarSalasActivas,
  unirseASala,
  manejarUnirseASala,
  manejarResolverCoinflip,
  cancelarSala,
  obtenerSalaPorID,
  coinflipHandler,
  actualizarSala
};
