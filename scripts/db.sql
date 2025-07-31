-- backend/scripts/db.sql

CREATE DATABASE IF NOT EXISTS sqcoins;
USE sqcoins;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  fechaNacimiento DATE NOT NULL,
  password VARCHAR(100) NOT NULL,
  monedasTotales INT NOT NULL DEFAULT 100,
  cant_apostada_juego1 INT NOT NULL DEFAULT 0,
  cant_ganada_juego1  INT NOT NULL DEFAULT 0,
  cant_ganada_total   INT NOT NULL DEFAULT 0,
  cant_perdida_juego1 INT NOT NULL DEFAULT 0,
  cant_creada_juego1  INT NOT NULL DEFAULT 0,
  cant_apostada_juego2 INT NOT NULL DEFAULT 0,
  cant_ganada_juego2  INT NOT NULL DEFAULT 0,
  cant_perdida_juego2 INT NOT NULL DEFAULT 0,
  cant_creada_juego2  INT NOT NULL DEFAULT 0,
  cant_ganada_sorteo  INT NOT NULL DEFAULT 0,
  cant_unidos_sorteo  INT NOT NULL DEFAULT 0,
  cant_creados_sorteo INT NOT NULL DEFAULT 0,
  cant_gastada_creados_sorteo INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sorteos (
  id_sorteo INT AUTO_INCREMENT PRIMARY KEY,
  id_creador INT NOT NULL,
  cantidad_unidos INT NOT NULL DEFAULT 0,
  cantidad_sorteo INT NOT NULL DEFAULT 0,
  limite_participantes INT NOT NULL DEFAULT 0,
  total_sorteado INT NOT NULL DEFAULT 0,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  id_ganador INT,
  completado BOOLEAN NOT NULL DEFAULT false,
  FOREIGN KEY (id_creador) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (id_ganador)   REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sorteos_participantes (
  id_sorteo INT NOT NULL,
  id_usuario INT NOT NULL,
  PRIMARY KEY (id_sorteo, id_usuario),
  FOREIGN KEY (id_sorteo)  REFERENCES sorteos(id_sorteo) ON DELETE CASCADE,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id)       ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS juego1 (
  id_sala_juego1 INT AUTO_INCREMENT PRIMARY KEY,
  id_jugador1 INT NOT NULL,
  id_jugador2 INT,
  id_ganador  INT,
  cant_apostada INT NOT NULL,
  resuelto      BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (id_jugador1) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (id_jugador2) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (id_ganador)   REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS juego2 (
  id_sala_juego2 INT AUTO_INCREMENT PRIMARY KEY,
  id_creador     INT NOT NULL,
  cant_apostada  INT NOT NULL,
  cant_minas     INT NOT NULL,
  cant_retirada  INT NOT NULL,
  cant_seleccionados INT NOT NULL,
  FOREIGN KEY (id_creador) REFERENCES usuarios(id) ON DELETE CASCADE
);
