/**
 * Migración: Actualizar constraint de estados de unidades de herramientas
 * Agrega los nuevos estados: buen_estado, estado_regular, mal_estado
 * Mantiene compatibilidad con estados antiguos
 */

import { sequelize } from '../src/config/database.js';

export async function up() {
    console.log('🔄 Actualizando constraint de estados de unidades de herramientas...');

    try {
        // Eliminar el constraint antiguo
        await sequelize.query(`
            ALTER TABLE unidades_herramienta_renta
            DROP CONSTRAINT IF EXISTS unidades_herramienta_renta_estado_check;
        `);

        console.log('✅ Constraint antiguo eliminado');

        // Crear el nuevo constraint con todos los estados (antiguos + nuevos)
        await sequelize.query(`
            ALTER TABLE unidades_herramienta_renta
            ADD CONSTRAINT unidades_herramienta_renta_estado_check
            CHECK (estado IN (
                'buen_estado',
                'estado_regular',
                'mal_estado',
                'asignada',
                'disponible',
                'en_reparacion',
                'perdida',
                'baja',
                'en_transito',
                'pendiente_devolucion'
            ));
        `);

        console.log('✅ Nuevo constraint creado con estados actualizados');

        // Actualizar unidades con estado 'disponible' a 'buen_estado' (opcional)
        const [updated] = await sequelize.query(`
            UPDATE unidades_herramienta_renta
            SET estado = 'buen_estado'
            WHERE estado = 'disponible' AND activo = true;
        `);

        console.log(`✅ Actualizadas ${updated.rowCount || 0} unidades de 'disponible' a 'buen_estado'`);

        console.log('✅ Migración completada exitosamente');

    } catch (error) {
        console.error('❌ Error en migración:', error.message);
        throw error;
    }
}

export async function down() {
    console.log('🔄 Revirtiendo constraint de estados...');

    try {
        // Eliminar el constraint nuevo
        await sequelize.query(`
            ALTER TABLE unidades_herramienta_renta
            DROP CONSTRAINT IF EXISTS unidades_herramienta_renta_estado_check;
        `);

        // Restaurar el constraint antiguo (solo estados originales)
        await sequelize.query(`
            ALTER TABLE unidades_herramienta_renta
            ADD CONSTRAINT unidades_herramienta_renta_estado_check
            CHECK (estado IN (
                'disponible',
                'asignada',
                'en_reparacion',
                'perdida',
                'baja',
                'en_transito',
                'pendiente_devolucion'
            ));
        `);

        // Revertir estados de 'buen_estado' a 'disponible'
        await sequelize.query(`
            UPDATE unidades_herramienta_renta
            SET estado = 'disponible'
            WHERE estado IN ('buen_estado', 'estado_regular', 'mal_estado');
        `);

        console.log('✅ Constraint revertido');

    } catch (error) {
        console.error('❌ Error revirtiendo migración:', error.message);
        throw error;
    }
}
