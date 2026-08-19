import { google } from 'googleapis';
import zlib from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPREADSHEET_ID = '1UhcwJ81cJ9yzteuK329HH3QnuZ3uPjCQ5ncdzn6urwY';

// El export del libro pesa ~700 KB; se cachea para no bajarlo en cada refresh
// del dashboard (que consulta 3 meses cada minuto).
const TTL_CACHE_MS = 10 * 60 * 1000;
let cache = { data: null, ts: 0 };

/**
 * Autenticación con scope de Drive (el de Sheets no alcanza para exportar).
 */
const authenticateDrive = async () => {
  const scopes = ['https://www.googleapis.com/auth/drive.readonly'];
  const authConfig = process.env.GOOGLE_CREDENTIALS_JSON
    ? { credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON), scopes }
    : { keyFile: path.join(__dirname, '../../google-credentials.json'), scopes };

  const auth = new google.auth.GoogleAuth(authConfig);
  return google.drive({ version: 'v3', auth: await auth.getClient() });
};

/**
 * Lector mínimo de ZIP (los .xlsx son ZIP). Evita sumar una dependencia solo
 * para descomprimir un puñado de XML. Devuelve { nombreEntrada: Buffer }.
 */
const leerZip = (buffer) => {
  const archivos = {};

  // End of Central Directory: se busca su firma desde el final del archivo.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0 && i >= buffer.length - 66000; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error('XLSX inválido: no se encontró el directorio central');

  const totalEntradas = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  for (let n = 0; n < totalEntradas; n++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;

    const metodo = buffer.readUInt16LE(offset + 10);
    const tamComprimido = buffer.readUInt32LE(offset + 20);
    const lenNombre = buffer.readUInt16LE(offset + 28);
    const lenExtra = buffer.readUInt16LE(offset + 30);
    const lenComentario = buffer.readUInt16LE(offset + 32);
    const offsetLocal = buffer.readUInt32LE(offset + 42);
    const nombre = buffer.toString('utf8', offset + 46, offset + 46 + lenNombre);

    // El local header repite nombre/extra con longitudes propias
    const lenNombreLocal = buffer.readUInt16LE(offsetLocal + 26);
    const lenExtraLocal = buffer.readUInt16LE(offsetLocal + 28);
    const inicioDatos = offsetLocal + 30 + lenNombreLocal + lenExtraLocal;
    const datos = buffer.subarray(inicioDatos, inicioDatos + tamComprimido);

    try {
      archivos[nombre] = metodo === 0 ? datos : zlib.inflateRawSync(datos);
    } catch (e) {
      console.warn(`⚠️ No se pudo descomprimir ${nombre}: ${e.message}`);
    }

    offset += 46 + lenNombre + lenExtra + lenComentario;
  }

  return archivos;
};

/**
 * Las notas legacy que genera el export repiten el hilo con un preámbulo de
 * compatibilidad de Excel; solo interesa lo que va después de "Comment:".
 */
const limpiarPreambulo = (texto = '') => {
  const idx = texto.indexOf('Comment:');
  const limpio = idx !== -1 ? texto.slice(idx + 'Comment:'.length) : texto;
  return limpio.replace(/^\s*\[Threaded comment\][\s\S]*?\n/, '').trim();
};

const decodificarXml = (texto = '') => texto
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
  .replace(/&amp;/g, '&');

/**
 * Descarga el libro como XLSX y devuelve los comentarios anclados a celdas,
 * agrupados por pestaña:  { AGOSTO: { H30: { texto, fecha, resuelto } } }
 *
 * Motivo: la API de Drive sí lista los comentarios, pero los ancla a un id
 * interno opaco ("range":"623470778") que no se puede traducir a una celda.
 * El export a XLSX conserva la referencia real (ref="H30").
 */
