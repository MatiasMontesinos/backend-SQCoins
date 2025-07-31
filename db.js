const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Leer variables de entorno SIN valores por defecto
const dbConfig = {
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQL_DATABASE,  // Cambiado aquí
  port: process.env.MYSQLPORT ? Number(process.env.MYSQLPORT) : 3306, // puerto por defecto 3306 si no definido
  multipleStatements: true
};

// Validar que las variables necesarias existan antes de intentar conectar
for (const [key, value] of Object.entries(dbConfig)) {
  if (!value) {
    console.error(`❌ La variable de entorno ${key} no está definida.`);
    process.exit(1); // Salir con error para evitar conexión errónea
  }
}

let connection;

async function initDb() {
  if (!connection) {
    try {
      console.log('🔧 Intentando conectar a la base de datos con:', dbConfig);
      connection = await mysql.createConnection(dbConfig);

      const schemaPath = path.join(__dirname, 'scripts', 'db.sql');
      const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
      await connection.query(schemaSQL);

      console.log('✅ Base de datos inicializada correctamente.');
    } catch (err) {
      console.error('❌ Error al inicializar la base de datos:', err);
      throw err;
    }
  }

  return connection;
}

module.exports = { initDb };
