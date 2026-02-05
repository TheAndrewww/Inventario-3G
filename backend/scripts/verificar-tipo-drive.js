// Script para verificar tipo de carpeta en Drive
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRODUCCION_FOLDER_ID = '1CsvTpQCIYpgnYn9dJoj9HqGYO-nInsok';

async function verificarTipoCarpeta() {
    console.log('🔍 Verificando tipo de carpeta PRODUCCION...\n');

    try {
        // Autenticar
        const auth = new google.auth.GoogleAuth({
            keyFile: path.join(__dirname, '../google-credentials.json'),
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
        const client = await auth.getClient();
        const drive = google.drive({ version: 'v3', auth: client });

        // Obtener info de la carpeta
        const response = await drive.files.get({
            fileId: PRODUCCION_FOLDER_ID,
            fields: 'id, name, driveId, mimeType, owners, permissions',
            supportsAllDrives: true
        });

        const carpeta = response.data;

        console.log('📁 Información de la carpeta:');
        console.log(`   Nombre: ${carpeta.name}`);
        console.log(`   ID: ${carpeta.id}`);
        console.log(`   Tipo: ${carpeta.mimeType}`);

        if (carpeta.driveId) {
            console.log(`\n✅ ES UN SHARED DRIVE (Team Drive)`);
            console.log(`   Drive ID: ${carpeta.driveId}`);
            console.log('\n💡 El código debería funcionar. El problema puede ser otro.');
        } else {
            console.log(`\n⚠️  NO es un Shared Drive`);
            console.log('   Es una carpeta en "Mi unidad" de alguien.');
            console.log('\n💡 Opciones:');
            console.log('   1. Mover a un Shared Drive (recomendado)');
            console.log('   2. Configurar domain-wide delegation');
        }

        if (carpeta.owners) {
            console.log('\n👤 Dueño(s):');
            carpeta.owners.forEach(owner => {
                console.log(`   - ${owner.displayName} (${owner.emailAddress})`);
            });
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

verificarTipoCarpeta();
