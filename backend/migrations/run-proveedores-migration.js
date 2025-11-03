/**
 * Script para ejecutar migraciones de proveedores y campos de artículos
 */
import { sequelize } from '../src/config/database.js';
import { up as upProveedores } from './004-crear-tabla-proveedores.js';
import { up as upArticulos } from './005-agregar-campos-articulos.js';

async function runMigrations() {
  try {
    console.log('🚀 Ejecutando migraciones de proveedores y artículos...\n');

    // Conectar a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos establecida\n');

    // Ejecutar migración 004 - Crear tabla proveedores
    console.log('📦 Ejecutando migración 004: Crear tabla proveedores...');
    await upProveedores(sequelize.getQueryInterface(), sequelize.Sequelize);
    console.log('✅ Migración 004 completada\n');

    // Ejecutar migración 005 - Agregar campos a artículos
    console.log('📦 Ejecutando migración 005: Agregar campos a artículos...');
    await upArticulos(sequelize.getQueryInterface(), sequelize.Sequelize);
    console.log('✅ Migración 005 completada\n');

    console.log('✅ Todas las migraciones ejecutadas exitosamente');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error al ejecutar migraciones:', error);
    process.exit(1);
  }
}

runMigrations();
