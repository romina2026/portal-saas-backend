import { db } from '../db/client.js';
// POST /fichajes/entrada
export async function registrarEntrada(req, res) {
  const { lat, lng } = req.body;
  try {
    // Validar ubicacion si se enviaron coordenadas
    if (lat && lng) {
      const { rows: ubicaciones } = await db.query(
        `SELECT * FROM ubicaciones_empresa WHERE activo = true`
      );
      const dentroDeUbicacion = ubicaciones.some(u => {
        const R = 6371000;
        const dLat = (u.lat - lat) * Math.PI / 180;
        const dLng = (u.lng - lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat * Math.PI / 180) * Math.cos(u.lat * Math.PI / 180) *
          Math.sin(dLng/2) * Math.sin(dLng/2);
        const distancia = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return distancia <= (u.radio_metros || 100);
      });
      if (!dentroDeUbicacion) {
        return res.status(403).json({ error: 'Debes estar en una ubicacion de la empresa para fichar.' });
      }
    }
    // Verificar que no haya una entrada sin salida del mismo dia
    const { rows: [abierto] } = await db.query(
      `SELECT id FROM fichajes WHERE empleado_id=$1 AND estado='activo' AND entrada::date = CURRENT_DATE`,
      [req.empleado.sub]
    );
    if (abierto) {
      return res.status(409).json({ error: 'Ya tenes una entrada registrada hoy sin salida.' });
    }
    const { rows: [fichaje] } = await db.query(
      `INSERT INTO fichajes (empleado_id, lat_entrada, lng_entrada)
       VALUES ($1, $2, $3)
       RETURNING id, entrada, lat_entrada, lng_entrada`,
      [req.empleado.sub, lat ?? null, lng ?? null]
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
  try {
    const { rows: [abierto] } = await db.query(
      `SELECT entrada FROM fichajes
       WHERE empleado_id=$1 AND estado='activo'
       ORDER BY entrada DESC LIMIT 1`,
      [req.empleado.sub]
    );
    if (!abierto) {
      return res.status(409).json({ error: 'No hay una entrada activa para cerrar.' });
    }
    const { rows: [fichaje] } = await db.query(
      `UPDATE fichajes
       SET salida=NOW(), lat_salida=$1, lng_salida=$2
       WHERE id=$3
       RETURNING id, entrada, salida, horas_trabajadas`,
      [lat ?? null, lng ?? null, abierto.id]
    );
    return res.json({ mensaje: 'Salida registrada.', fichaje });
  } catch (err) {
    console.error('[fichajes/salida]', err);
    return res.status(500).json({ error: 'Error registrando salida.' });
  }
}

// GET /fichajes/semana  - fichajes de la semana actual
export async function getFichajesSemana(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT id, entrada, salida, horas_trabajadas, estado
       FROM fichajes
       WHERE empleado_id=$1
         AND entrada >= date_trunc('week', NOW())
       ORDER BY entrada DESC`,
      [req.empleado.sub]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Error obteniendo fichajes.' });
  }
}

// GET /fichajes/estado  - si hay entrada activa hoy
export async function getEstadoHoy(req, res) {
  try {
    const { rows: [activo] } = await db.query(
      `SELECT id, entrada FROM fichajes
       WHERE empleado_id=$1 AND estado='activo' AND entrada::date = CURRENT_DATE
       ORDER BY entrada DESC LIMIT 1`,
      [req.empleado.sub]
    );
    return res.json({ activo: !!activo, fichaje: activo || null });
  } catch (err) {
    return res.status(500).json({ error: 'Error obteniendo estado.' });
  }
}

// GET /fichajes/admin
export async function getFichajesAdmin(req, res) {
  const { desde, hasta } = req.query;
  try {
    const { rows } = await db.query(
      `SELECT f.id, f.entrada, f.salida, f.horas_trabajadas, f.estado,
              f.lat_entrada, f.lng_entrada, e.nombre_completo, e.legajo
       FROM fichajes f
       JOIN empleados e ON e.id = f.empleado_id
       WHERE f.entrada::date BETWEEN $1 AND $2
       ORDER BY f.entrada DESC`,
      [desde || new Date().toISOString().slice(0,10), hasta || new Date().toISOString().slice(0,10)]
    );
    const { rows: ubicaciones } = await db.query(`SELECT * FROM ubicaciones_empresa WHERE activo = true`);
    function distanciaMetros(lat1, lng1, lat2, lng2) {
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    const resultado = rows.map(f => {
      let sucursal = '—';
      if (f.lat_entrada && f.lng_entrada) {
        let menorDist = Infinity;
        for (const u of ubicaciones) {
          const dist = distanciaMetros(Number(f.lat_entrada), Number(f.lng_entrada), Number(u.lat), Number(u.lng));
          if (dist < menorDist) { menorDist = dist; sucursal = `${u.nombre} (${Math.round(dist)}m)`; }
        }
      }
      return { ...f, sucursal };
    });
    return res.json(resultado);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}