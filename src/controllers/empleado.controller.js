// src/controllers/empleado.controller.js

import { db } from '../db/client.js';

// GET /empleado/perfil
export async function getPerfil(req, res) {
  try {
    const { rows: [emp] } = await db.query(
      `SELECT id, legajo, dni, nombre_completo, email, telefono, cargo, area, created_at
       FROM empleados WHERE id = $1`,
      [req.empleado.sub]
    );
    if (!emp) return res.status(404).json({ error: 'Empleado no encontrado.' });
    return res.json(emp);
  } catch (err) {
    return res.status(500).json({ error: 'Error interno.' });
  }
}
