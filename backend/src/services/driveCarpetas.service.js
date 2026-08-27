/**
 * Piezas comunes para mostrar el contenido de una carpeta de Drive dentro del
 * sistema, sin que el usuario tenga acceso a Drive.
 *
 * Lo usan dos vistas:
 *   - el calendario, con la carpeta de VENTAS (driveVentas.service.js)
 *   - el dashboard de producción, con la carpeta de PRODUCCION
 *
 * Cada una decide su raíz, su cliente de Drive y qué archivos oculta; aquí vive
 * lo que no cambia: listar, clasificar por tipo, validar que un archivo cuelgue
 * de la raíz permitida y entregarlo como stream.
 */

// ---------------------------------------------------------------------------
// Qué se oculta
// ---------------------------------------------------------------------------

/** El pedido y todo lo que trae importes. Almacén no ve dinero. */
export const PATRONES_DINERO = [
    /\bPEDIDO/,
    /\bCOTIZA/,          // COTIZACION, COTIZACIÓN, COTIZ
    /\bPRECIO/,
    /\bANTICIPO/,
    /\bCONTRATO/,
    /\bFACTURA/,
    /\bPAGO/,
    /\bCOMPROBANTE/,
    /\bDEPOSITO/,
    /\bLIQUIDACION/,
    /\bPRESUPUESTO/,
    /\bREMISION/
];

/** Formatos de cierre que el jefe pidió dejar fuera de estas vistas. */
export const PATRONES_CIERRE = [
    /\bGARANTIA/,        // GARANTIA, CARTA GARANTIA, CARTA DE GARANTIA
    /\bGTIA/,
    /\bCALIDAD/,         // CONTROL DE CALIDAD, FORMATO DE CALIDAD
    /\bCHECK/            // CHECK, CHECKLIST, CHECK LIST
];

/** Tickets de salida de almacén. En producción SÍ se ven; en ventas no. */
export const PATRONES_TICKET = [/\bTICKET/];

export const normalizar = (texto = '') =>
    texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();

/**
 * Arma la función que decide si un archivo o carpeta se oculta.
 * @param {Array<RegExp>} patrones
 * @returns {(nombre: string) => boolean}
 */
export const crearFiltro = (patrones) => (nombre = '') => {
    const norm = normalizar(nombre);
    return patrones.some(p => p.test(norm));
};

// ---------------------------------------------------------------------------
// Caché
// ---------------------------------------------------------------------------

const TTL_CACHE_MS = 5 * 60 * 1000;
const cache = new Map();

// Devuelve undefined si no hay nada cacheado. Se distingue de null a propósito:
// null es un resultado válido ("este proyecto no tiene carpeta") y también se
// cachea, para no repetir el barrido de Drive en cada click.
export const getCache = (clave) => {
    const entrada = cache.get(clave);
    if (!entrada) return undefined;
    if (Date.now() - entrada.ts > TTL_CACHE_MS) {
        cache.delete(clave);
        return undefined;
    }
    return entrada.valor;
};

export const setCache = (clave, valor) => {
    cache.set(clave, { ts: Date.now(), valor });
};

export const limpiarCache = () => cache.clear();

// ---------------------------------------------------------------------------
// Lectura de Drive
// ---------------------------------------------------------------------------

const CAMPOS = 'files(id, name, mimeType, webViewLink, webContentLink, iconLink, thumbnailLink, size, createdTime, modifiedTime, shortcutDetails)';

/**
 * Listar el contenido de una carpeta.
 * @param {Object} drive - Cliente de Drive
 * @param {string} parentId
 * @param {boolean} soloCarpetas
 */
export const listarHijos = async (drive, parentId, soloCarpetas = false) => {
    const filtroTipo = soloCarpetas
        ? "and mimeType = 'application/vnd.google-apps.folder'"
        : '';

    const response = await drive.files.list({
        q: `'${parentId}' in parents and trashed = false ${filtroTipo}`,
        fields: CAMPOS,
        pageSize: 500,
        orderBy: 'folder,name',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
    });

    return response.data.files || [];
};

export const tipoDeArchivo = (archivo) => {
    const mime = archivo.shortcutDetails?.targetMimeType || archivo.mimeType || '';
    if (mime.startsWith('image/')) return 'imagen';
    if (mime === 'application/pdf') return 'pdf';
    if (mime.startsWith('video/')) return 'video';
    if (mime.includes('spreadsheet') || mime.includes('excel')) return 'hoja';
    if (mime.includes('document') || mime.includes('word')) return 'documento';
    if (mime.includes('presentation')) return 'presentacion';
    return 'otro';
};

const mapearArchivo = (archivo, carpetaNombre = null) => {
    const id = archivo.shortcutDetails?.targetId || archivo.id;
    return {
        id,
        nombre: archivo.name,
        tipo: tipoDeArchivo(archivo),
        mimeType: archivo.shortcutDetails?.targetMimeType || archivo.mimeType,
        subcarpeta: carpetaNombre,
        link: archivo.webViewLink || `https://drive.google.com/file/d/${id}/view`,
        linkPreview: `https://drive.google.com/file/d/${id}/preview`,
        thumbnail: archivo.thumbnailLink || null,
        tamaño: archivo.size ? Number(archivo.size) : null,
        creado: archivo.createdTime,
        modificado: archivo.modifiedTime
    };
};

