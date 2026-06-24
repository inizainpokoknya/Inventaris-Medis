// src/config/db.js
// Constraint SCoT: "Dilarang keras melakukan hardcoding secret keys"
// Semua kredensial diambil dari process.env, di-load via dotenv di server.js

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  // Constraint SCoT: jangan crash diam-diam, tapi juga jangan bocorkan
  // detail koneksi DB ke konsumen API manapun
  console.error('[DB POOL ERROR]', err.message);
});

module.exports = pool;
