import { sequelize } from '../src/config/database.js';
import { up, down } from './007-crear-sistema-ordenes-compra.js';

const runMigration = async () => {
  try {
    console.log('🚀 Ejecutando migración de órdenes de compra...\n');

    await up(sequelize.getQueryInterface(), sequelize.Sequelize);

    console.log('\n✅ Migración completada exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error al ejecutar migración:', error);
    process.exit(1);
  }
};

runMigration();
