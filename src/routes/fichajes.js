// src/routes/fichajes.js
import { Router } from 'express';
import { registrarEntrada, registrarSalida, getFichajesSemana, getEstadoHoy, getFichajesAdmin } from '../controllers/fichajes.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
const router = Router();
router.get('/estado',   requireAuth, getEstadoHoy);
router.get('/semana',   requireAuth, getFichajesSemana);
router.post('/entrada', requireAuth, registrarEntrada);
router.post('/salida',  requireAuth, registrarSalida);
router.get('/admin', requireAuth, getFichajesAdmin);
export default router;
