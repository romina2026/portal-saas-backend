// src/routes/garantias.js
import { Router } from 'express';
import { getClienteManager } from '../controllers/garantias.controller.js';

const router = Router();

// Público — busca cliente en Manager para autocompletar
router.get('/cliente-manager/:codCliente', getClienteManager);

export default router;