// src/index.js
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { db } from './db/client.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import superAdminRoutes from './routes/superadmin.js';
import healthRoutes from './routes/health.js';

const app = express();
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/debug-login', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT c.username, c.password_hash, length(c.password_hash) as largo
       FROM credenciales c WHERE c.username = '00000110'`
    );
    const hash = rows[0]?.password_hash;
    const ok = hash ? await bcrypt.compare('1234', hash) : false;
    return res.json({ rows, bcrypt_result: ok, node_version: process.version });
  } catch (err) {
    return res.json({ error: err.message });
  }
});

app.get('/generar-hash', async (req, res) => {
  const hash = await bcrypt.hash('1234', 10);
  const ok = await bcrypt.compare('1234', hash);
  return res.json({ hash, ok });
});

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/super', superAdminRoutes);
app.use('/health', healthRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));