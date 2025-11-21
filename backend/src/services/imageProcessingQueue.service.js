/**
 * Servicio de cola para procesamiento masivo de imágenes con Gemini
 */

import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';

/**
 * Agregar artículos a la cola de procesamiento
 * @param {Array<number>} articuloIds - IDs de artículos a procesar
 * @param {number} prioridad - Prioridad (mayor = primero)
 * @returns {Promise<Object>} Resultado de la operación
 */
export const agregarArticulosACola = async (articuloIds, prioridad = 0) => {
    const t = await sequelize.transaction();

    try {
        const agregados = [];
        const omitidos = [];

        for (const articuloId of articuloIds) {
            // Verificar que el artículo existe y tiene imagen
            const articuloResult = await sequelize.query(
                'SELECT id, nombre, descripcion, unidad, imagen_url FROM articulos WHERE id = $1 AND activo = true',
                {
                    bind: [articuloId],
                    type: QueryTypes.SELECT,
                    transaction: t
                }
            );

            if (articuloResult.length === 0) {
                omitidos.push({ articuloId, razon: 'Artículo no encontrado o inactivo' });
                continue;
            }

            const articulo = articuloResult[0];

            if (!articulo.imagen_url) {
                omitidos.push({ articuloId, razon: 'Artículo no tiene imagen' });
                continue;
            }

            // Verificar si ya está en la cola (pending o processing)
            const enColaResult = await sequelize.query(
                `SELECT id FROM image_processing_queue
                 WHERE articulo_id = $1 AND estado IN ('pending', 'processing')`,
                {
                    bind: [articuloId],
                    type: QueryTypes.SELECT,
                    transaction: t
                }
            );

            if (enColaResult.length > 0) {
                omitidos.push({ articuloId, razon: 'Ya está en la cola de procesamiento' });
                continue;
            }

            // Agregar a la cola
            const result = await sequelize.query(
                `INSERT INTO image_processing_queue
                 (articulo_id, estado, prioridad, imagen_url_original, articulo_nombre, articulo_descripcion, articulo_unidad)
                 VALUES ($1, 'pending', $2, $3, $4, $5, $6)
                 RETURNING id`,
                {
                    bind: [articuloId, prioridad, articulo.imagen_url, articulo.nombre, articulo.descripcion, articulo.unidad],
                    type: QueryTypes.INSERT,
                    transaction: t
                }
            );

            agregados.push({ articuloId, queueId: result[0][0].id });
        }

        await t.commit();

        return {
            success: true,
            agregados: agregados.length,
            omitidos: omitidos.length,
            detalles: { agregados, omitidos }
        };

    } catch (error) {
        await t.rollback();
        throw error;
    }
};

/**
 * Obtener estado actual de la cola
 * @returns {Promise<Object>} Estado de la cola
 */
export const obtenerEstadoCola = async () => {
    const result = await sequelize.query(`
        SELECT
            COUNT(*) FILTER (WHERE estado = 'pending') as pendientes,
            COUNT(*) FILTER (WHERE estado = 'processing') as procesando,
            COUNT(*) FILTER (WHERE estado = 'completed') as completados,
            COUNT(*) FILTER (WHERE estado = 'failed') as fallidos,
            COUNT(*) as total
        FROM image_processing_queue
    `, { type: QueryTypes.SELECT });

    const stats = result[0];

    // Obtener artículo actual en procesamiento
    const currentResult = await sequelize.query(`
        SELECT
            q.id,
            q.articulo_id,
            q.articulo_nombre,
            q.estado,
            q.started_at,
            q.intentos,
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - q.started_at)) as segundos_procesando
        FROM image_processing_queue q
        WHERE q.estado = 'processing'
        ORDER BY q.started_at ASC
        LIMIT 1
    `, { type: QueryTypes.SELECT });

    return {
        stats: {
            pendientes: parseInt(stats.pendientes),
            procesando: parseInt(stats.procesando),
            completados: parseInt(stats.completados),
            fallidos: parseInt(stats.fallidos),
            total: parseInt(stats.total)
        },
        articuloActual: currentResult[0] || null
    };
};

/**
 * Obtener siguiente artículo para procesar
 * @returns {Promise<Object|null>} Artículo a procesar o null
 */
