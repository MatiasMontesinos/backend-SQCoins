const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: process.env.MYSQLHOST || 'localhost',
  user: process.env.MYSQLUSER || 'root',
  password: process.env.MYSQLPASSWORD || '',
  database: process.env.MYSQLDATABASE || 'sqcoins',
  port: process.env.MYSQLPORT ? parseInt(process.env.MYSQLPORT) : 3306,
  multipleStatements: true
};


let connection;

async function initDb() {
  if (!connection) {
    try {
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
