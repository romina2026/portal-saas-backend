// src/routes/admin.js
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';
import {
  getEmpleados, crearEmpleado, actualizarEmpleado,
  getFichajes, getSolicitudes, actualizarSolicitud,
  getRecibos
} from '../controllers/adminEmpresa.controller.js';

const router = Router();
router.use(requireAuth, requireAdmin);
router.get('/empleados', getEmpleados);
router.post('/empleados', crearEmpleado);
router.put('/empleados/:id', actualizarEmpleado);
router.get('/fichajes', getFichajes);
router.get('/solicitudes', getSolicitudes);
router.put('/solicitudes/:id', actualizarSolicitud);
router.get('/recibos', getRecibos);
export default router;
