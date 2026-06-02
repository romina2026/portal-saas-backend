// src/routes/garantias.js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  loginGarantias,
  getEtapas,
  listarOrdenes,
  getOrden,
  crearOrden,
  actualizarEtapa,
  registrarNotificacion,
  getHistorial,
  consultaPublica,
  getClienteManager,
  exportarExcel,
} from '../controllers/garantias.controller.js';

const router = Router();

// ── Rutas públicas (sin auth) ─────────────────────────────────
router.post('/login',                loginGarantias);
router.get('/exportar-excel',           requireAuth, exportarExcel);
router.get('/cliente-manager/:codigo',  requireAuth, getClienteManager);
router.get('/publica/:nroOrden',     consultaPublica);

// ── Rutas internas (requieren auth) ──────────────────────────
router.get('/etapas',                requireAuth, getEtapas);
router.get('/',                      requireAuth, listarOrdenes);
router.post('/',                     requireAuth, crearOrden);
router.get('/:id',                   requireAuth, getOrden);
router.post('/:id/etapa',            requireAuth, actualizarEtapa);
router.post('/:id/notificacion',     requireAuth, registrarNotificacion);
router.get('/:id/historial',         requireAuth, getHistorial);

export default router;
