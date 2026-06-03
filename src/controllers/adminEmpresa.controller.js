// src/controllers/adminEmpresa.controller.js
import bcrypt from 'bcryptjs';
import { db } from '../db/client.js';

// GET /admin/empleados
export async function getEmpleados(req, res) {
  const empresa_id = req.empleado.empresa_id;
  try {
    const { rows } = await db.query(
      `SELECT e.id, e.nombre, e.apellido, e.email, e.legajo, e.dni,
              e.cargo, e.sector, e.codigo_cliente, e.activo,
              c.username, c.debe_cambiar_pass, c.es_admin_empresa
       FROM empleados e
       LEFT JOIN credenciales c ON c.empleado_id = e.id
       WHERE e.empresa_id = $1
       ORDER BY e.apellido, e.nombre`,
      [empresa_id]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Error interno.' });
  }
}

// POST /admin/empleados
export async function crearEmpleado(req, res) {
  const empresa_id = req.empleado.empresa_id;
  const { nombre, apellido, email, legajo, dni, cargo, sector, username, password } = req.body;
  if (!nombre || !apellido || !username) {
    return res.status(400).json({ error: 'Nombre, apellido y usuario son requeridos.' });
  }

  // Verificar límite de empleados
  const { rows: [empresa] } = await db.query(`SELECT max_empleados FROM empresas WHERE id=$1`, [empresa_id]);
  const { rows: [count] } = await db.query(`SELECT COUNT(*) as total FROM empleados WHERE empresa_id=$1 AND activo=true`, [empresa_id]);
  if (parseInt(count.total) >= empresa.max_empleados) {
    return res.status(400).json({ error: `Límite de empleados alcanzado (${empresa.max_empleados}). Actualizá tu plan.` });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: [emp] } = await client.query(
      `INSERT INTO empleados (empresa_id, nombre, apellido, email, legajo, dni, cargo, sector)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [empresa_id, nombre, apellido, email||null, legajo||null, dni||null, cargo||null, sector||null]
    );
    const hash = await bcrypt.hash(password || '1234', 10);
    await client.query(
      `INSERT INTO credenciales (empleado_id, empresa_id, username, password_hash, debe_cambiar_pass)
       VALUES ($1,$2,$3,$4,true)`,
      [emp.id, empresa_id, username, hash]
    );
    await client.query('COMMIT');
    return res.status(201).json(emp);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(400).json({ error: 'El usuario ya existe.' });
    return res.status(500).json({ error: 'Error interno.' });
  } finally {
    client.release();
  }
}

// PUT /admin/empleados/:id
export async function actualizarEmpleado(req, res) {
  const empresa_id = req.empleado.empresa_id;
  const { id } = req.params;
  const { nombre, apellido, email, legajo, dni, cargo, sector, codigo_cliente, activo, username, password, es_admin_empresa } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: [emp] } = await client.query(
      `UPDATE empleados SET
        nombre=COALESCE($1,nombre), apellido=COALESCE($2,apellido),
        email=COALESCE($3,email), legajo=COALESCE($4,legajo),
        dni=COALESCE($5,dni), cargo=COALESCE($6,cargo),
        sector=COALESCE($7,sector), codigo_cliente=COALESCE($8,codigo_cliente),
        activo=COALESCE($9,activo)
       WHERE id=$10 AND empresa_id=$11 RETURNING *`,
      [nombre,apellido,email,legajo,dni,cargo,sector,codigo_cliente,activo,id,empresa_id]
    );
    if (!emp) return res.status(404).json({ error: 'Empleado no encontrado.' });

    if (username || password || es_admin_empresa !== undefined) {
      const updates = [];
      const vals = [];
      let i = 1;
      if (username) { updates.push(`username=$${i++}`); vals.push(username); }
      if (password) { updates.push(`password_hash=$${i++}`); vals.push(await bcrypt.hash(password, 10)); }
      if (es_admin_empresa !== undefined) { updates.push(`es_admin_empresa=$${i++}`); vals.push(es_admin_empresa); }
      if (updates.length) {
        vals.push(id);
        await client.query(`UPDATE credenciales SET ${updates.join(',')} WHERE empleado_id=$${i}`, vals);
      }
    }
    await client.query('COMMIT');
    return res.json(emp);
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Error interno.' });
  } finally {
    client.release();
  }
}

// GET /admin/fichajes
export async function getFichajes(req, res) {
  const empresa_id = req.empleado.empresa_id;
  const { desde, hasta, empleado_id } = req.query;
  try {
    let q = `SELECT f.id, f.tipo, f.sucursal, f.created_at,
                    e.nombre, e.apellido, e.legajo
             FROM fichajes f
             JOIN empleados e ON e.id = f.empleado_id
             WHERE f.empresa_id = $1`;
    const vals = [empresa_id];
    let i = 2;
    if (desde) { q += ` AND f.created_at >= $${i++}`; vals.push(desde); }
    if (hasta) { q += ` AND f.created_at <= $${i++}`; vals.push(hasta); }
    if (empleado_id) { q += ` AND f.empleado_id = $${i++}`; vals.push(empleado_id); }
    q += ' ORDER BY f.created_at DESC LIMIT 500';
    const { rows } = await db.query(q, vals);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Error interno.' });
  }
}

// GET /admin/solicitudes
export async function getSolicitudes(req, res) {
  const empresa_id = req.empleado.empresa_id;
  try {
    const { rows } = await db.query(
      `SELECT s.*, e.nombre, e.apellido, e.legajo
       FROM solicitudes s
       JOIN empleados e ON e.id = s.empleado_id
       WHERE s.empresa_id = $1
       ORDER BY s.created_at DESC`,
      [empresa_id]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Error interno.' });
  }
}

// PUT /admin/solicitudes/:id
export async function actualizarSolicitud(req, res) {
  const empresa_id = req.empleado.empresa_id;
  const { id } = req.params;
  const { estado } = req.body;
  try {
    const { rows: [s] } = await db.query(
      `UPDATE solicitudes SET estado=$1 WHERE id=$2 AND empresa_id=$3 RETURNING *`,
      [estado, id, empresa_id]
    );
    if (!s) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    return res.json(s);
  } catch (err) {
    return res.status(500).json({ error: 'Error interno.' });
  }
}

// GET /admin/recibos
export async function getRecibos(req, res) {
  const empresa_id = req.empleado.empresa_id;
  const { periodo } = req.query;
  try {
    let q = `SELECT r.*, e.nombre, e.apellido, e.legajo
             FROM recibos r
             LEFT JOIN empleados e ON e.id = r.empleado_id
             WHERE r.empresa_id = $1`;
    const vals = [empresa_id];
    if (periodo) { q += ` AND r.periodo = $2`; vals.push(periodo); }
    q += ' ORDER BY r.created_at DESC';
    const { rows } = await db.query(q, vals);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Error interno.' });
  }
}
