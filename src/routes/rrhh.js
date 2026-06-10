// src/routes/rrhh.js
import { Router } from 'express';
import { listarSolicitudes, crearSolicitud } from '../controllers/rrhh.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.get('/solicitudes',  requireAuth, listarSolicitudes);
router.post('/solicitudes', requireAuth, crearSolicitud);
export default router;
