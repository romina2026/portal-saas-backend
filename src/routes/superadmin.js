// src/routes/superadmin.js
import { Router } from 'express';
import { requireSuperAdmin } from '../middleware/auth.middleware.js';
import { getEmpresas, crearEmpresa, actualizarEmpresa, desactivarEmpresa, getStats } from '../controllers/superadmin.controller.js';

const router = Router();
router.use(requireSuperAdmin);
router.get('/empresas', getEmpresas);
router.post('/empresas', crearEmpresa);
router.put('/empresas/:id', actualizarEmpresa);
router.delete('/empresas/:id', desactivarEmpresa);
router.get('/stats', getStats);
export default router;
