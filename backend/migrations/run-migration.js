/**
 * Script para ejecutar migraciones manualmente
 */
import { sequelize } from '../src/config/database.js';
import { up } from './002-actualizar-roles-usuario.js';

async function runMigration() {
  try {
    console.log('🚀 Ejecutando migración de roles de usuario...\n');

    // Conectar a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos establecida\n');

    // Ejecutar migración
    await up(sequelize.getQueryInterface(), sequelize.Sequelize);

    console.log('\n✅ Migración ejecutada exitosamente');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error al ejecutar migración:', error);
    process.exit(1);
  }
}

runMigration();
