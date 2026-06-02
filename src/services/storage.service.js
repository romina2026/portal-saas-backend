import { createClient } from '@supabase/supabase-js';

const BUCKET = process.env.STORAGE_BUCKET || 'recibos';
const SIGNED_URL_EXPIRY = 300;

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

export async function generarUrlFirmada(path) {
  const { data, error } = await getSupabase().storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY);
  if (error) throw new Error('Error generando URL: ' + error.message);
  return data.signedUrl;
}

export async function subirArchivo(path, buffer, contentType = 'application/pdf') {
  const { error } = await getSupabase().storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) throw new Error('Error subiendo archivo: ' + error.message);
  return path;
}

export async function eliminarArchivo(path) {
  const { error } = await getSupabase().storage
    .from(BUCKET)
    .remove([path]);
  if (error) throw new Error('Error eliminando archivo: ' + error.message);
}