// Imágenes y PDFs primero (es lo que se consulta), luego por nombre.
const PESO_TIPO = { imagen: 0, pdf: 1, documento: 2, hoja: 3, presentacion: 4, video: 5, otro: 6 };

/**
 * Listar los archivos visibles de una carpeta, bajando por sus subcarpetas.
 *
 * @param {Object} opciones
 * @param {Object} opciones.drive - Cliente de Drive
 * @param {string} opciones.carpetaId
 * @param {Function} opciones.esExcluido - (nombre) => boolean
 * @param {number} [opciones.maxProfundidad=2] - Niveles de subcarpetas a recorrer
 * @param {Function} [opciones.categorizar] - (nombre) => string, etiqueta para agrupar
 * @param {string} [opciones.prefijoCache='archivos']
 * @returns {Promise<{archivos: Array, ocultos: number}>}
 */
export const listarArchivos = async ({
    drive,
    carpetaId,
    esExcluido,
    maxProfundidad = 2,
    categorizar = null,
    prefijoCache = 'archivos'
}) => {
    const claveCache = `${prefijoCache}:${carpetaId}`;
    const enCache = getCache(claveCache);
    if (enCache !== undefined) return enCache;

    const archivos = [];
    let ocultos = 0;

    const recorrer = async (id, nombreCarpeta, profundidad) => {
        const hijos = await listarHijos(drive, id, false);

        for (const hijo of hijos) {
            const esCarpeta = hijo.mimeType === 'application/vnd.google-apps.folder';

            if (esExcluido(hijo.name)) {
                ocultos++;
                continue;
            }

            if (esCarpeta) {
                if (profundidad < maxProfundidad) {
                    await recorrer(hijo.id, hijo.name, profundidad + 1);
                }
                continue;
            }

            const archivo = mapearArchivo(hijo, nombreCarpeta);
            if (categorizar) archivo.categoria = categorizar(hijo.name);
            archivos.push(archivo);
        }
    };

    await recorrer(carpetaId, null, 1);

    archivos.sort((a, b) => (PESO_TIPO[a.tipo] - PESO_TIPO[b.tipo]) || a.nombre.localeCompare(b.nombre, 'es'));

    const resultado = { archivos, ocultos };
    setCache(claveCache, resultado);
    return resultado;
};

/**
 * Descargar un archivo para servirlo desde el backend.
 *
 * Quien consulta estas vistas NO tiene acceso a Drive, así que hay que validar
 * dos cosas antes de entregar nada:
 *   1. Que el archivo cuelgue realmente de la raíz permitida (no de cualquier
 *      otro lado de Drive).
 *   2. Que no sea un archivo excluido — si no, bastaría con conocer su id para
 *      saltarse el filtro de la lista.
 *
 * @param {Object} opciones
 * @param {Object} opciones.drive
 * @param {string} opciones.archivoId
 * @param {string} opciones.raizId - Carpeta de la que debe colgar el archivo
 * @param {Function} opciones.esExcluido
 * @param {number} [opciones.maxSaltos=6] - Niveles a subir buscando la raíz
 * @param {string} [opciones.etiqueta='DRIVE'] - Para los logs
 * @returns {Promise<{nombre: string, mimeType: string, stream: Object}|null>}
 */
export const obtenerArchivo = async ({
    drive,
    archivoId,
    raizId,
    esExcluido,
    maxSaltos = 6,
    etiqueta = 'DRIVE'
}) => {
    const claveCache = `permitido:${raizId}:${archivoId}`;
    let permitido = getCache(claveCache);

    if (permitido === undefined) {
        let actual;
        try {
            actual = (await drive.files.get({
                fileId: archivoId,
                fields: 'id, name, mimeType, parents',
                supportsAllDrives: true
            })).data;
        } catch (error) {
            console.log(`⛔ [${etiqueta}] Archivo ${archivoId} no accesible: ${error.message}`);
            setCache(claveCache, false);
            return null;
        }

        if (esExcluido(actual.name)) {
            console.log(`⛔ [${etiqueta}] Archivo excluido: "${actual.name}"`);
            setCache(claveCache, false);
            return null;
        }

        // Subir por los padres hasta toparse con la raíz permitida.
        let dentro = false;
        let padre = actual.parents?.[0];
        for (let i = 0; i < maxSaltos && padre; i++) {
            if (padre === raizId) { dentro = true; break; }
            try {
                const meta = (await drive.files.get({
                    fileId: padre,
                    fields: 'id, name, parents',
                    supportsAllDrives: true
                })).data;
                padre = meta.parents?.[0];
            } catch {
                break;
            }
        }

        if (!dentro) {
            console.log(`⛔ [${etiqueta}] Archivo ${archivoId} fuera de la carpeta permitida`);
            setCache(claveCache, false);
            return null;
        }

        permitido = { nombre: actual.name, mimeType: actual.mimeType };
        setCache(claveCache, permitido);
    }

    if (permitido === false) return null;

    const respuesta = await drive.files.get(
        { fileId: archivoId, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' }
    );

    return {
        nombre: permitido.nombre,
        mimeType: permitido.mimeType,
        stream: respuesta.data
    };
};

export default {
    PATRONES_DINERO,
    PATRONES_CIERRE,
    PATRONES_TICKET,
    crearFiltro,
    normalizar,
    listarHijos,
    listarArchivos,
    obtenerArchivo,
    tipoDeArchivo,
    getCache,
    setCache,
    limpiarCache
};
