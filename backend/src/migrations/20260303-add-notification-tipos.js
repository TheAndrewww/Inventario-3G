import { sequelize } from '../config/database.js';

/**
 * Migración: Agregar tipos faltantes al enum de notificaciones
 */
export const up = async () => {
    const nuevos = [
        'solicitud_cancelada',
        'solicitud_creada',
        'orden_creada',
        'orden_enviada',
        'orden_recibida',
        'orden_anulada',
        'pedido_creado',
        'orden_completada_manual'
    ];

    for (const tipo of nuevos) {
        try {
            await sequelize.query(`ALTER TYPE "enum_notificaciones_tipo" ADD VALUE IF NOT EXISTS '${tipo}'`);
            console.log(`  ✅ Tipo '${tipo}' agregado`);
        } catch (error) {
            // IF NOT EXISTS solo funciona en PG >= 9.3, pero si ya existe ignora
            if (error.message.includes('already exists')) {
                console.log(`  ℹ️ Tipo '${tipo}' ya existía`);
            } else {
                console.error(`  ❌ Error al agregar '${tipo}':`, error.message);
            }
        }
    }
};

export const down = async () => {
    console.log('⚠️ No se pueden eliminar valores de ENUM en PostgreSQL sin recrear el tipo');
};
