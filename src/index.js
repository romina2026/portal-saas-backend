// src/index.js
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import superAdminRoutes from './routes/superadmin.js';
import healthRoutes from './routes/health.js';

const app = express();
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/super', superAdminRoutes);
app.use('/health', healthRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
  }
});

app.get('/generar-hash', async (req, res) => {
  const hash = await bcrypt.hash('27011987', 10);
  const ok = await bcrypt.compare('27011987', hash);
  return res.json({ hash, ok });
});

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/super', superAdminRoutes);
app.use('/health', healthRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));