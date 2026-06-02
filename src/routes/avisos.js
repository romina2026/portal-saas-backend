import { Router } from 'express';
import { getAvisos, crearAviso, desactivarAviso } from '../controllers/avisos.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', requireAuth, getAvisos);
router.post('/', requireAuth, crearAviso);
router.delete('/:id', requireAuth, desactivarAviso);

export default router;