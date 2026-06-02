import { db } from '../db/client.js';

export async function getSaldo(req, res) {
  try {
    const { rows } = await db.query(
      'SELECT saldo, periodo, ultima_actualizacion FROM cuenta_corriente WHERE empleado_id = $1',
      [req.empleado.sub]
    );
    if (!rows.length) return res.json({ saldo: 0, periodo: null, mensaje: 'Sin datos de cuenta corriente' });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getMovimientos(req, res) {
  try {
    const { rows } = await db.query(
      'SELECT saldo, periodo, ultima_actualizacion FROM cuenta_corriente WHERE empleado_id = $1',
      [req.empleado.sub]
    );
    if (!rows.length) return res.json({ movimientos: [], saldo: 0 });
    return res.json({ movimientos: [], saldo: rows[0].saldo, periodo: rows[0].periodo });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function forzarSync(req, res) {
  return res.json({ mensaje: 'Sincronización no disponible en esta versión.' });
}