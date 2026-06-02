import { db } from '../db/client.js';

export async function getUbicaciones(req, res) {
  try {
    const { rows } = await db.query(`SELECT * FROM ubicaciones_empresa WHERE activo = true ORDER BY created_at ASC`);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function crearUbicacion(req, res) {
  const { nombre, direccion, lat, lng, radio_metros } = req.body;
  try {
    const { rows: [u] } = await db.query(
      `INSERT INTO ubicaciones_empresa (nombre, direccion, lat, lng, radio_metros) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre, direccion, lat, lng, radio_metros || 100]
    );
    return res.status(201).json(u);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function actualizarUbicacion(req, res) {
  const { nombre, direccion, lat, lng, radio_metros, activo } = req.body;
  try {
    const { rows: [u] } = await db.query(
      `UPDATE ubicaciones_empresa SET nombre=$1, direccion=$2, lat=$3, lng=$4, radio_metros=$5, activo=$6 WHERE id=$7 RETURNING *`,
      [nombre, direccion, lat, lng, radio_metros || 100, activo ?? true, req.params.id]
    );
    return res.json(u);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function eliminarUbicacion(req, res) {
  try {
    await db.query(`UPDATE ubicaciones_empresa SET activo = false WHERE id = $1`, [req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}