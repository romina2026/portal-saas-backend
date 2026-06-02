// src/controllers/rrhh.controller.js

import { db }           from '../db/client.js';
import { subirArchivo } from '../services/storage.service.js';

const TIPOS_VALIDOS  = ['dia_personal', 'vacaciones', 'cert_medico', 'consulta'];
const ESTADOS_VALIDOS = ['pendiente', 'aprobada', 'rechazada', 'en_revision'];

// GET /rrhh/solicitudes
export async function listarSolicitudes(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT id, tipo, fecha_solicitada, descripcion, estado,
              respuesta_rrhh, respondido_en, created_at
       FROM solicitudes_rrhh
       WHERE empleado_id = $1
       ORDER BY created_at DESC`,
      [req.empleado.sub]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Error obteniendo solicitudes.' });
  }
}

// POST /rrhh/solicitudes
export async function crearSolicitud(req, res) {
  const { tipo, fecha_solicitada, descripcion, url_adjunto } = req.body;

  if (!TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ error: `Tipo inválido. Válidos: ${TIPOS_VALIDOS.join(', ')}` });
  }
  if (!fecha_solicitada) {
    return res.status(400).json({ error: 'La fecha es requerida.' });
  }

  try {
    const { rows: [sol] } = await db.query(
     `INSERT INTO solicitudes_rrhh (empleado_id, tipo, fecha_solicitada, descripcion, url_adjunto)
 VALUES ($1, $2, $3, $4, $5)
 RETURNING id, tipo, fecha_solicitada, estado, created_at`,
[req.empleado.sub, tipo, fecha_solicitada, descripcion ?? '', url_adjunto ?? null]
    );
    return res.status(201).json(sol);
  } catch (err) {
    console.error('[rrhh/crear]', err);
    return res.status(500).json({ error: 'Error creando solicitud.' });
  }
}

// POST /rrhh/solicitudes/:id/adjunto  — sube certificado médico u otro doc
export async function subirAdjunto(req, res) {
  const { base64, mimeType, nombre } = req.body;

  if (!base64 || !mimeType) {
    return res.status(400).json({ error: 'base64 y mimeType son requeridos.' });
  }

  const tiposPermitidos = ['application/pdf', 'image/jpeg', 'image/png'];
  if (!tiposPermitidos.includes(mimeType)) {
    return res.status(400).json({ error: 'Solo se permiten PDF, JPG y PNG.' });
  }

  try {
    const { rows: [sol] } = await db.query(
      `SELECT id FROM solicitudes_rrhh WHERE id=$1 AND empleado_id=$2`,
      [req.params.id, req.empleado.sub]
    );
    if (!sol) return res.status(404).json({ error: 'Solicitud no encontrada.' });

    const ext      = mimeType.split('/')[1].replace('jpeg', 'jpg');
    const path     = `adjuntos/${req.empleado.legajo}/${req.params.id}.${ext}`;
    const buffer   = Buffer.from(base64, 'base64');

    await subirArchivo(path, buffer, mimeType);

    await db.query(
      `UPDATE solicitudes_rrhh SET url_adjunto=$1 WHERE id=$2`,
      [path, req.params.id]
    );

    return res.json({ mensaje: 'Adjunto subido correctamente.', path });
  } catch (err) {
    console.error('[rrhh/adjunto]', err);
    return res.status(500).json({ error: 'Error subiendo adjunto.' });
  }
}