export const obtenerSiguienteArticulo = async () => {
    const t = await sequelize.transaction();

    try {
        // Obtener siguiente artículo pendiente (ordenado por prioridad)
        const result = await sequelize.query(`
            SELECT
                id,
                articulo_id,
                imagen_url_original,
                articulo_nombre,
                articulo_descripcion,
                articulo_unidad,
                intentos,
                max_intentos
            FROM image_processing_queue
            WHERE estado = 'pending' AND intentos < max_intentos
            ORDER BY prioridad DESC, created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        `, {
            type: QueryTypes.SELECT,
            transaction: t
        });

        if (result.length === 0) {
            await t.commit();
            return null;
        }

        const item = result[0];

        // Marcar como procesando
        await sequelize.query(
            `UPDATE image_processing_queue
             SET estado = 'processing', started_at = CURRENT_TIMESTAMP, intentos = intentos + 1
             WHERE id = $1`,
            {
                bind: [item.id],
                type: QueryTypes.UPDATE,
                transaction: t
            }
        );

        await t.commit();

        return item;

    } catch (error) {
        await t.rollback();
        throw error;
    }
};

/**
 * Marcar artículo como completado
 * @param {number} queueId - ID en la cola
 * @param {string} imagenUrlProcesada - URL de la imagen procesada
 */
export const marcarComoCompletado = async (queueId, imagenUrlProcesada) => {
    await sequelize.query(
        `UPDATE image_processing_queue
         SET estado = 'completed', imagen_url_procesada = $1, completed_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        {
            bind: [imagenUrlProcesada, queueId],
            type: QueryTypes.UPDATE
        }
    );
};

/**
 * Marcar artículo como fallido
 * @param {number} queueId - ID en la cola
 * @param {Error} error - Error ocurrido
 */
export const marcarComoFallido = async (queueId, error) => {
    await sequelize.query(
        `UPDATE image_processing_queue
         SET estado = 'failed', error_message = $1, error_stack = $2, completed_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        {
            bind: [error.message, error.stack, queueId],
            type: QueryTypes.UPDATE
        }
    );
};

/**
 * Reintentar artículo fallido o pendiente
 * @param {number} queueId - ID en la cola
 */
export const reintentarArticulo = async (queueId) => {
    await sequelize.query(
        `UPDATE image_processing_queue
         SET estado = 'pending', error_message = NULL, error_stack = NULL, started_at = NULL
         WHERE id = $1`,
        {
            bind: [queueId],
            type: QueryTypes.UPDATE
        }
    );
};

/**
 * Limpiar cola (eliminar completados y fallidos antiguos)
 * @param {number} diasAntiguedad - Días de antigüedad para eliminar
 */
export const limpiarCola = async (diasAntiguedad = 7) => {
    const result = await sequelize.query(
        `DELETE FROM image_processing_queue
         WHERE estado IN ('completed', 'failed')
         AND completed_at < CURRENT_TIMESTAMP - INTERVAL '${diasAntiguedad} days'
         RETURNING id`,
        { type: QueryTypes.DELETE }
    );

    return result.length;
};

/**
 * Obtener historial de la cola con paginación
 * @param {number} limit - Límite de resultados
 * @param {number} offset - Offset para paginación
 * @returns {Promise<Array>} Historial de la cola
 */
export const obtenerHistorialCola = async (limit = 50, offset = 0) => {
    const result = await sequelize.query(
        `SELECT
            q.id,
            q.articulo_id,
            q.articulo_nombre,
            q.estado,
            q.prioridad,
            q.intentos,
            q.max_intentos,
            q.error_message,
            q.created_at,
            q.started_at,
            q.completed_at,
            EXTRACT(EPOCH FROM (COALESCE(q.completed_at, CURRENT_TIMESTAMP) - q.started_at)) as duracion_segundos
        FROM image_processing_queue q
        ORDER BY q.created_at DESC
        LIMIT $1 OFFSET $2`,
        {
            bind: [limit, offset],
            type: QueryTypes.SELECT
        }
    );

    return result;
};

export default {
    agregarArticulosACola,
    obtenerEstadoCola,
    obtenerSiguienteArticulo,
    marcarComoCompletado,
    marcarComoFallido,
    reintentarArticulo,
    limpiarCola,
    obtenerHistorialCola
};
