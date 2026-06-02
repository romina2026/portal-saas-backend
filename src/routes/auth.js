// src/routes/auth.js
import { Router } from 'express';
import { login, refresh, logout, cambiarPassword } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.post('/login',            login);
router.post('/refresh',          refresh);
router.post('/logout',           logout);
router.post('/cambiar-password', requireAuth, cambiarPassword);
export default router;
