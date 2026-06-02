import { db } from '../db/client.js';

export async function getAvisos(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT * FROM avisos WHERE activo = true ORDER BY importante DESC, created_at DESC`
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function crearAviso(req, res) {
  const { titulo, contenido, importante, url_adjunto, tipo_adjunto } = req.body;
  try {
    const { rows: [aviso] } = await db.query(
      `INSERT INTO avisos (titulo, contenido, importante, url_adjunto, tipo_adjunto)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [titulo, contenido, importante || false, url_adjunto || null, tipo_adjunto || null]
    );
    return res.status(201).json(aviso);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function desactivarAviso(req, res) {
  try {
    await db.query(`UPDATE avisos SET activo = false WHERE id = $1`, [req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}