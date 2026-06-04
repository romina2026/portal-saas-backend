// src/index.js
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import superAdminRoutes from './routes/superadmin.js';
import healthRoutes from './routes/health.js';

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/super', superAdminRoutes);
app.use('/health', healthRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
 
