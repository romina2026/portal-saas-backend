// src/routes/health.js
import { Router } from 'express';
const router = Router();
router.get('/', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));
export default router;
