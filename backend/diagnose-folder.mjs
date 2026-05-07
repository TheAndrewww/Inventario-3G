// Uso: node diagnose-folder.mjs <FOLDER_ID>
// Lista TODO lo que hay en esa carpeta con su mimeType, para entender
// por qué el clasificador no encuentra PDFs.

import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const folderId = process.argv[2];
if (!folderId) {
    console.error('Uso: node diagnose-folder.mjs <FOLDER_ID>');
    process.exit(1);
}

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'google-credentials.json'),
    scopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive.metadata.readonly'],
});
const drive = google.drive({ version: 'v3', auth: await auth.getClient() });

const meta = await drive.files.get({
    fileId: folderId,
    fields: 'id, name, mimeType, parents',
    supportsAllDrives: true,
});
console.log(`\n📁 CARPETA: "${meta.data.name}"  [${meta.data.id}]\n`);

const contenido = (await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, size, shortcutDetails)',
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
})).data.files || [];

console.log(`Total items: ${contenido.length}\n`);
for (const f of contenido) {
    let tipo = f.mimeType;
    if (f.mimeType === 'application/vnd.google-apps.shortcut') {
        tipo = `SHORTCUT → ${f.shortcutDetails?.targetMimeType || '?'}`;
    }
    console.log(`- "${f.name}"`);
    console.log(`    mime: ${tipo}`);
    console.log(`    id:   ${f.id}`);
}

// Contar por tipo
const pdfCount = contenido.filter(f => f.mimeType === 'application/pdf').length;
const shortcutCount = contenido.filter(f => f.mimeType === 'application/vnd.google-apps.shortcut').length;
console.log(`\n=== RESUMEN ===`);
console.log(`PDFs directos:  ${pdfCount}`);
console.log(`Shortcuts:      ${shortcutCount}`);
console.log(`Otros:          ${contenido.length - pdfCount - shortcutCount}`);
