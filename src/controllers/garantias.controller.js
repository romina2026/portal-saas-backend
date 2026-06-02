// src/controllers/garantias.controller.js
import { db } from '../db/client.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as XLSX from 'xlsx';
// ── Login portal garantías ────────────────────────────────────
export async function loginGarantias(req, res) {
  const { usuario, password } = req.body;
  if (!usuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
  }
  try {
    const { rows: [user] } = await db.query(
      `SELECT id, usuario, hash_password, nombre, rol
       FROM usuarios_garantias
       WHERE usuario = $1 AND activo = true`,
      [usuario.trim().toLowerCase()]
    );
    if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    const ok = await bcrypt.compare(password, user.hash_password);
    if (!ok) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    const token = jwt.sign(
      { sub: user.id, usuario: user.usuario, nombre: user.nombre, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.json({
      token,
      usuario: { id: user.id, usuario: user.usuario, nombre: user.nombre, rol: user.rol },
    });
  } catch (err) {
    console.error('[garantias/login]', err);
    return res.status(500).json({ error: 'Error interno.' });
  }
}

// ── Catálogo de etapas ────────────────────────────────────────
export async function getEtapas(req, res) {
  try {
    const { rows } = await db.query(
      'SELECT id, codigo, nombre_interno, texto_cliente, orden_secuencia, es_opcional, es_final FROM etapas_reparacion ORDER BY orden_secuencia'
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── Listar órdenes (panel interno) ───────────────────────────
export async function listarOrdenes(req, res) {
  try {
    const { etapa, search } = req.query;
    let query = `
      SELECT
        o.id, o.nro_orden_manager, o.nro_garantia_manager,
        o.descripcion_equipo, o.nombre_cliente, o.telefono_cliente,
        o.tiene_garantia, o.fecha_vencimiento_garantia,
        o.tecnico_asignado, o.urgencia,
        o.fecha_ingreso, o.creado_en,
        e.id AS etapa_id, e.codigo AS etapa_codigo, e.nombre_interno AS etapa_nombre
      FROM ordenes_reparacion o
      JOIN etapas_reparacion e ON o.etapa_actual_id = e.id
      WHERE 1=1
    `;
    const params = [];
    if (etapa) {
      params.push(etapa);
      query += ` AND e.codigo = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (o.nro_orden_manager ILIKE $${params.length} OR o.nombre_cliente ILIKE $${params.length})`;
    }
    query += ' ORDER BY o.creado_en DESC';
    const { rows } = await db.query(query, params);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── Detalle de una orden (panel interno) ─────────────────────
export async function getOrden(req, res) {
  try {
    const { rows: [orden] } = await db.query(
      `SELECT o.*, e.id AS etapa_id, e.codigo AS etapa_codigo,
        e.nombre_interno AS etapa_nombre, e.texto_cliente AS etapa_texto_cliente
       FROM ordenes_reparacion o
       JOIN etapas_reparacion e ON o.etapa_actual_id = e.id
       WHERE o.id = $1`,
      [req.params.id]
    );
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada.' });
    return res.json(orden);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── Crear orden (panel interno) ───────────────────────────────
export async function crearOrden(req, res) {
  try {
    const {
      nro_orden_manager, nro_garantia_manager,
      descripcion_equipo, nro_serie, accesorios, estado_mercaderia,
      nombre_cliente, telefono_cliente, celular_cliente, email_cliente, detalle_cliente,
      tiene_garantia, fecha_compra, fecha_vencimiento_garantia, cubre_descripcion,
      urgencia, fecha_solicitud_retiro, tecnico_asignado, legajo_tecnico,
      observaciones, presup_formal,
    } = req.body;

    if (!nro_orden_manager || !descripcion_equipo || !nombre_cliente) {
      return res.status(400).json({ error: 'Faltan campos obligatorios.' });
    }

    const { rows: [orden] } = await db.query(
      `INSERT INTO ordenes_reparacion (
        nro_orden_manager, nro_garantia_manager,
        descripcion_equipo, nro_serie, accesorios, estado_mercaderia,
        nombre_cliente, telefono_cliente, celular_cliente, email_cliente, detalle_cliente,
        tiene_garantia, fecha_compra, fecha_vencimiento_garantia, cubre_descripcion,
        urgencia, fecha_solicitud_retiro, tecnico_asignado, legajo_tecnico,
        observaciones, presup_formal, creado_por, etapa_actual_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
        $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,1
      ) RETURNING id, nro_orden_manager, creado_en`,
      [
        nro_orden_manager, nro_garantia_manager,
        descripcion_equipo, nro_serie, accesorios, estado_mercaderia,
        nombre_cliente, telefono_cliente, celular_cliente ?? null, email_cliente, detalle_cliente,
        tiene_garantia ?? false, fecha_compra ?? null, fecha_vencimiento_garantia ?? null, cubre_descripcion ?? null,
        urgencia ?? null, fecha_solicitud_retiro ?? null, tecnico_asignado ?? null, legajo_tecnico ?? null,
        observaciones ?? null, presup_formal ?? true, req.empleado?.sub ?? null,
      ]
    );

    await db.query(
      'INSERT INTO historial_estados (orden_id, etapa_id, comentario, registrado_por) VALUES ($1, 1, $2, $3)',
      [orden.id, 'Orden creada', req.empleado?.sub ?? null]
    );

    return res.status(201).json(orden);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una orden con ese número de Manager MAX.' });
    }
    return res.status(500).json({ error: err.message });
  }
}

// ── Cambiar etapa (panel interno) ─────────────────────────────
export async function actualizarEtapa(req, res) {
  try {
    const { etapa_id, comentario } = req.body;
    if (!etapa_id) return res.status(400).json({ error: 'Falta etapa_id.' });
    await db.query(
      'SELECT cambiar_etapa($1, $2, $3, $4)',
      [req.params.id, etapa_id, comentario ?? null, req.empleado?.sub ?? null]
    );
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── Registrar notificación al cliente ────────────────────────
export async function registrarNotificacion(req, res) {
  try {
    const { canal, mensaje, enviado_ok } = req.body;
    if (!canal) return res.status(400).json({ error: 'Falta canal.' });
    await db.query(
      'INSERT INTO notificaciones_cliente (orden_id, canal, mensaje, enviado_por, enviado_ok) VALUES ($1, $2, $3, $4, $5)',
      [req.params.id, canal, mensaje ?? null, req.empleado?.sub ?? null, enviado_ok ?? true]
    );
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── Historial de estados ──────────────────────────────────────
export async function getHistorial(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT h.id, h.comentario, h.registrado_por, h.registrado_en,
        e.id AS etapa_id, e.codigo, e.nombre_interno, e.texto_cliente
       FROM historial_estados h
       JOIN etapas_reparacion e ON h.etapa_id = e.id
       WHERE h.orden_id = $1
       ORDER BY h.registrado_en ASC`,
      [req.params.id]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── Consulta pública (sin auth) ───────────────────────────────
export async function consultaPublica(req, res) {
  try {
    const nro = req.params.nroOrden.trim().toUpperCase();
    const { rows: [orden] } = await db.query(
      `SELECT o.nro_orden_manager, o.nro_garantia_manager,
        o.descripcion_equipo, o.nro_serie, o.nombre_cliente,
        o.tiene_garantia, o.fecha_compra,
        o.fecha_vencimiento_garantia, o.cubre_descripcion,
        o.fecha_ingreso, o.fecha_entrega_real, o.tecnico_asignado,
        e.codigo AS etapa_codigo, e.texto_cliente AS etapa_texto
       FROM ordenes_reparacion o
       JOIN etapas_reparacion e ON o.etapa_actual_id = e.id
       WHERE o.nro_orden_manager = $1 OR o.nro_garantia_manager = $1`,
      [nro]
    );
    if (!orden) return res.status(404).json({ error: 'No se encontró ninguna orden con ese número.' });

    const { rows: historial } = await db.query(
      `SELECT h.registrado_en, e.codigo, e.texto_cliente, e.orden_secuencia
       FROM historial_estados h
       JOIN etapas_reparacion e ON h.etapa_id = e.id
       WHERE h.orden_id = (
         SELECT id FROM ordenes_reparacion
         WHERE nro_orden_manager = $1 OR nro_garantia_manager = $1 LIMIT 1
       )
       ORDER BY h.registrado_en ASC`,
      [nro]
    );
    return res.json({ orden, historial });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getClienteManager(req, res) {
  const { codigo } = req.params;
  try {
    const url = `http://192.168.0.99/api/Api_Clientes/Consulta?key=mngpdkt042026&campo=ID&valor=${encodeURIComponent(codigo)}&error_sin_registros=false`;
    const response = await fetch(url);
    if (!response.ok) return res.status(404).json({ error: 'Cliente no encontrado.' });
    const data = await response.json();
    const cli = Array.isArray(data) ? data[0] : data;
    if (!cli || !cli.Razon_Social) return res.status(404).json({ error: 'Cliente no encontrado.' });
    return res.json({
      codigo:    cli.Codigo      || '',
      nombre:    cli.Razon_Social || '',
      telefono:  cli.Telefono    || '',
      celular:   cli.Tel_Celular || '',
      email:     cli.Email       || '',
    });
  } catch (err) {
    return res.status(500).json({ error: 'No se pudo conectar con Manager: ' + err.message });
  }
}

export async function exportarExcel(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT o.nro_orden_manager, o.nro_garantia_manager, o.fecha_ingreso,
             o.nombre_cliente, o.descripcion_equipo, o.nro_serie,
             o.tecnico_asignado, o.urgencia, o.observaciones,
             e.nombre_interno AS estado
      FROM ordenes_reparacion o
      JOIN etapas_reparacion e ON o.etapa_actual_id = e.id
      ORDER BY o.creado_en DESC
    `);

    const datos = rows.map(o => ({
      'Nro. Orden':    o.nro_orden_manager    || '',
      'Nro. Garantía': o.nro_garantia_manager || '',
      'Fecha ingreso': o.fecha_ingreso ? new Date(o.fecha_ingreso).toLocaleDateString('es-AR') : '',
      'Cliente':       o.nombre_cliente       || '',
      'Equipo':        o.descripcion_equipo   || '',
      'N° serie':      o.nro_serie            || '',
      'Técnico':       o.tecnico_asignado     || '',
      'Estado':        o.estado               || '',
      'Urgencia':      o.urgencia             || '',
      'Observaciones': o.observaciones        || '',
    }));

    const ws  = XLSX.utils.json_to_sheet(datos);
    const wb  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Órdenes');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename="ordenes_mecan_${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buf);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
