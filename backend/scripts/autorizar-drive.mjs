/**
 * Autorizar Google Drive para SUBIR tickets (una sola vez).
 *
 * ¿Por qué hace falta?
 * La carpeta PRODUCCION está en "Mi unidad" de una cuenta Gmail personal.
 * Las cuentas de servicio NO tienen cuota de almacenamiento en Google, así que
 * pueden leer la carpeta pero al crear un archivo devuelven:
 *   403 storageQuotaExceeded - "Service Accounts do not have storage quota"
 * La solución es subir el archivo con OAuth de la cuenta dueña de la carpeta
 * (vircjr.3g@gmail.com), para que el ticket consuma la cuota de esa cuenta.
 *
 * USO:
 *   1. En Google Cloud Console (proyecto calendario-3g):
 *      - Pantalla de consentimiento OAuth: tipo "Externo", agregar la cuenta
 *        dueña de la carpeta como usuario de prueba y luego PUBLICAR la app
 *        ("En producción"). Si se queda en "Prueba", el permiso caduca cada
 *        7 días y hay que repetir esto.
 *      - Credenciales > Crear credenciales > ID de cliente OAuth >
 *        Tipo "Aplicación de escritorio". Copiar Client ID y Client Secret.
 *   2. cd backend && node scripts/autorizar-drive.mjs
 *   3. Abrir el link, iniciar sesión con la cuenta DUEÑA de la carpeta.
 *   4. El script guarda google-oauth-token.json e imprime las variables
 *      para producción (Railway).
 */
import { google } from 'googleapis';
import http from 'http';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = path.join(__dirname, '../google-oauth-token.json');
const PUERTO = 5599;
const REDIRECT_URI = `http://localhost:${PUERTO}`;
const SCOPES = ['https://www.googleapis.com/auth/drive'];

const preguntar = (texto) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(texto, (respuesta) => {
    rl.close();
    resolve(respuesta.trim());
  });
});

const esperarCodigo = () => new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, REDIRECT_URI);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(code
      ? '<h2>Listo. Ya puedes cerrar esta pestaña y volver a la terminal.</h2>'
      : `<h2>Error de autorizacion: ${error || 'desconocido'}</h2>`);

    server.close();
    code ? resolve(code) : reject(new Error(error || 'No se recibió el código'));
  });

  server.on('error', reject);
  server.listen(PUERTO);
});

const main = async () => {
  console.log('\n=== Autorizar Google Drive para subir tickets ===\n');

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || await preguntar('Client ID: ');
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || await preguntar('Client Secret: ');

  if (!clientId || !clientSecret) {
    console.error('❌ Faltan Client ID / Client Secret.');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',          // fuerza que Google devuelva refresh_token
    scope: SCOPES
  });

  console.log('\n1) Abre este link en el navegador:\n');
  console.log(authUrl);
  console.log('\n2) Inicia sesión con la cuenta DUEÑA de la carpeta PRODUCCION.');
  console.log('   (Si sale "Google no ha verificado esta app": Configuración avanzada > Ir a ...)\n');
  console.log(`Esperando la respuesta en ${REDIRECT_URI} ...\n`);

  const code = await esperarCodigo();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    console.error('❌ Google no devolvió refresh_token. Revoca el acceso en');
    console.error('   https://myaccount.google.com/permissions y vuelve a correr el script.');
    process.exit(1);
  }

  fs.writeFileSync(TOKEN_PATH, JSON.stringify({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: tokens.refresh_token
  }, null, 2));

  // Verificar contra Drive que la cuenta autorizada es la correcta
  oauth2Client.setCredentials(tokens);
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const about = await drive.about.get({ fields: 'user(emailAddress)' });

  console.log(`\n✅ Autorizado como: ${about.data.user.emailAddress}`);
  console.log(`✅ Token guardado en: ${TOKEN_PATH}\n`);
  console.log('Para producción (Railway), agrega estas variables:\n');
  console.log(`GOOGLE_OAUTH_CLIENT_ID=${clientId}`);
  console.log(`GOOGLE_OAUTH_CLIENT_SECRET=${clientSecret}`);
  console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`);
};

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
