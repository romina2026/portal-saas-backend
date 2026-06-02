// src/db/client.js
// Conexión a PostgreSQL (Supabase)

import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // requerido por Supabase
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Verificar conexión al iniciar
db.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error conectando a la base de datos:', err.message);
  } else {
    console.log('✅ Base de datos conectada');
    release();
  }
});
