// src/routes/empleado.js
import { Router } from 'express';
import { getPerfil } from '../controllers/empleado.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
const router = Router();
router.get('/perfil', requireAuth, getPerfil);
export default router;
