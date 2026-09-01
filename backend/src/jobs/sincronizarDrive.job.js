/**
 * Job de sincronización automática con Google Drive
 * Corre periódicamente para actualizar información de archivos de proyectos
 */

import { ProduccionProyecto } from '../models/index.js';
import { Op } from 'sequelize';
import googleDriveService from '../services/googleDrive.service.js';
import { avisarArchivosNuevos, avisarTicketSubido } from '../services/avisosProduccion.service.js';

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
        // Construir query — incluye solo proyectos que entran a producción:
        //   - A/B/C (o tipo null): siempre
        //   - MTO o GTIA: solo si son EXTENSIVO
        // Excluye siempre los PREMIUM.
        const where = {
            activo: true,
            etapa_actual: { [Op.notIn]: ['completado', 'pendiente'] },
            es_premium: false,
            [Op.or]: [
                { tipo_proyecto: { [Op.notIn]: ['MTO', 'GTIA'] } },
                { tipo_proyecto: { [Op.is]: null } },
                { es_extensivo: true }
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
            avisados: 0,
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

                    // Avisar al grupo de PRODUCCIÓN lo que se subió a la carpeta
                    // desde la pasada anterior. Un aviso que falla no debe
                    // interrumpir la sincronización del resto.
                    const nuevos = resultado.nuevos;
                    if (nuevos && (nuevos.manufactura.length > 0 || nuevos.herreria.length > 0)) {
                        resultados.avisados++;
                        await avisarArchivosNuevos({
                            proyecto: proyecto.nombre,
                            manufactura: nuevos.manufactura,
                            herreria: nuevos.herreria
                        }).catch(err => console.error('   ⚠️ No se pudo avisar al grupo:', err.message));
                    }

                    // El ticket de salida se avisa al subirlo desde el sistema, pero si
                    // esa subida falla y alguien lo arrastra a la carpeta a mano, el
                    // grupo se quedaba sin enterarse. Aquí se pesca ese caso.
                    for (const ticket of (nuevos?.tickets || [])) {
                        resultados.avisados++;
                        await avisarTicketSubido({ proyecto: proyecto.nombre })
                            .catch(err => console.error(`   ⚠️ No se pudo avisar el ticket ${ticket}:`, err.message));
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
        console.log(`   📨 Avisados al grupo: ${resultados.avisados}`);
        console.log(`   ⏱️ Duración: ${duracion.toFixed(1)}s`);

        return resultados;

    } catch (error) {
        console.error('❌ Error en sincronización automática:', error);
        throw error;
    }
};

/**
 * Iniciar job periódico de sincronización
 *
 * Cada 10 minutos: es lo que tarda el grupo de PRODUCCIÓN en enterarse de que
 * se subió un plano o un ticket a la carpeta del proyecto. Con 30 minutos el
 * aviso llegaba tan tarde que la gente ya había preguntado por WhatsApp.
 *
 * @param {number} intervaloMinutos - Intervalo en minutos (default: 10)
 */
export const iniciarJobSincronizacion = (intervaloMinutos = 10) => {
    console.log(`📅 Programando sincronización de Drive cada ${intervaloMinutos} minutos`);

    // Ejecutar una vez al iniciar (después de 1 minuto para dar tiempo a que arranque el servidor)
    setTimeout(() => {
        console.log('🚀 Ejecutando primera sincronización de Drive...');
        sincronizarProyectosConDrive({ soloSinCarpeta: true, limite: 100 })
            .catch(err => console.error('Error en sincronización inicial:', err));
    }, 60000);

    // Programar ejecución periódica. Con el intervalo corto una pasada lenta
    // (Drive tardando, muchos proyectos) podría alcanzar a la siguiente y
    // dejarlas encimadas, avisando dos veces lo mismo: si la anterior sigue
    // corriendo, esta vuelta se salta y espera la que sigue.
    let corriendo = false;
    const intervaloMs = intervaloMinutos * 60 * 1000;
    setInterval(async () => {
        if (corriendo) {
            console.log('⏭️ Sincronización de Drive aún corriendo, se salta esta vuelta');
            return;
        }
        corriendo = true;
        console.log('\n⏰ Ejecutando sincronización programada de Drive...');
        try {
            await sincronizarProyectosConDrive({ soloSinCarpeta: false, limite: 50 });
        } catch (err) {
            console.error('Error en sincronización programada:', err);
        } finally {
            corriendo = false;
        }
    }, intervaloMs);
};

export default {
    sincronizarProyectosConDrive,
    iniciarJobSincronizacion
};
