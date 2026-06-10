// src/routes/recibos.js
import { Router } from 'express';
import { listarRecibos, getUrlDescarga, firmarRecibo } from '../controllers/recibos.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.get('/',          requireAuth, listarRecibos);
router.get('/:id/url',   requireAuth, getUrlDescarga);
router.post('/:id/firmar', requireAuth, firmarRecibo);
export default router;
