/**
 * Worker para procesar la cola de imágenes con Gemini en background
 * Se ejecuta continuamente procesando artículos uno por uno
 */

import {
    obtenerSiguienteArticulo,
    marcarComoCompletado,
    marcarComoFallido,
    obtenerEstadoCola
} from '../services/imageProcessingQueue.service.js';
import { procesarImagenDesdeUrl, isNanoBananaEnabled } from '../services/nanoBanana.service.js';
import { uploadBufferToCloudinary, eliminarImagen } from '../config/cloudinary.js';
import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';

let isProcessing = false;
let shouldStop = false;

/**
 * Procesar un artículo de la cola
 */
async function procesarArticulo(item) {
    console.log(`\n🔄 [Cola] Procesando artículo ${item.articulo_id} - "${item.articulo_nombre}"`);
    console.log(`   📊 [Cola] Intento ${item.intentos + 1} de ${item.max_intentos || 3}`);

    try {
        // Procesar imagen con Gemini
        const processedBuffer = await procesarImagenDesdeUrl(item.imagen_url_original, {
            nombre: item.articulo_nombre,
            descripcion: item.articulo_descripcion,
            unidad: item.articulo_unidad
        });

        // Eliminar imagen anterior de Cloudinary (opcional)
        try {
            await eliminarImagen(item.imagen_url_original);
            console.log('   🗑️ [Cola] Imagen anterior eliminada');
        } catch (error) {
            console.log('   ⚠️ [Cola] Error al eliminar imagen anterior:', error.message);
        }

        // Subir nueva imagen procesada
        const newImageUrl = await uploadBufferToCloudinary(processedBuffer);
        console.log('   ☁️ [Cola] Nueva imagen subida a Cloudinary');

        // Actualizar artículo con nueva URL
        await sequelize.query(
            'UPDATE articulos SET imagen_url = $1 WHERE id = $2',
            {
                bind: [newImageUrl, item.articulo_id],
                type: QueryTypes.UPDATE
            }
        );

        // Marcar como completado en la cola
        await marcarComoCompletado(item.id, newImageUrl);

        console.log(`   ✅ [Cola] Artículo ${item.articulo_id} procesado exitosamente`);

        return true;

    } catch (error) {
        console.error(`   ❌ [Cola] Error procesando artículo ${item.articulo_id}:`, error.message);

        // Marcar como fallido en la cola
        await marcarComoFallido(item.id, error);

        return false;
    }
}

/**
 * Loop principal del worker
 */
async function procesarCola() {
    if (isProcessing || shouldStop) {
        return;
    }

    isProcessing = true;

    try {
        // Verificar que Gemini esté configurado
        if (!isNanoBananaEnabled()) {
            console.log('⚠️ [Cola] Gemini no está configurado, worker en pausa');
            isProcessing = false;
            return;
        }

        // Obtener siguiente artículo
        const item = await obtenerSiguienteArticulo();

        if (!item) {
            // No hay artículos pendientes
            isProcessing = false;
            return;
        }

        // Procesar artículo
        await procesarArticulo(item);

        // Mostrar estadísticas
        const estado = await obtenerEstadoCola();
        console.log(`\n   📊 [Cola] Estado actual:`);
        console.log(`      ⏳ Pendientes: ${estado.stats.pendientes}`);
        console.log(`      ✅ Completados: ${estado.stats.completados}`);
        console.log(`      ❌ Fallidos: ${estado.stats.fallidos}`);
        console.log(`      📈 Total: ${estado.stats.total}`);

    } catch (error) {
        console.error('❌ [Cola] Error en procesarCola:', error);
    } finally {
        isProcessing = false;

        // Si hay más artículos pendientes, continuar procesando
        if (!shouldStop) {
            const estado = await obtenerEstadoCola();
            if (estado.stats.pendientes > 0) {
                // Pequeño delay antes de procesar el siguiente
                setTimeout(procesarCola, 2000);
            }
        }
    }
}

/**
 * Iniciar el worker
 */
export function iniciarWorker() {
    console.log('🚀 [Cola] Worker de procesamiento de imágenes iniciado');
    console.log('   👀 [Cola] Esperando artículos en la cola...\n');

    // Verificar la cola cada 10 segundos
    setInterval(async () => {
        if (!isProcessing && !shouldStop) {
            const estado = await obtenerEstadoCola();
            if (estado.stats.pendientes > 0) {
                console.log(`\n🔔 [Cola] Hay ${estado.stats.pendientes} artículo(s) pendiente(s), iniciando procesamiento...`);
                procesarCola();
            }
        }
    }, 10000);

    // También iniciar procesamiento inmediatamente si hay artículos
    procesarCola();
}

/**
 * Detener el worker
 */
export function detenerWorker() {
    console.log('🛑 [Cola] Deteniendo worker...');
    shouldStop = true;
}

/**
 * Obtener estado del worker
 */
export function obtenerEstadoWorker() {
    return {
        isProcessing,
        shouldStop
    };
}

export default {
    iniciarWorker,
    detenerWorker,
    obtenerEstadoWorker,
    procesarCola
};
