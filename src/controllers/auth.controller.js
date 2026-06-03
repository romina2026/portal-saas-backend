// src/controllers/auth.controller.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/client.js';

const JWT_EXPIRES_IN = '8h';
const MAX_INTENTOS = 5;

function generarJWT(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// POST /auth/login — empleado
export async function login(req, res) {
  const { username, password, empresa_id } = req.body;
  if (!username || !password || !empresa_id) {
    return res.status(400).json({ error: 'Usuario, contraseña y empresa son requeridos.' });
  }
  try {
    const { rows: [cred] } = await db.query(
      `SELECT c.id, c.empleado_id, c.password_hash, c.debe_cambiar_pass,
              c.es_admin_empresa, c.intentos_fallidos, c.bloqueado_hasta,
              e.nombre, e.apellido, e.cargo, e.empresa_id
       FROM credenciales c
       JOIN empleados e ON e.id = c.empleado_id
       WHERE c.username = $1 AND c.empresa_id = $2 AND e.activo = true`,
      [username.trim(), empresa_id]
    );

    if (!cred) return res.status(401).json({ error: 'Credenciales incorrectas.' });

    if (cred.bloqueado_hasta && new Date() < new Date(cred.bloqueado_hasta)) {
      const min = Math.ceil((new Date(cred.bloqueado_hasta) - new Date()) / 60000);
      return res.status(429).json({ error: `Cuenta bloqueada. Intentá en ${min} minutos.` });
    }

    const ok = await bcrypt.compare(password, cred.password_hash);
    if (!ok) {
      const intentos = (cred.intentos_fallidos || 0) + 1;
      const bloquear = intentos >= MAX_INTENTOS;
      await db.query(
        `UPDATE credenciales SET intentos_fallidos=$1, bloqueado_hasta=$2 WHERE id=$3`,
        [bloquear ? 0 : intentos, bloquear ? new Date(Date.now() + 15 * 60000) : null, cred.id]
      );
      return res.status(401).json({ error: bloquear ? 'Demasiados intentos. Cuenta bloqueada 15 min.' : 'Credenciales incorrectas.' });
    }

    await db.query(
      `UPDATE credenciales SET intentos_fallidos=0, bloqueado_hasta=NULL WHERE id=$1`,
      [cred.id]
    );

    const accessToken = generarJWT({
      sub: cred.empleado_id,
      empresa_id: cred.empresa_id,
      nombre: `${cred.nombre} ${cred.apellido}`,
      es_admin: cred.es_admin_empresa,
      es_super_admin: false,
    });

    return res.json({
      accessToken,
      debeCambiarPass: cred.debe_cambiar_pass,
      empleado: {
        id: cred.empleado_id,
        nombre: cred.nombre,
        apellido: cred.apellido,
        cargo: cred.cargo,
        es_admin: cred.es_admin_empresa,
        empresa_id: cred.empresa_id,
      },
    });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ error: 'Error interno.' });
  }
}

// POST /auth/login-super — super admin
export async function loginSuperAdmin(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos.' });
  }
  try {
    const { rows: [sa] } = await db.query(
      `SELECT id, email, password_hash, nombre FROM super_admins WHERE email = $1`,
      [email.trim().toLowerCase()]
    );
    if (!sa) return res.status(401).json({ error: 'Credenciales incorrectas.' });

    const ok = await bcrypt.compare(password, sa.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas.' });

    const accessToken = generarJWT({
      sub: sa.id,
      email: sa.email,
      nombre: sa.nombre,
      es_super_admin: true,
    });

    return res.json({ accessToken, superAdmin: { id: sa.id, email: sa.email, nombre: sa.nombre } });
  } catch (err) {
    console.error('[auth/login-super]', err);
    return res.status(500).json({ error: 'Error interno.' });
  }
}

// POST /auth/cambiar-password
export async function cambiarPassword(req, res) {
  const { passwordActual, passwordNueva } = req.body;
  if (!passwordActual || !passwordNueva) return res.status(400).json({ error: 'Ambas contraseñas requeridas.' });
  if (passwordNueva.length < 6) return res.status(400).json({ error: 'Mínimo 6 caracteres.' });
  try {
    const { rows: [c] } = await db.query(
      `SELECT password_hash FROM credenciales WHERE empleado_id=$1`, [req.empleado.sub]
    );
    if (!await bcrypt.compare(passwordActual, c.password_hash)) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta.' });
    }
    await db.query(
      `UPDATE credenciales SET password_hash=$1, debe_cambiar_pass=false WHERE empleado_id=$2`,
      [await bcrypt.hash(passwordNueva, 10), req.empleado.sub]
    );
    return res.json({ mensaje: 'Contraseña actualizada.' });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno.' });
  }
}
