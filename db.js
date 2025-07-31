const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfigNoDb = {
  host: process.env.DB_HOST || 'localhost',  // Usar variable de entorno o localhost
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234mati',
  port: 3306,
  multipleStatements: true
};

const dbConfigWithDb = {
  ...dbConfigNoDb,
  database: process.env.DB_NAME || 'sqcoins'
};

let connection;

async function initDb() {
  if (!connection) {
    // 1) Conectarse sin base de datos (para crearla si hace falta)
    const connectionNoDb = await mysql.createConnection(dbConfigNoDb);

    // 2) Crear la base si no existe
    await connectionNoDb.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfigWithDb.database}\``);

    await connectionNoDb.end();

    // 3) Conectarse con la base ya creada
    connection = await mysql.createConnection(dbConfigWithDb);

    // 4) Leer script de creación de tablas
    const schemaPath = path.join(__dirname, 'scripts', 'db.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    // 5) Ejecutar script para tablas
    await connection.query(schemaSQL);

    console.log('Base y tablas inicializadas.');
  }

  return connection;
}

module.exports = { initDb };
