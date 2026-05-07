// Uso: node diagnose-miguel.mjs "NOMBRE DEL PROYECTO"
// Lista TODAS las carpetas en PRODUCCION (y subcarpetas MTO/GTIA) que contengan
// los primeros términos del nombre buscado, y el contenido directo de cada una.

import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRODUCCION_FOLDER_ID = '1CsvTpQCIYpgnYn9dJoj9HqGYO-nInsok';

const buscado = (process.argv[2] || 'MIGUEL ANGEL').toUpperCase();
const terminoPrincipal = buscado.split(/\s+/).slice(0, 2).join(' '); // primeras 2 palabras

const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'google-credentials.json'),
    scopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive.metadata.readonly'],
});
const drive = google.drive({ version: 'v3', auth: await auth.getClient() });

const lista = async (parentId) => (await drive.files.list({
    q: `'${parentId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType)',
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
})).data.files || [];

console.log(`\nBuscando carpetas que contengan: "${terminoPrincipal}"\n`);

const meses = await lista(PRODUCCION_FOLDER_ID);
const encontradas = [];

for (const mes of meses.filter(f => f.mimeType === 'application/vnd.google-apps.folder')) {
    const proyectos = await lista(mes.id);
    for (const p of proyectos.filter(f => f.mimeType === 'application/vnd.google-apps.folder')) {
        const nom = normalizar(p.name);
        if (nom.includes(normalizar(terminoPrincipal))) {
            encontradas.push({ mes: mes.name, sub: null, carpeta: p });
        }
        // También buscar en subcarpetas tipo MANTENIMIENTO/GARANTIA
        if (nom.includes('MANTENIMIENTO') || nom.includes('MTO') || nom.includes('GARANTIA') || nom.includes('GTIA')) {
            const internas = await lista(p.id);
            for (const i of internas.filter(f => f.mimeType === 'application/vnd.google-apps.folder')) {
                if (normalizar(i.name).includes(normalizar(terminoPrincipal))) {
                    encontradas.push({ mes: mes.name, sub: p.name, carpeta: i });
                }
            }
        }
    }
}

console.log(`=== CARPETAS QUE COINCIDEN (${encontradas.length}) ===\n`);
if (encontradas.length === 0) {
    console.log('⚠️ No se encontró ninguna carpeta con ese término.');
    console.log('   Si este proyecto debería tener producción, crea la carpeta en Drive.');
    process.exit(0);
}

for (const e of encontradas) {
    const loc = e.sub ? `${e.mes}/${e.sub}` : e.mes;
    console.log(`📁 "${e.carpeta.name}"  [id=${e.carpeta.id}]  en  ${loc}`);
    const contenido = await lista(e.carpeta.id);
    if (contenido.length === 0) {
        console.log('   (vacía)\n');
        continue;
    }
    for (const f of contenido) {
        const tipo = f.mimeType === 'application/vnd.google-apps.folder' ? 'DIR ' : (f.mimeType === 'application/pdf' ? 'PDF ' : 'FILE');
        console.log(`   - [${tipo}] "${f.name}"`);
    }
    console.log();
}
