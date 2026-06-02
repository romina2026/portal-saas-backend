import { db } from '../db/client.js';
import { generarUrlFirmada } from '../services/storage.service.js';

export async function listarRecibos(req, res) {
  try {
    const { rows } = await db.query(
      'SELECT id, periodo, fecha_emision, url_archivo FROM recibos WHERE empleado_id = $1 ORDER BY periodo DESC',
      [req.empleado.sub]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getUrlDescarga(req, res) {
  try {
    const { rows: [recibo] } = await db.query(
      'SELECT id, url_archivo FROM recibos WHERE id = $1 AND empleado_id = $2',
      [req.params.id, req.empleado.sub]
    );
    if (!recibo) return res.status(404).json({ error: 'Recibo no encontrado.' });
    const supabaseUrl = process.env.SUPABASE_URL;
  const ruta = recibo.url_archivo.startsWith('recibos/') ? recibo.url_archivo : `recibos/${recibo.url_archivo}`;
const url = `${supabaseUrl}/storage/v1/object/public/${ruta}`;

    return res.json({ url, expiraEn: new Date(Date.now() + 5 * 60 * 1000).toISOString() });
  } catch (err) {
    return res.status(500).json({ error: 'Error generando enlace de descarga.' });
  }
}
export async function firmarRecibo(req, res) {
  try {
    const ip = req.headers['x-forwarded-for'] || req.ip || 'desconocida';
    const { rows: [recibo] } = await db.query(
      'SELECT id, firmado_en FROM recibos WHERE id = $1 AND empleado_id = $2',
      [req.params.id, req.empleado.sub]
    );
    if (!recibo) return res.status(404).json({ error: 'Recibo no encontrado.' });
    if (recibo.firmado_en) return res.status(400).json({ error: 'El recibo ya fue firmado.' });
    await db.query(
      'UPDATE recibos SET firmado_en = NOW(), ip_firma = $1 WHERE id = $2',
      [ip, req.params.id]
    );
    return res.json({ mensaje: 'Recibo confirmado correctamente.', firmado_en: new Date() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}