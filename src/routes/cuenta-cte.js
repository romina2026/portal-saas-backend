// src/routes/cuenta-cte.js
import { Router } from 'express';
import { getSaldo, getMovimientos, forzarSync } from '../controllers/cuentaCte.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
const router = Router();
router.get('/saldo',        requireAuth, getSaldo);
router.get('/movimientos',  requireAuth, getMovimientos);
router.post('/sync',        requireAuth, forzarSync);
export default router;
