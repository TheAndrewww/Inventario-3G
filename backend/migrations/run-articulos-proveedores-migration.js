/**
 * Script para ejecutar migración de múltiples proveedores
 */
import { sequelize } from '../src/config/database.js';
import { up as upArticulosProveedores } from './006-crear-articulos-proveedores.js';

async function runMigration() {
  try {
    console.log('🚀 Ejecutando migración de artículos-proveedores...\n');

    // Conectar a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos establecida\n');

    // Ejecutar migración 006
    console.log('📦 Ejecutando migración 006: Crear tabla articulos_proveedores...');
    await upArticulosProveedores(sequelize.getQueryInterface(), sequelize.Sequelize);
    console.log('✅ Migración 006 completada\n');

    console.log('✅ Migración ejecutada exitosamente');
    console.log('\n📌 Nota: El campo proveedor_id en la tabla articulos se mantiene');
    console.log('   por compatibilidad, pero ahora la relación principal está en articulos_proveedores\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error al ejecutar migración:', error);
    process.exit(1);
  }
}

runMigration();
