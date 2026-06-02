import { Router } from 'express';
import multer from 'multer';
import {
  subirRecibos,
  subirReciboIndividual,
  registrarRecibo,
  listarRecibosAdmin,
  listarEmpleados,
  crearEmpleado,
  actualizarEmpleado,
  eliminarEmpleado,
  desbloquearEmpleado,
  listarSolicitudes,
  responderSolicitud,
  subirCtaCte
} from '../controllers/admin.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/subir-recibos', requireAuth, subirRecibos);
router.post('/subir-recibo-individual', requireAuth, upload.single('pdf'), subirReciboIndividual);
router.post('/registrar-recibo', requireAuth, registrarRecibo);
router.get('/recibos', requireAuth, listarRecibosAdmin);
router.get('/empleados', requireAuth, listarEmpleados);
router.post('/empleados', requireAuth, crearEmpleado);
router.put('/empleados/:id', requireAuth, actualizarEmpleado);
router.delete('/empleados/:id', requireAuth, eliminarEmpleado);
router.put('/empleados/:id/desbloquear', requireAuth, desbloquearEmpleado);
router.get('/solicitudes', requireAuth, listarSolicitudes);
router.put('/solicitudes/:id', requireAuth, responderSolicitud);
router.post('/subir-cta-cte', requireAuth, subirCtaCte);

export default router;
