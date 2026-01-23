/**
 * Job de sincronización automática con Google Drive
 * Corre periódicamente para actualizar información de archivos de proyectos
 */

import { ProduccionProyecto } from '../models/index.js';
import { Op } from 'sequelize';
import googleDriveService from '../services/googleDrive.service.js';

/**
 * Sincronizar proyectos activos con Google Drive
 * @param {Object} options - Opciones de sincronización
 * @param {boolean} options.soloSinCarpeta - Solo sincronizar proyectos sin carpeta asignada
 * @param {number} options.limite - Límite de proyectos a sincronizar
 */
export const sincronizarProyectosConDrive = async (options = {}) => {
    const { soloSinCarpeta = false, limite = 50 } = options;

    console.log('🔄 Iniciando sincronización automática con Google Drive...');
    console.log(`   Opciones: soloSinCarpeta=${soloSinCarpeta}, limite=${limite}`);

    try {
        // Construir query
        // OPTIMIZACIÓN: Solo buscar carpetas para proyectos nuevos (A, B, C) o MTO extensivo
        // GTIA y MTO no extensivo no necesitan búsqueda de carpetas en Drive
        const where = {
            activo: true,
            etapa_actual: { [Op.notIn]: ['completado', 'pendiente'] },
            // Excluir GTIA (no necesitan carpeta en Drive)
            [Op.or]: [
                // Tipos A, B, C (proyectos nuevos) - siempre buscar
                { tipo_proyecto: { [Op.in]: ['A', 'B', 'C'] } },
                // MTO solo si es extensivo
                {
                    [Op.and]: [
                        { tipo_proyecto: 'MTO' },
                        { es_extensivo: true }
                    ]
                },
                // Proyectos sin tipo definido (por compatibilidad)
                { tipo_proyecto: { [Op.is]: null } },
                { tipo_proyecto: '' }
            ]
        };

        // Si solo queremos proyectos sin carpeta asignada
        if (soloSinCarpeta) {
            where.drive_folder_id = { [Op.or]: [null, ''] };
        }

        const proyectos = await ProduccionProyecto.findAll({
            where,
            limit: limite,
            order: [
                ['drive_sync_at', 'ASC NULLS FIRST'], // Primero los que nunca se sincronizaron
                ['updated_at', 'DESC'] // Luego los más recientemente actualizados
            ]
        });

        console.log(`📊 Proyectos a sincronizar: ${proyectos.length}`);

        const resultados = {
            total: proyectos.length,
            exitosos: 0,
            fallidos: 0,
            sinCarpeta: 0,
            actualizados: 0,
            inicio: new Date(),
            fin: null
        };

        for (const proyecto of proyectos) {
            try {
                const resultado = await googleDriveService.sincronizarProyecto(proyecto);

                if (resultado.success) {
                    resultados.exitosos++;
                    if (resultado.tieneManufactura || resultado.tieneHerreria) {
                        resultados.actualizados++;
                    }
                } else {
                    resultados.fallidos++;
                    if (resultado.message === 'Carpeta no encontrada') {
                        resultados.sinCarpeta++;
                    }
                }

                // Pequeña pausa para no saturar la API de Google
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.error(`   ❌ Error sincronizando "${proyecto.nombre}":`, error.message);
                resultados.fallidos++;
            }
        }

        resultados.fin = new Date();
        const duracion = (resultados.fin - resultados.inicio) / 1000;

        console.log('\n✅ Sincronización completada:');
        console.log(`   📊 Total: ${resultados.total}`);
        console.log(`   ✅ Exitosos: ${resultados.exitosos}`);
        console.log(`   ❌ Fallidos: ${resultados.fallidos}`);
        console.log(`   📁 Sin carpeta: ${resultados.sinCarpeta}`);
        console.log(`   📄 Con archivos: ${resultados.actualizados}`);
        console.log(`   ⏱️ Duración: ${duracion.toFixed(1)}s`);

        return resultados;

    } catch (error) {
        console.error('❌ Error en sincronización automática:', error);
        throw error;
    }
};

/**
 * Iniciar job periódico de sincronización
 * @param {number} intervaloMinutos - Intervalo en minutos (default: 30)
 */
export const iniciarJobSincronizacion = (intervaloMinutos = 30) => {
    console.log(`📅 Programando sincronización de Drive cada ${intervaloMinutos} minutos`);

    // Ejecutar una vez al iniciar (después de 1 minuto para dar tiempo a que arranque el servidor)
    setTimeout(() => {
        console.log('🚀 Ejecutando primera sincronización de Drive...');
        sincronizarProyectosConDrive({ soloSinCarpeta: true, limite: 100 })
            .catch(err => console.error('Error en sincronización inicial:', err));
    }, 60000);

    // Programar ejecución periódica
    const intervaloMs = intervaloMinutos * 60 * 1000;
    setInterval(() => {
        console.log('\n⏰ Ejecutando sincronización programada de Drive...');
        sincronizarProyectosConDrive({ soloSinCarpeta: false, limite: 50 })
            .catch(err => console.error('Error en sincronización programada:', err));
    }, intervaloMs);
};

export default {
    sincronizarProyectosConDrive,
    iniciarJobSincronizacion
};
