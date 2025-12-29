import { Sequelize } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log,
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  }
});

async function runMigration() {
  try {
    console.log('🚀 Iniciando migración de mejoras al sistema de herramientas...\n');

    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos establecida\n');

    const migration = await import('./010-mejorar-sistema-herramientas-renta.js');

    await migration.default.up(sequelize.getQueryInterface(), Sequelize);

    console.log('\n✅ Migración completada exitosamente');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en la migración:', error);
    await sequelize.close();
    process.exit(1);
  }
}

runMigration();
