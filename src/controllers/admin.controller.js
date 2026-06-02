import { PDFDocument } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';
import { db } from '../db/client.js';
import 'dotenv/config';

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

const BUCKET = process.env.STORAGE_BUCKET || 'recibos';

export async function subirRecibos(req, res) {
  return res.json({ mensaje: 'Usar subirReciboIndividual' });
}

export async function subirReciboIndividual(req, res) {
  try {
    const { legajo, periodo } = req.body;
    const pdfBuffer = req.file?.buffer;
    if (!pdfBuffer || !legajo || !periodo) return res.status(400).json({ error: 'Faltan datos' });
    const leg = legajo.toString();
    const legPad = leg.padStart(8, '0');
    const { rows } = await db.query('SELECT id FROM empleados WHERE legajo = $1 OR legajo = $2', [leg, legPad]);
    if (!rows.length) return res.status(404).json({ error: 'Empleado no encontrado: ' + legajo });
    const empId = rows[0].id;
    const ruta = 'recibos/' + empId + '/' + periodo + '.pdf';
    const { error } = await getSupabase().storage.from(BUCKET).upload(ruta, pdfBuffer, { contentType: 'application/pdf', upsert: true });
    if (error) return res.status(500).json({ error: error.message });
    await db.query('INSERT INTO recibos (empleado_id, periodo, url_archivo) VALUES ($1,$2,$3) ON CONFLICT (empleado_id, periodo) DO UPDATE SET url_archivo=$3', [empId, periodo, ruta]);
    return res.json({ mensaje: 'OK', legajo });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function registrarRecibo(req, res) {
  try {
    const { empleado_id, periodo, url_archivo } = req.body;
    if (!empleado_id || !periodo || !url_archivo) return res.status(400).json({ error: 'Faltan datos' });
    await db.query('INSERT INTO recibos (empleado_id, periodo, url_archivo) VALUES ($1,$2,$3) ON CONFLICT (empleado_id, periodo) DO UPDATE SET url_archivo=$3', [empleado_id, periodo, url_archivo]);
    return res.json({ mensaje: 'OK' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function listarRecibosAdmin(req, res) {
  try {
    const { periodo } = req.query;
    let query = `
      SELECT r.id, r.periodo, r.firmado_en, r.ip_firma,
             e.nombre_completo, e.legajo
      FROM recibos r
      JOIN empleados e ON e.id = r.empleado_id
      WHERE e.activo = true
    `;
    const params = [];
    if (periodo) {
      params.push(periodo);
      query += ` AND r.periodo = $${params.length}`;
    }
    query += ` ORDER BY e.nombre_completo ASC`;
    const { rows } = await db.query(query, params);
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function listarEmpleados(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT e.id, e.legajo, e.nombre_completo, e.cargo, e.area, e.activo, e.codigo_cliente,
             em.manager_codigo
      FROM empleados e
      LEFT JOIN empleados_manager em ON em.empleado_id = e.id
      ORDER BY e.legajo
    `);
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function crearEmpleado(req, res) {
  try {
    const { legajo, nombre_completo, cargo, area, manager_codigo, codigo_cliente, password } = req.body;
    if (!legajo || !nombre_completo) return res.status(400).json({ error: 'Faltan datos obligatorios' });
    const passwordFinal = password || '1234';
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.default.hash(passwordFinal, 10);
    const { rows: [emp] } = await db.query(
      'INSERT INTO empleados (legajo, nombre_completo, cargo, area, codigo_cliente) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [legajo, nombre_completo, cargo || null, area || null, codigo_cliente || null]
    );
    await db.query(
      'INSERT INTO credenciales (empleado_id, hash_password, debe_cambiar_pass) VALUES ($1,$2,true)',
      [emp.id, hash]
    );
    if (manager_codigo) {
      await db.query('INSERT INTO empleados_manager (empleado_id, manager_codigo) VALUES ($1,$2) ON CONFLICT (empleado_id) DO UPDATE SET manager_codigo=$2', [emp.id, manager_codigo]);
    }
    return res.json({ mensaje: 'OK', id: emp.id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function actualizarEmpleado(req, res) {
  try {
    const { legajo, nombre_completo, cargo, area, manager_codigo, codigo_cliente, password } = req.body;
    const { id } = req.params;
    await db.query(
      'UPDATE empleados SET legajo=$1, nombre_completo=$2, cargo=$3, area=$4, codigo_cliente=$5 WHERE id=$6',
      [legajo, nombre_completo, cargo || null, area || null, codigo_cliente || null, id]
    );
    if (password) {
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.default.hash(password, 10);
      await db.query(
        'INSERT INTO credenciales (empleado_id, hash_password) VALUES ($1,$2) ON CONFLICT (empleado_id) DO UPDATE SET hash_password=$2',
        [id, hash]
      );
    }
    if (manager_codigo) {
      await db.query('INSERT INTO empleados_manager (empleado_id, manager_codigo) VALUES ($1,$2) ON CONFLICT (empleado_id) DO UPDATE SET manager_codigo=$2', [id, manager_codigo]);
    }
    return res.json({ mensaje: 'OK' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function eliminarEmpleado(req, res) {
  try {
    const { id } = req.params;
    await db.query('UPDATE empleados SET activo = false WHERE id = $1', [id]);
    return res.json({ mensaje: 'OK' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function desbloquearEmpleado(req, res) {
  try {
    const { id } = req.params;
    await db.query(
      'UPDATE credenciales SET bloqueado_hasta = NULL, intentos_fallidos = 0 WHERE empleado_id = $1',
      [id]
    );
    return res.json({ mensaje: 'OK' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function listarSolicitudes(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT s.id, s.tipo, s.fecha_solicitada, s.descripcion, s.estado, s.url_adjunto,
             e.nombre_completo
      FROM solicitudes s
      JOIN empleados e ON e.id = s.empleado_id
      ORDER BY s.created_at DESC
    `);
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function responderSolicitud(req, res) {
  try {
    const { estado, respuesta } = req.body;
    await db.query('UPDATE solicitudes SET estado=$1, respuesta_admin=$2 WHERE id=$3', [estado, respuesta || '', req.params.id]);
    return res.json({ mensaje: 'OK' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function subirCtaCte(req, res) {
  try {
    const { periodo, saldos } = req.body;
    if (!periodo || !saldos || !Array.isArray(saldos)) {
      return res.status(400).json({ error: 'Faltan datos' });
    }
    let procesados = 0, saltados = 0, noEncontrados = [];
    for (const { codigo, saldo } of saldos) {
      const { rows } = await db.query(
        'SELECT id FROM empleados WHERE codigo_cliente = $1',
        [codigo.toString()]
      );
      if (!rows.length) { noEncontrados.push(codigo); saltados++; continue; }
      await db.query(
        `INSERT INTO cuenta_corriente (empleado_id, saldo, periodo, ultima_actualizacion)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (empleado_id) DO UPDATE SET saldo=$2, periodo=$3, ultima_actualizacion=NOW()`,
        [rows[0].id, saldo, periodo]
      );
      procesados++;
    }
    return res.json({ mensaje: 'Completado', procesados, saltados, noEncontrados });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
