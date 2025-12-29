/**
 * Script para ejecutar la migración de actualización de estados
 * Ejecutar: node scripts/ejecutar-migracion-estados.js
 */

import { up } from '../migrations/20251229-actualizar-estados-herramientas.js';
import { sequelize } from '../src/config/database.js';

async function ejecutarMigracion() {
    console.log('='.repeat(60));
    console.log('📦 Iniciando migración de estados de herramientas');
    console.log('='.repeat(60));

    try {
        // Verificar conexión a la base de datos
        await sequelize.authenticate();
        console.log('✅ Conexión a base de datos establecida');

        // Ejecutar migración
        await up();

        console.log('='.repeat(60));
        console.log('✅ Migración completada exitosamente');
        console.log('='.repeat(60));

        process.exit(0);

    } catch (error) {
        console.error('='.repeat(60));
        console.error('❌ Error ejecutando migración:', error);
        console.error('='.repeat(60));
        process.exit(1);
    }
}

ejecutarMigracion();
