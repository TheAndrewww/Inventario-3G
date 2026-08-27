/**
 * Lectura de la carpeta de PRODUCCION de un proyecto, para el dashboard.
 *
 * Almacén (que hoy también hace calidad) da click a un proyecto en el dashboard
 * y ve lo que hay en su carpeta de Drive: planos de manufactura, herrería y los
 * tickets de salida de almacén. A diferencia de la vista de ventas, aquí los
 * TICKETS sí se muestran — son justo lo que se viene a consultar.
 *
 * La carpeta ya la resuelve googleDrive.service (drive_folder_id del proyecto);
 * aquí solo se lista y se sirve su contenido.
 */
import { authenticate, PRODUCCION_FOLDER_ID } from './googleDrive.service.js';
import {
    PATRONES_DINERO,
    PATRONES_CIERRE,
    crearFiltro,
    normalizar,
    listarArchivos,
    obtenerArchivo
} from './driveCarpetas.service.js';

// Niveles de subcarpetas a recorrer dentro de la carpeta del proyecto.
const MAX_PROFUNDIDAD_ARCHIVOS = 2;

// PRODUCCION / {MES} / [MANTENIMIENTO|GARANTIA] / {PROYECTO} / [subcarpeta] / archivo
const MAX_SALTOS = 6;

/**
 * Qué se oculta: el pedido y todo lo que trae importes, más los formatos de
 * cierre. Los tickets NO se ocultan aquí.
 */
export const esExcluido = crearFiltro([
    ...PATRONES_DINERO,
    ...PATRONES_CIERRE
]);

/**
 * Etiqueta con la que se agrupan los archivos en la ventana, siguiendo la misma
 * lógica de negocio que ya usa la sincronización de Drive.
 * @param {string} nombre
 * @returns {'herreria'|'ticket'|'manufactura'}
 */
export const categorizar = (nombre = '') => {
    const norm = normalizar(nombre);
    if (norm.includes('HERRERIA')) return 'herreria';
    if (norm.startsWith('TICKET')) return 'ticket';
    return 'manufactura';
};

/**
 * Listar los archivos de la carpeta de producción de un proyecto.
 * @param {string} carpetaId - drive_folder_id del proyecto
 * @returns {Promise<{archivos: Array, ocultos: number}>}
 */
export const listarArchivosProduccion = async (carpetaId) => {
    const drive = await authenticate();
    return listarArchivos({
        drive,
        carpetaId,
        esExcluido,
        categorizar,
        maxProfundidad: MAX_PROFUNDIDAD_ARCHIVOS,
        prefijoCache: 'produccion'
    });
};

/**
 * Entregar un archivo de la carpeta de producción para servirlo desde el
 * backend (almacén no tiene acceso a Drive).
 * @param {string} archivoId
 * @returns {Promise<Object|null>}
 */
export const obtenerArchivoProduccion = async (archivoId) => {
    const drive = await authenticate();
    return obtenerArchivo({
        drive,
        archivoId,
        raizId: PRODUCCION_FOLDER_ID,
        esExcluido,
        maxSaltos: MAX_SALTOS,
        etiqueta: 'PRODUCCION'
    });
};

export default {
    esExcluido,
    categorizar,
    listarArchivosProduccion,
    obtenerArchivoProduccion
};
