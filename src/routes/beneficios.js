import { Router } from 'express';
import { getBeneficios, crearBeneficio, actualizarBeneficio, desactivarBeneficio } from '../controllers/beneficios.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', requireAuth, getBeneficios);
router.post('/', requireAuth, crearBeneficio);
router.put('/:id', requireAuth, actualizarBeneficio);
router.delete('/:id', requireAuth, desactivarBeneficio);

export default router;