import { Router } from 'express';
import {
  getCapacitaciones,
  crearCapacitacion,
  asignarCapacitacion,
  completarCapacitacion,
  getCapacitacionesAdmin,
  getCapacitacionesEmpleado,
  eliminarCapacitacion
} from '../controllers/capacitaciones.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', requireAuth, getCapacitaciones);
router.post('/', requireAuth, crearCapacitacion);
router.post('/asignar', requireAuth, asignarCapacitacion);
router.put('/completar/:id', requireAuth, completarCapacitacion);
router.get('/admin', requireAuth, getCapacitacionesAdmin);
router.get('/empleado', requireAuth, getCapacitacionesEmpleado);
router.delete('/:id', requireAuth, eliminarCapacitacion);

export default router;