// src/controllers/superadmin.controller.js
import bcrypt from 'bcryptjs';
import { db } from '../db/client.js';

const PLANES = { starter: 25, growth: 75, pro: 150, enterprise: 9999 };

// GET /super/empresas
export async function getEmpresas(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT e.id, e.nombre, e.cuit, e.email_admin, e.plan, e.estado,
              e.max_empleados, e.fecha_registro, e.fecha_vencimiento,
              COUNT(emp.id) as total_empleados
       FROM empresas e
       LEFT JOIN empleados emp ON emp.empresa_id = e.id AND emp.activo = true
       GROUP BY e.id
       ORDER BY e.fecha_registro DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('[super/empresas]', err);
    return res.status(500).json({ error: 'Error interno.' });
  }
}

// POST /super/empresas — crear empresa nueva
export async function crearEmpresa(req, res) {
  const { nombre, cuit, email_admin, plan = 'starter', password_admin, nombre_admin } = req.body;
  if (!nombre || !email_admin || !password_admin) {
    return res.status(400).json({ error: 'Nombre, email admin y contraseña son requeridos.' });
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const max_empleados = PLANES[plan] || 25;
    const fecha_vencimiento = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días trial

    const { rows: [empresa] } = await client.query(
      `INSERT INTO empresas (nombre, cuit, email_admin, plan, max_empleados, fecha_vencimiento)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre, cuit || null, email_admin, plan, max_empleados, fecha_vencimiento]
    );

    // Crear empleado admin
    const { rows: [empAdmin] } = await client.query(
      `INSERT INTO empleados (empresa_id, nombre, apellido, email, cargo, activo)
       VALUES ($1, $2, '', $3, 'Administrador', true) RETURNING id`,
      [empresa.id, nombre_admin || 'Admin', email_admin]
    );

    // Crear credencial admin
    const hash = await bcrypt.hash(password_admin, 10);
    await client.query(
      `INSERT INTO credenciales (empleado_id, empresa_id, username, password_hash, debe_cambiar_pass, es_admin_empresa)
       VALUES ($1, $2, $3, $4, false, true)`,
      [empAdmin.id, empresa.id, email_admin, hash]
    );

    await client.query('COMMIT');
    return res.status(201).json({ mensaje: 'Empresa creada correctamente.', empresa });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[super/crear-empresa]', err);
    if (err.code === '23505') return res.status(400).json({ error: 'El email ya está registrado.' });
    return res.status(500).json({ error: 'Error interno.' });
  } finally {
    client.release();
  }
}

// PUT /super/empresas/:id
export async function actualizarEmpresa(req, res) {
  const { id } = req.params;
  const { nombre, cuit, plan, estado, fecha_vencimiento } = req.body;
  try {
    const max_empleados = plan ? (PLANES[plan] || 25) : undefined;
    const { rows: [empresa] } = await db.query(
      `UPDATE empresas SET
        nombre = COALESCE($1, nombre),
        cuit = COALESCE($2, cuit),
        plan = COALESCE($3, plan),
        estado = COALESCE($4, estado),
        fecha_vencimiento = COALESCE($5, fecha_vencimiento),
        max_empleados = COALESCE($6, max_empleados)
       WHERE id = $7 RETURNING *`,
      [nombre, cuit, plan, estado, fecha_vencimiento, max_empleados, id]
    );
    if (!empresa) return res.status(404).json({ error: 'Empresa no encontrada.' });
    return res.json(empresa);
  } catch (err) {
    return res.status(500).json({ error: 'Error interno.' });
  }
}

// DELETE /super/empresas/:id (desactiva, no borra)
export async function desactivarEmpresa(req, res) {
  const { id } = req.params;
  try {
    await db.query(`UPDATE empresas SET estado='inactiva' WHERE id=$1`, [id]);
    return res.json({ mensaje: 'Empresa desactivada.' });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno.' });
  }
}

// GET /super/stats
export async function getStats(req, res) {
  try {
    const { rows: [stats] } = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado='activa') as empresas_activas,
        COUNT(*) FILTER (WHERE estado='inactiva') as empresas_inactivas,
        COUNT(*) FILTER (WHERE plan='starter') as plan_starter,
        COUNT(*) FILTER (WHERE plan='growth') as plan_growth,
        COUNT(*) FILTER (WHERE plan='pro') as plan_pro
      FROM empresas
    `);
    const { rows: [emps] } = await db.query(`SELECT COUNT(*) as total_empleados FROM empleados WHERE activo=true`);
    return res.json({ ...stats, total_empleados: emps.total_empleados });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno.' });
  }
}