export const obtenerComentariosPorHoja = async () => {
  if (cache.data && Date.now() - cache.ts < TTL_CACHE_MS) return cache.data;

  const drive = await authenticateDrive();
  const res = await drive.files.export(
    {
      fileId: SPREADSHEET_ID,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    { responseType: 'arraybuffer' }
  );

  const zip = leerZip(Buffer.from(res.data));
  const texto = (nombre) => (zip[nombre] ? zip[nombre].toString('utf8') : null);

  // 1) Pestaña → archivo de hoja (workbook.xml + sus rels)
  const workbook = texto('xl/workbook.xml') || '';
  const workbookRels = texto('xl/_rels/workbook.xml.rels') || '';

  const relObjetivo = {};
  for (const m of workbookRels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    relObjetivo[m[1]] = m[2].replace(/^\/?(xl\/)?/, '');
  }

  const hojaPorNombre = {};
  for (const m of workbook.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const destino = relObjetivo[m[2]];
    if (destino) hojaPorNombre[decodificarXml(m[1]).toUpperCase()] = `xl/${destino}`;
  }

  // 2) Hoja → sus archivos de comentarios
  const resultado = {};
  for (const [nombreHoja, rutaHoja] of Object.entries(hojaPorNombre)) {
    const nombreArchivo = rutaHoja.split('/').pop();
    const rels = texto(`xl/worksheets/_rels/${nombreArchivo}.rels`) || '';
    const comentarios = {};

    // Los hilos mandan sobre las notas legacy: el mismo comentario aparece en
    // ambos archivos, pero el legacy trae un preámbulo de compatibilidad.
    const rutas = [...rels.matchAll(/Target="([^"]*(?:threadedComments\/threadedComment|comments)\d+\.xml)"/g)]
      .map(m => `xl/${m[1].replace(/^\.\.\//, '')}`)
      .sort((a, b) => (b.includes('threadedComment') ? 1 : 0) - (a.includes('threadedComment') ? 1 : 0));

    for (const ruta of rutas) {
      const xml = texto(ruta);
      if (!xml) continue;

      // Comentarios con hilo (los que permiten Responder)
      for (const c of xml.matchAll(/<x18tc:threadedComment\b([^>]*)>([\s\S]*?)<\/x18tc:threadedComment>/g)) {
        const atributos = c[1];
        const ref = atributos.match(/ref="([^"]+)"/)?.[1];
        const cuerpo = c[2].match(/<x18tc:text[^>]*>([\s\S]*?)<\/x18tc:text>/);
        if (!ref || !cuerpo) continue;
        // Un hilo puede traer respuestas: se queda la primera (el motivo original)
        if (comentarios[ref]) continue;
        comentarios[ref] = {
          texto: decodificarXml(cuerpo[1]).trim(),
          fecha: atributos.match(/dT="([^"]*)"/)?.[1] || null,
          resuelto: atributos.match(/done="([^"]*)"/)?.[1] === '1',
        };
      }

      // Notas simples (fallback, por si alguna falla se anotó así)
      for (const c of xml.matchAll(/<comment\b[^>]*ref="([^"]+)"[^>]*>([\s\S]*?)<\/comment>/g)) {
        const ref = c[1];
        if (comentarios[ref]) continue;
        const partes = [...c[2].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => decodificarXml(t[1]));
        const txt = limpiarPreambulo(partes.join('')).trim();
        if (txt) comentarios[ref] = { texto: txt, fecha: null, resuelto: false };
      }
    }

    if (Object.keys(comentarios).length) resultado[nombreHoja] = comentarios;
  }

  cache = { data: resultado, ts: Date.now() };
  console.log(`💬 Comentarios del calendario cargados (${Object.keys(resultado).length} pestañas)`);
  return resultado;
};

/** Índice de columna (0 = A) → letra. El calendario solo usa A:Z. */
export const letraColumna = (indice) => String.fromCharCode(65 + indice);

export default { obtenerComentariosPorHoja, letraColumna };
