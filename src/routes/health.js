// src/routes/health.js
import { Router } from 'express';
import { verificarConexion } from '../services/manager.service.js';
import { db } from '../db/client.js';

const router = Router();

router.get('/', async (req, res) => {
  const [manager, database] = await Promise.allSettled([
    verificarConexion(),
    db.query('SELECT 1').then(() => ({ ok: true })).catch(e => ({ ok: false, error: e.message })),
  ]);

  const resultado = {
    timestamp:  new Date().toISOString(),
    version:    '1.0.0',
    servicios: {
      database: database.status === 'fulfilled' ? database.value : { ok: false },
      manager:  manager.status  === 'fulfilled' ? manager.value  : { ok: false },
    },
  };

  const todoOk = resultado.servicios.database.ok && resultado.servicios.manager.ok;
  return res.status(todoOk ? 200 : 503).json(resultado);
});

export default router;
