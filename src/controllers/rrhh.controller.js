// src/controllers/rrhh.controller.js
import { db } from '../db/client.js';

// GET /rrhh/solicitudes
export async function listarSolicitudes(req, res) {
  const empleado_id = req.empleado.sub;
  const empresa_id  = req.empleado.empresa_id;
  try {
    const { rows } = await db.query(
      `SELECT id, tipo, fecha_inicio, fecha_fin, motivo, estado, cert_medico_url, created_at
       FROM solicitudes
       WHERE empleado_id = $1 AND empresa_id = $2
       ORDER BY created_at DESC`,
      [empleado_id, empresa_id]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// POST /rrhh/solicitudes
export async function crearSolicitud(req, res) {
  const empleado_id = req.empleado.sub;
  const empresa_id  = req.empleado.empresa_id;
  const { tipo, fecha_inicio, fecha_fin, motivo, cert_medico_url } = req.body;
  if (!tipo) return res.status(400).json({ error: 'El tipo es requerido.' });
  try {
    const { rows: [sol] } = await db.query(
      `INSERT INTO solicitudes (empresa_id, empleado_id, tipo, fecha_inicio, fecha_fin, motivo, cert_medico_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [empresa_id, empleado_id, tipo, fecha_inicio || null, fecha_fin || null, motivo || null, cert_medico_url || null]
    );
    return res.status(201).json(sol);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
