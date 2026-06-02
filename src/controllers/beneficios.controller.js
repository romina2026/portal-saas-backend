import { db } from '../db/client.js';

export async function getBeneficios(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT * FROM beneficios WHERE activo = true ORDER BY created_at ASC`
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function crearBeneficio(req, res) {
  const { nombre, comercio, descuento, descripcion, vencimiento } = req.body;
  try {
    const { rows: [b] } = await db.query(
      `INSERT INTO beneficios (nombre, comercio, descuento, descripcion, vencimiento)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre, comercio, descuento, descripcion || null, vencimiento]
    );
    return res.status(201).json(b);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function actualizarBeneficio(req, res) {
  const { nombre, comercio, descuento, descripcion, vencimiento, activo } = req.body;
  try {
    const { rows: [b] } = await db.query(
      `UPDATE beneficios SET nombre=$1, comercio=$2, descuento=$3, descripcion=$4, vencimiento=$5, activo=$6
       WHERE id=$7 RETURNING *`,
      [nombre, comercio, descuento, descripcion || null, vencimiento, activo ?? true, req.params.id]
    );
    return res.json(b);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function desactivarBeneficio(req, res) {
  try {
    await db.query(`UPDATE beneficios SET activo = false WHERE id = $1`, [req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}