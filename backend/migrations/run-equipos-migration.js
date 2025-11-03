import { sequelize } from '../src/config/database.js';
import migration from './006-agregar-sistema-equipos.js';

const runMigration = async () => {
    try {
        console.log('🔄 Conectando a la base de datos...');
        await sequelize.authenticate();
        console.log('✅ Conexión establecida');

        await migration();

        console.log('🎉 Todas las migraciones completadas');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error ejecutando migraciones:', error);
        process.exit(1);
    }
};

runMigration();
