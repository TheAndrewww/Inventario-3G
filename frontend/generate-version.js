/**
 * Script para generar archivo version.json en cada build
 * Este archivo se usa para detectar cuando hay una nueva versión desplegada
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const version = {
  version: new Date().getTime(), // Timestamp único por build
  buildDate: new Date().toISOString(),
};

const publicDir = path.join(__dirname, 'public');

// Crear directorio public si no existe
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Escribir version.json
fs.writeFileSync(
  path.join(publicDir, 'version.json'),
  JSON.stringify(version, null, 2)
);

console.log('✅ version.json generado:', version);
