import { readFileSync, existsSync } from 'fs';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';
import { db } from './src/db/client.js';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BUCKET = process.env.STORAGE_BUCKET || 'recibos';
const PAGINAS_POR_EMPLEADO = 2;
async function extraerPaginas(pdfBuffer, inicio, cantidad) {
  const pdfOrigen = await PDFDocument.load(pdfBuffer);
  const pdfNuevo = await PDFDocument.create();
  const indices = Array.from({ length: cantidad }, (_, i) => inicio + i);
  const paginas = await pdfNuevo.copyPages(pdfOrigen, indices);
  paginas.forEach(p => pdfNuevo.addPage(p));
  return await pdfNuevo.save();
}
async function main() {
  const archivoPDF = process.argv[2];
  const periodo = process.argv[3];
  if (!archivoPDF || !periodo) { console.log('Uso: node procesar-recibos.js <ruta-pdf> <periodo>'); process.exit(1); }
  if (!existsSync(archivoPDF)) { console.log('Error: No se encontro el archivo'); process.exit(1); }
  console.log('\nLeyendo PDF...');
  const pdfBuffer = readFileSync(archivoPDF);
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const totalPags = pdfDoc.getPageCount();
  console.log('Total paginas: ' + totalPags);
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { rows: empleados } = await db.query('SELECT id, legajo, nombre_completo FROM empleados WHERE activo = true');
  const mapa = {};
  empleados.forEach(e => { mapa[e.legajo] = e; mapa[e.legajo.replace(/^0+/,'')||'0'] = e; });
  let procesados = 0, saltados = 0, errores = 0;
for (let i = 0; i < totalPags; i += PAGINAS_POR_EMPLEADO) {
    const task = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
    const pdf = await task.promise;
    const page = await pdf.getPage(i + 1);
    const content = await page.getTextContent();
    const texto = content.items.map(x => x.str).join(' ');
    const match = texto.match(/Legajo\s*(\d+)/i);
    if (!match) { console.log('Pagina ' + (i+1) + ': sin legajo'); saltados++; continue; }
    const legajo = match[1];
    const emp = mapa[legajo] || mapa[legajo.padStart(8,'0')] || mapa[legajo.replace(/^0+/,'')||'0'];
    if (!emp) { console.log('Legajo ' + legajo + ': no encontrado en portal'); saltados++; continue; }
    console.log('Procesando ' + emp.nombre_completo + '...');
try {
      const pdfEmp = await extraerPaginas(pdfBuffer, i, PAGINAS_POR_EMPLEADO);
      const ruta = 'recibos/' + emp.id + '/' + periodo + '.pdf';
      const { error } = await supabase.storage.from(BUCKET).upload(ruta, pdfEmp, { contentType: 'application/pdf', upsert: true });
      if (error) { console.log('  ERROR: ' + error.message); errores++; continue; }
      await db.query('INSERT INTO recibos (empleado_id, periodo, url_archivo, pagina_inicio, pagina_fin) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (empleado_id, periodo) DO UPDATE SET url_archivo=$3, pagina_inicio=$4, pagina_fin=$5', [emp.id, periodo, ruta, i+1, i+PAGINAS_POR_EMPLEADO]);
      console.log('  OK'); procesados++;
    } catch(e) { console.log('  ERROR: ' + e.message); errores++; }
  }
  console.log('\nProcesados: ' + procesados + ' | Saltados: ' + saltados + ' | Errores: ' + errores);
  await db.end();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });