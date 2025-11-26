/**
 * Script para ejecutar la migración del sistema de herramientas de renta
 * Uso: node scripts/run-herramientas-renta-migration.js
 */

import dotenv from 'dotenv';
import { sequelize } from '../src/config/database.js';
import migration from '../migrations/009-crear-sistema-herramientas-renta.js';

// Cargar variables de entorno
dotenv.config();

const runMigration = async () => {
    try {
        console.log('🚀 Iniciando migración del sistema de herramientas de renta...\n');

        // Verificar conexión a la base de datos
        await sequelize.authenticate();
        console.log('✅ Conexión a la base de datos establecida\n');

        // Ejecutar migración
        await migration();

        console.log('\n✨ Migración completada exitosamente!');
        console.log('\n📋 Se crearon las siguientes tablas:');
        console.log('   - tipos_herramienta_renta');
        console.log('   - unidades_herramienta_renta');
        console.log('   - historial_asignaciones_herramienta');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error al ejecutar la migración:', error);
        process.exit(1);
    }
};

runMigration();
