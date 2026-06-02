import { db } from '../db/client.js';

export async function getCapacitaciones(req, res) {
  try {
    const { rows } = await db.query(`SELECT * FROM capacitaciones WHERE activo = true ORDER BY created_at DESC`);
    return res.json(rows);
  } catch (e) { return res.status(500).json({ error: e.message }); }
}

export async function crearCapacitacion(req, res) {
  const { nombre, descripcion, fecha_limite } = req.body;
  try {
    const { rows: [c] } = await db.query(
      `INSERT INTO capacitaciones (nombre, descripcion, fecha_limite) VALUES ($1, $2, $3) RETURNING *`,
      [nombre, descripcion || null, fecha_limite || null]
    );
    return res.status(201).json(c);
  } catch (e) { return res.status(500).json({ error: e.message }); }
}

export async function asignarCapacitacion(req, res) {
  const { capacitacion_id, empleado_ids } = req.body;
  try {
    for (const empleado_id of empleado_ids) {
      await db.query(
        `INSERT INTO capacitaciones_empleados (capacitacion_id, empleado_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [capacitacion_id, empleado_id]
      );
    }
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
}

export async function completarCapacitacion(req, res) {
  const { id } = req.params;
  try {
    await db.query(
      `UPDATE capacitaciones_empleados SET completado = true, fecha_completado = NOW() WHERE id = $1`,
      [id]
    );
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
}

export async function getCapacitacionesAdmin(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT ce.id, ce.completado, ce.fecha_completado,
             c.nombre, c.descripcion, c.fecha_limite,
             e.nombre_completo, e.legajo
      FROM capacitaciones_empleados ce
      JOIN capacitaciones c ON c.id = ce.capacitacion_id
      JOIN empleados e ON e.id = ce.empleado_id
      ORDER BY c.nombre, e.nombre_completo
    `);
    return res.json(rows);
  } catch (e) { return res.status(500).json({ error: e.message }); }
}

export async function getCapacitacionesEmpleado(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT ce.id, ce.completado, ce.fecha_completado,
             c.nombre, c.descripcion, c.fecha_limite
      FROM capacitaciones_empleados ce
      JOIN capacitaciones c ON c.id = ce.capacitacion_id
      WHERE ce.empleado_id = $1 AND c.activo = true
      ORDER BY ce.completado ASC, c.fecha_limite ASC
    `, [req.empleado.sub]);
    return res.json(rows);
  } catch (e) { return res.status(500).json({ error: e.message }); }
}

export async function eliminarCapacitacion(req, res) {
  try {
    await db.query(`UPDATE capacitaciones SET activo = false WHERE id = $1`, [req.params.id]);
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
}