import { sequelize } from '../src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ejecutarMigracionCompleta() {
  try {
    console.log('🔄 Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('✅ Conexión establecida\n');

    // PASO 1: Ejecutar migración base de camionetas
    console.log('📋 PASO 1: Ejecutando migración de equipos → camionetas...');
    const migration1Path = path.join(__dirname, '..', 'migrations', '011-migrar-equipos-a-camionetas.sql');
    const migration1SQL = fs.readFileSync(migration1Path, 'utf8');

    await sequelize.query(migration1SQL);
    console.log('✅ Tabla camionetas creada exitosamente\n');

    // PASO 2: Agregar campo camioneta_id a movimientos
    console.log('📋 PASO 2: Agregando campo camioneta_id a movimientos...');
    const migration2Path = path.join(__dirname, '..', 'migrations', 'add_camioneta_id_to_movimientos.sql');
    const migration2SQL = fs.readFileSync(migration2Path, 'utf8');

    await sequelize.query(migration2SQL);
    console.log('✅ Campo camioneta_id agregado exitosamente\n');

    console.log('🎉 Migración completa ejecutada exitosamente');
    console.log('\n✅ Sistema de camionetas implementado:');
    console.log('   - Tabla camionetas creada (antes equipos)');
    console.log('   - Tabla stock_minimo_camioneta creada');
    console.log('   - Campo camioneta_id agregado a movimientos');
    console.log('   - Referencias y constraints actualizados\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al ejecutar la migración:', error);
    console.error('\nDetalles:', error.message);
    process.exit(1);
  }
}

ejecutarMigracionCompleta();
