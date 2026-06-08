// src/controllers/fichajes.controller.js
import { db } from '../db/client.js';

function distanciaMetros(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// POST /fichajes/entrada
export async function registrarEntrada(req, res) {
  const { lat, lng } = req.body;
  const empleado_id = req.empleado.sub;
  const empresa_id  = req.empleado.empresa_id;

  try {
    // Validar ubicacion si se enviaron coordenadas
    if (lat && lng) {
      const { rows: ubicaciones } = await db.query(
        `SELECT * FROM ubicaciones_empresa WHERE empresa_id = $1`,
        [empresa_id]
      );
      if (ubicaciones.length > 0) {
        const dentroDeUbicacion = ubicaciones.some(u =>
          distanciaMetros(lat, lng, Number(u.latitud), Number(u.longitud)) <= (u.radio_metros || 100)
        );
        if (!dentroDeUbicacion) {
          return res.status(403).json({ error: 'Debes estar en una ubicación de la empresa para fichar.' });
        }
      }
    }

    // Verificar que no haya una entrada sin salida hoy
    const { rows: [ultimoFichaje] } = await db.query(
      `SELECT tipo FROM fichajes
       WHERE empleado_id = $1 AND empresa_id = $2
       AND created_at::date = CURRENT_DATE
       ORDER BY created_at DESC LIMIT 1`,
      [empleado_id, empresa_id]
    );

    if (ultimoFichaje?.tipo === 'entrada') {
      return res.status(409).json({ error: 'Ya tenés una entrada registrada hoy sin salida.' });
    }

    const { rows: [fichaje] } = await db.query(
      `INSERT INTO fichajes (empleado_id, empresa_id, tipo, latitud, longitud)
       VALUES ($1, $2, 'entrada', $3, $4)
       RETURNING id, tipo, created_at`,
      [empleado_id, empresa_id, lat ?? null, lng ?? null]
    );

    return res.status(201).json({ mensaje: 'Entrada registrada.', fichaje });
  } catch (err) {
    console.error('[fichajes/entrada]', err);
    return res.status(500).json({ error: 'Error registrando entrada.' });
  }
}

// POST /fichajes/salida
export async function registrarSalida(req, res) {
  const { lat, lng } = req.body;
  const empleado_id = req.empleado.sub;
  const empresa_id  = req.empleado.empresa_id;

  try {
    const { rows: [ultimoFichaje] } = await db.query(
      `SELECT tipo FROM fichajes
       WHERE empleado_id = $1 AND empresa_id = $2
       AND created_at::date = CURRENT_DATE
       ORDER BY created_at DESC LIMIT 1`,
      [empleado_id, empresa_id]
    );

    if (!ultimoFichaje || ultimoFichaje.tipo === 'salida') {
      return res.status(409).json({ error: 'No hay una entrada activa para cerrar.' });
    }

    const { rows: [fichaje] } = await db.query(
      `INSERT INTO fichajes (empleado_id, empresa_id, tipo, latitud, longitud)
       VALUES ($1, $2, 'salida', $3, $4)
       RETURNING id, tipo, created_at`,
      [empleado_id, empresa_id, lat ?? null, lng ?? null]
    );

    return res.json({ mensaje: 'Salida registrada.', fichaje });
  } catch (err) {
    console.error('[fichajes/salida]', err);
    return res.status(500).json({ error: 'Error registrando salida.' });
  }
}

// GET /fichajes/estado
export async function getEstadoHoy(req, res) {
  const empleado_id = req.empleado.sub;
  const empresa_id  = req.empleado.empresa_id;

  try {
    const { rows: [ultimoFichaje] } = await db.query(
      `SELECT tipo, created_at FROM fichajes
       WHERE empleado_id = $1 AND empresa_id = $2
       AND created_at::date = CURRENT_DATE
       ORDER BY created_at DESC LIMIT 1`,
      [empleado_id, empresa_id]
    );

    return res.json({
      activo: ultimoFichaje?.tipo === 'entrada',
      entrada: ultimoFichaje?.tipo === 'entrada' ? ultimoFichaje.created_at : null,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error obteniendo estado.' });
  }
}

// GET /fichajes/semana
export async function getFichajesSemana(req, res) {
  const empleado_id = req.empleado.sub;
  const empresa_id  = req.empleado.empresa_id;

  try {
    const { rows } = await db.query(
      `SELECT id, tipo, created_at, latitud, longitud
       FROM fichajes
       WHERE empleado_id = $1 AND empresa_id = $2
       AND created_at >= date_trunc('week', NOW())
       ORDER BY created_at ASC`,
      [empleado_id, empresa_id]
    );

    // Agrupar entradas y salidas por día
    const dias = {};
    for (const f of rows) {
      const fecha = f.created_at.toISOString().slice(0, 10);
      if (!dias[fecha]) dias[fecha] = { entrada: null, salida: null };
      if (f.tipo === 'entrada') dias[fecha].entrada = f.created_at;
      if (f.tipo === 'salida') dias[fecha].salida = f.created_at;
    }

    const resultado = Object.entries(dias).map(([fecha, v]) => {
      let horas_trabajadas = null;
      if (v.entrada && v.salida) {
        const diff = (new Date(v.salida) - new Date(v.entrada)) / 3600000;
        horas_trabajadas = diff.toFixed(1);
      }
      return { fecha, entrada: v.entrada, salida: v.salida, horas_trabajadas };
    });

    return res.json(resultado);
  } catch (err) {
    return res.status(500).json({ error: 'Error obteniendo fichajes.' });
  }
}
