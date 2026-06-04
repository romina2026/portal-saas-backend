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

// ENDPOINT TEMPORAL DE DEBUG — borrar después
app.get('/debug-super', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, email, password_hash, length(password_hash) as largo FROM super_admins');
    const hash = rows[0]?.password_hash;
    const ok = hash ? await bcrypt.compare('27011987', hash) : false;
    return res.json({ rows, bcrypt_result: ok, node_version: process.version });
  } catch (err) {
    return res.json({ error: err.message });
  }
});

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/super', superAdminRoutes);
app.use('/health', healthRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
