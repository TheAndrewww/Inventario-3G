import { sequelize } from '../src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ejecutarMigracion() {
  try {
    console.log('🔄 Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('✅ Conexión establecida');

    // Leer el archivo SQL
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add_camioneta_id_to_movimientos.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔄 Ejecutando migración: agregar camioneta_id a movimientos...');

    // Ejecutar la migración
    await sequelize.query(migrationSQL);

    console.log('✅ Migración ejecutada exitosamente');
    console.log('✅ Campo camioneta_id agregado a la tabla movimientos');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al ejecutar la migración:', error);
    process.exit(1);
  }
}

ejecutarMigracion();
