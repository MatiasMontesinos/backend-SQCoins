const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Detectar el nombre correcto de la base de datos
const databaseName = process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE || 'railway';

// Mostrar las variables de entorno para debug
console.log('🔍 Variables de entorno recibidas:', {
  MYSQLHOST: process.env.MYSQLHOST,
  MYSQLUSER: process.env.MYSQLUSER,
  MYSQLPASSWORD: process.env.MYSQLPASSWORD ? '********' : undefined,
  MYSQL_DATABASE: process.env.MYSQL_DATABASE,
  MYSQLDATABASE: process.env.MYSQLDATABASE,
  MYSQLPORT: process.env.MYSQLPORT
});

// Configuración de conexión
const dbConfig = {
  host: process.env.MYSQLHOST || 'mysql.railway.internal',  // Usamos el valor predeterminado en caso de que no se pase la variable
  user: process.env.MYSQLUSER || 'root',
  password: process.env.MYSQLPASSWORD || 'HiZptebvxrQOzhaSSMvJankEImWEbujP',
  database: databaseName || 'mysql.railway.internal',
  port: process.env.MYSQLPORT || 3306, 
  multipleStatements: true
};

// Validación de variables requeridas
for (const [key, value] of Object.entries(dbConfig)) {
  if (!value) {
    console.error(`❌ La variable de entorno ${key} no está definida o está vacía.`);
    console.error('Valor actual:', value);
    process.exit(1); // Detiene la app si falta algo
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
