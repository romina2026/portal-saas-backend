// src/controllers/recibos.controller.js
import { db } from '../db/client.js';

// GET /recibos — listar recibos del empleado
export async function listarRecibos(req, res) {
  const empleado_id = req.empleado.sub;
  const empresa_id  = req.empleado.empresa_id;
  try {
    const { rows } = await db.query(
      `SELECT id, periodo, archivo_url, confirmado, fecha_confirmacion, created_at
       FROM recibos
       WHERE empleado_id = $1 AND empresa_id = $2
       ORDER BY periodo DESC`,
      [empleado_id, empresa_id]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /recibos/:id/url
export async function getUrlDescarga(req, res) {
  const empleado_id = req.empleado.sub;
  const empresa_id  = req.empleado.empresa_id;
  try {
    const { rows: [recibo] } = await db.query(
      `SELECT id, archivo_url FROM recibos WHERE id = $1 AND empleado_id = $2 AND empresa_id = $3`,
      [req.params.id, empleado_id, empresa_id]
    );
    if (!recibo) return res.status(404).json({ error: 'Recibo no encontrado.' });
    const url = `${process.env.SUPABASE_URL}/storage/v1/object/public/${recibo.archivo_url}`;
    return res.json({ url });
  } catch (err) {
    return res.status(500).json({ error: 'Error generando enlace.' });
  }
}

// POST /recibos/:id/firmar
export async function firmarRecibo(req, res) {
  const empleado_id = req.empleado.sub;
  const empresa_id  = req.empleado.empresa_id;
  try {
    const ip = req.headers['x-forwarded-for'] || req.ip || 'desconocida';
    const { rows: [recibo] } = await db.query(
      `SELECT id, confirmado FROM recibos WHERE id = $1 AND empleado_id = $2 AND empresa_id = $3`,
      [req.params.id, empleado_id, empresa_id]
    );
    if (!recibo) return res.status(404).json({ error: 'Recibo no encontrado.' });
    if (recibo.confirmado) return res.status(400).json({ error: 'El recibo ya fue confirmado.' });
    await db.query(
      `UPDATE recibos SET confirmado = true, fecha_confirmacion = NOW(), ip_confirmacion = $1 WHERE id = $2`,
      [ip, req.params.id]
    );
    return res.json({ mensaje: 'Recibo confirmado correctamente.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// POST /admin/recibos/subir — subir recibo (admin)
export async function subirRecibo(req, res) {
  const empresa_id = req.empleado.empresa_id;
  const { empleado_id, periodo, archivo_url, legajo } = req.body;
  if (!periodo || !archivo_url) {
    return res.status(400).json({ error: 'Periodo y archivo_url son requeridos.' });
  }
  try {
    let emp_id = empleado_id;
    if (!emp_id && legajo) {
      const { rows: [emp] } = await db.query(
        `SELECT id FROM empleados WHERE legajo = $1 AND empresa_id = $2`,
        [legajo, empresa_id]
      );
      if (!emp) return res.status(404).json({ error: `Empleado con legajo ${legajo} no encontrado.` });
      emp_id = emp.id;
    }
    const { rows: [recibo] } = await db.query(
      `INSERT INTO recibos (empresa_id, empleado_id, periodo, archivo_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [empresa_id, emp_id, periodo, archivo_url]
    );
    return res.status(201).json(recibo);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
