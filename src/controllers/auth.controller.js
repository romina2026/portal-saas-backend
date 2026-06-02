// src/controllers/auth.controller.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/client.js';

const JWT_EXPIRES_IN     = '7d';
const REFRESH_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000;
const MAX_INTENTOS       = 5;

function generarJWT(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function parsearDispositivo(ua = '') {
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  if (ua.includes('Android'))  return 'Android';
  if (ua.includes('Windows'))  return 'Windows';
  if (ua.includes('Mac'))      return 'macOS';
  return ua.slice(0, 80) || 'Desconocido';
}

// POST /auth/login
export async function login(req, res) {
  const { legajo, password } = req.body;
  if (!legajo || !password) {
    return res.status(400).json({ error: 'Legajo y contraseña son requeridos.' });
  }
  try {
    const { rows: [emp] } = await db.query(
      `SELECT e.id, e.legajo, e.nombre_completo, e.cargo, e.area,
              c.hash_password, c.debe_cambiar_pass,
              c.intentos_fallidos, c.bloqueado_hasta
       FROM empleados e
       JOIN credenciales c ON c.empleado_id = e.id
       WHERE e.legajo = $1 AND e.activo = true`,
      [legajo.trim()]
    );

    if (!emp) return res.status(401).json({ error: 'Credenciales incorrectas.' });

    if (emp.bloqueado_hasta && new Date() < new Date(emp.bloqueado_hasta)) {
      const min = Math.ceil((new Date(emp.bloqueado_hasta) - new Date()) / 60000);
      return res.status(429).json({ error: `Cuenta bloqueada. Intentá en ${min} minutos.` });
    }

    const ok = await bcrypt.compare(password, emp.hash_password);
    if (!ok) {
      const intentos = emp.intentos_fallidos + 1;
      const bloquear = intentos >= MAX_INTENTOS;
      await db.query(
        `UPDATE credenciales SET intentos_fallidos=$1, bloqueado_hasta=$2 WHERE empleado_id=$3`,
        [bloquear ? 0 : intentos, bloquear ? new Date(Date.now() + 15 * 60000) : null, emp.id]
      );
      return res.status(401).json({
        error: bloquear ? 'Demasiados intentos. Cuenta bloqueada 15 min.' : 'Credenciales incorrectas.',
      });
    }

    await db.query(
      `UPDATE credenciales SET intentos_fallidos=0, bloqueado_hasta=NULL, ultimo_acceso=NOW() WHERE empleado_id=$1`,
      [emp.id]
    );

    const accessToken  = generarJWT({ sub: emp.id, legajo: emp.legajo, nombre: emp.nombre_completo });
    const refreshToken = uuidv4() + '-' + uuidv4();

    await db.query(
      `INSERT INTO sesiones (empleado_id, refresh_token, dispositivo, ip_origen, expira_en)
       VALUES ($1, $2, $3, $4, $5)`,
      [emp.id, refreshToken, parsearDispositivo(req.headers['user-agent']), req.ip, new Date(Date.now() + REFRESH_EXPIRES_IN)]
    );

    return res.json({
      accessToken,
      refreshToken,
      debeCambiarPass: emp.debe_cambiar_pass,
      empleado: { id: emp.id, legajo: emp.legajo, nombreCompleto: emp.nombre_completo, cargo: emp.cargo, area: emp.area },
    });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ error: 'Error interno.' });
  }
}

// POST /auth/refresh
export async function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token requerido.' });
  try {
    const { rows: [s] } = await db.query(
      `SELECT s.id, s.empleado_id, s.expira_en, s.revocada,
              e.legajo, e.nombre_completo, e.activo
       FROM sesiones s JOIN empleados e ON e.id = s.empleado_id
       WHERE s.refresh_token = $1`,
      [refreshToken]
    );
    if (!s || s.revocada || !s.activo) return res.status(401).json({ error: 'Sesión inválida.' });
    if (new Date() > new Date(s.expira_en)) {
      await db.query(`UPDATE sesiones SET revocada=true WHERE id=$1`, [s.id]);
      return res.status(401).json({ error: 'Sesión expirada. Iniciá sesión nuevamente.' });
    }
    return res.json({ accessToken: generarJWT({ sub: s.empleado_id, legajo: s.legajo, nombre: s.nombre_completo }) });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno.' });
  }
}

// POST /auth/logout
export async function logout(req, res) {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await db.query(`UPDATE sesiones SET revocada=true WHERE refresh_token=$1`, [refreshToken]).catch(() => {});
  }
  return res.json({ mensaje: 'Sesión cerrada.' });
}

// POST /auth/cambiar-password
export async function cambiarPassword(req, res) {
  const { passwordActual, passwordNueva } = req.body;
  if (!passwordActual || !passwordNueva) return res.status(400).json({ error: 'Ambas contraseñas requeridas.' });
  if (passwordNueva.length < 8) return res.status(400).json({ error: 'Mínimo 8 caracteres.' });
  try {
    const { rows: [c] } = await db.query(
      `SELECT hash_password FROM credenciales WHERE empleado_id=$1`, [req.empleado.sub]
    );
    if (!await bcrypt.compare(passwordActual, c.hash_password)) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta.' });
    }
    await db.query(
      `UPDATE credenciales SET hash_password=$1, debe_cambiar_pass=false WHERE empleado_id=$2`,
      [await bcrypt.hash(passwordNueva, 10), req.empleado.sub]
    );
    return res.json({ mensaje: 'Contraseña actualizada.' });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno.' });
  }
}
