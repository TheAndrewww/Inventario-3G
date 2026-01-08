/**
 * Script para ejecutar la migración de condicion/estatus
 * Ejecutar: node scripts/run-condicion-estatus-migration.js
 */

import { sequelize } from '../src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ejecutarMigracion = async () => {
    try {
        console.log('🔄 Iniciando migración de condicion/estatus...');

        // Verificar conexión
        await sequelize.authenticate();
        console.log('✅ Conexión a la base de datos establecida');

        // Leer archivo de migración
        const migrationPath = path.join(__dirname, '../migrations/add_condicion_estatus_migration.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📝 Ejecutando migración SQL...');

        // Ejecutar migración
        await sequelize.query(migrationSQL);

        console.log('✅ Migración completada exitosamente');

        // Verificar resultados
        const [stats] = await sequelize.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN condicion IS NOT NULL THEN 1 END) as con_condicion,
                COUNT(CASE WHEN estatus IS NOT NULL THEN 1 END) as con_estatus
            FROM unidades_herramienta_renta
        `);

        console.log('\n📊 Estadísticas de migración:');
        console.log(`   Total de unidades: ${stats[0].total}`);
        console.log(`   Con condición: ${stats[0].con_condicion}`);
        console.log(`   Con estatus: ${stats[0].con_estatus}`);

        process.exit(0);

    } catch (error) {
        console.error('❌ Error en la migración:', error);
        process.exit(1);
    }
};

ejecutarMigracion();
