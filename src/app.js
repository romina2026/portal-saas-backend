// src/app.js
import express       from 'express';
import cors          from 'cors';
import helmet        from 'helmet';
import rateLimit     from 'express-rate-limit';
import 'dotenv/config';
import beneficiosRoutes from './routes/beneficios.js';
import ubicacionesRoutes from './routes/ubicaciones.js';
import capacitacionesRoutes from './routes/capacitaciones.js';
import authRoutes       from './routes/auth.js';
import recibosRoutes    from './routes/recibos.js';
import cuentaRoutes     from './routes/cuenta-cte.js';
import rrhhRoutes       from './routes/rrhh.js';
import fichajesRoutes   from './routes/fichajes.js';
import adminRoutes from './routes/admin.js';
import avisosRoutes from './routes/avisos.js';
import empleadoRoutes   from './routes/empleado.js';
import garantiasRoutes  from './routes/garantias.js';

const app = express();

app.use(helmet());
app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // 10mb para adjuntos base64
app.use(express.urlencoded({ extended: true }));

// Rate limit general
app.set('trust proxy', 1);
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Esperá un momento.' },
}));

// Rate limit estricto para login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Demasiados intentos. Esperá 15 minutos.' },
});

// Rutas
app.use('/auth',         loginLimiter, authRoutes);
app.use('/empleado',     empleadoRoutes);
app.use('/recibos',      recibosRoutes);
app.use('/cuenta-cte',   cuentaRoutes);
app.use('/rrhh',         rrhhRoutes);
app.use('/fichajes',     fichajesRoutes);
app.use('/admin',        adminRoutes);
app.use('/avisos',       avisosRoutes);
app.use('/beneficios',   beneficiosRoutes);
app.use('/ubicaciones',  ubicacionesRoutes);
app.use('/capacitaciones', capacitacionesRoutes);
app.use('/garantias',    garantiasRoutes);

// Healthcheck
app.get('/health', (req, res) => {
  res.json({ ok: true, version: '1.0.0', timestamp: new Date().toISOString() });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

export default app;