import { Router } from 'express';
import { getUbicaciones, crearUbicacion, actualizarUbicacion, eliminarUbicacion } from '../controllers/ubicaciones.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', requireAuth, getUbicaciones);
router.post('/', requireAuth, crearUbicacion);
router.put('/:id', requireAuth, actualizarUbicacion);
router.delete('/:id', requireAuth, eliminarUbicacion);

export default router;