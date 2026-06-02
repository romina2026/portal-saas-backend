import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from './src/db/client.js';

const pass = 'admin123';
const hash = await bcrypt.hash(pass, 10);

await db.query(
  'UPDATE usuarios_garantias SET hash_password=$1 WHERE usuario=$2',
  [hash, 'admin']
);

const { rows: [u] } = await db.query(
  'SELECT hash_password FROM usuarios_garantias WHERE usuario=$1',
  ['admin']
);

const ok = await bcrypt.compare(pass, u.hash_password);
console.log(ok ? 'LOGIN OK - podés entrar con admin123' : 'ERROR - el hash no matchea');
process.exit(0);