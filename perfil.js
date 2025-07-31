const express = require('express');
const bcrypt = require('bcrypt');
const { initDb } = require('./db');

const router = express.Router();

// Registro
router.post('/registro', async (req, res) => {
  const connection = await initDb();
  const { nombre, username, fechaNacimiento, password } = req.body;

  if (!nombre || !username || !fechaNacimiento || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    const [rows] = await connection.execute(
      'SELECT * FROM usuarios WHERE username = ?',
      [username]
    );

    if (rows.length > 0) {
      return res.status(409).json({ error: 'El username ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await connection.execute(
      'INSERT INTO usuarios (nombre, username, fechaNacimiento, password, monedasTotales) VALUES (?, ?, ?, ?, 100)',
      [nombre, username, fechaNacimiento, hashedPassword]
    );

    const [newUser] = await connection.execute(
      'SELECT id, nombre, username, fechaNacimiento, monedasTotales FROM usuarios WHERE username = ?',
      [username]
    );

    // Guardar usuario en sesión
    req.session.usuario = newUser[0];

    return res.json({ message: 'Registro exitoso', usuario: newUser[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error en la base de datos' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const connection = await initDb();
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username y contraseña son obligatorios' });
  }

  try {
    const [rows] = await connection.execute(
      'SELECT * FROM usuarios WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const usuario = rows[0];

    const isMatch = await bcrypt.compare(password, usuario.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    // Guardar usuario en sesión
    req.session.usuario = {
      id: usuario.id,
      nombre: usuario.nombre,
      username: usuario.username,
      fechaNacimiento: usuario.fechaNacimiento,
      monedasTotales: usuario.monedasTotales || 0
    };

    return res.json({
      message: 'Ingreso correcto',
      usuario: req.session.usuario
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error en la base de datos' });
  }
});

// Actualizar username
router.post('/actualizar-username', async (req, res) => {
  const connection = await initDb();
  const { nuevoUsername } = req.body;

  if (!nuevoUsername) {
    return res.status(400).json({ error: 'Falta el nuevo username' });
  }

  if (!req.session.usuario) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    // Verificar si el nuevo username ya existe
    const [existing] = await connection.execute(
      'SELECT * FROM usuarios WHERE username = ?',
      [nuevoUsername]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'El username ya está en uso' });
    }

    // Actualizar usando el username actual en sesión
    const currentUsername = req.session.usuario.username;

    await connection.execute(
      'UPDATE usuarios SET username = ? WHERE username = ?',
      [nuevoUsername, currentUsername]
    );

    // Actualizar la sesión con el nuevo username
    req.session.usuario.username = nuevoUsername;

    return res.json({ message: 'Username actualizado correctamente', username: nuevoUsername });
  } catch (error) {
    console.error('Error al actualizar username:', error);
    return res.status(500).json({ error: 'Error al actualizar username' });
  }
});

// Ruta para verificar si hay sesión activa (con salto a BD para traer saldo fresco)
router.get('/sesion-activa', async (req, res) => {
  if (!req.session.usuario) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  try {
    const connection = await initDb();
    const userId = req.session.usuario.id;
    const [rows] = await connection.execute(
      'SELECT id, nombre, username, fechaNacimiento, monedasTotales FROM usuarios WHERE id = ?',
      [userId]
    );
    if (rows.length === 0) {
      // sesión inválida: destruimos y respondemos no autenticado
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }
    // Actualizamos la sesión con datos frescos
    req.session.usuario = rows[0];
    res.json({ usuario: rows[0] });
  } catch (error) {
    console.error('Error en sesion-activa:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Ruta para cerrar sesión
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Error cerrando sesión' });
    }
    res.json({ mensaje: 'Sesión cerrada correctamente' });
  });
});

// Eliminar cuenta del usuario autenticado
router.post('/eliminar-cuenta', async (req, res) => {
  if (!req.session.usuario) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const connection = await initDb();
  const { id } = req.session.usuario;

  try {
    // Eliminar usuario de la base de datos
    await connection.execute('DELETE FROM usuarios WHERE id = ?', [id]);

    // Destruir la sesión después de eliminar
    req.session.destroy(err => {
      if (err) {
        return res.status(500).json({ error: 'Usuario eliminado, pero hubo error cerrando sesión' });
      }
      res.json({ mensaje: 'Usuario eliminado correctamente' });
    });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

module.exports = router;
