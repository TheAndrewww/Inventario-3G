/**
 * Job de sincronización automática con Google Sheets
 * Mantiene la base de datos actualizada para que la vista TV
 * siempre muestre datos frescos, sin depender de que alguien
 * abra el dashboard principal.
 */

import produccionSheetsService from '../services/produccionSheets.service.js';
import { revisarAdelantos } from '../services/fechaInstalacion.service.js';

/**
 * Sincronizar proyectos desde Google Sheets a la base de datos
 */
export const sincronizarSheetsAutomatico = async () => {
    console.log('📊 [Sheets Job] Sincronizando con Google Sheets...');

    try {
        const resultado = await produccionSheetsService.sincronizarConDB();

        console.log(`✅ [Sheets Job] Sincronización completada: ${resultado.creados} nuevos, ${resultado.actualizados} actualizados (${resultado.meses?.length || 1} meses)`);

        // Con la base al día, ¿algún proyecto se adelantó en el calendario a hoy o mañana?
        // Que falle no tumba la sincronización.
        try {
            await revisarAdelantos();
        } catch (e) {
            console.error('⚠️ [Sheets Job] No se pudieron revisar los adelantos del calendario:', e.message);
        }

        return resultado;
    } catch (error) {
        console.error('❌ [Sheets Job] Error en sincronización:', error.message);
        throw error;
    }
};

/**
 * Iniciar job periódico de sincronización con Sheets
 * @param {number} intervaloMinutos - Intervalo en minutos (default: 5)
 */
export const iniciarJobSincronizacionSheets = (intervaloMinutos = 5) => {
    console.log(`📅 Sincronización de Sheets programada cada ${intervaloMinutos} minutos`);

    // Ejecutar una vez al iniciar (después de 30s para dar tiempo al arranque)
    setTimeout(() => {
        console.log('🚀 Ejecutando primera sincronización automática de Sheets...');
        sincronizarSheetsAutomatico()
            .catch(err => console.error('Error en sincronización inicial de Sheets:', err.message));
    }, 30000);

    // Programar ejecución periódica
    const intervaloMs = intervaloMinutos * 60 * 1000;
    setInterval(() => {
        sincronizarSheetsAutomatico()
            .catch(err => console.error('Error en sincronización programada de Sheets:', err.message));
    }, intervaloMs);
};

export default {
    sincronizarSheetsAutomatico,
    iniciarJobSincronizacionSheets
};
