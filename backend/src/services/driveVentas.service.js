/**
 * Acceso de SOLO LECTURA a la carpeta raíz de VENTAS en Google Drive.
 *
 * Sirve al calendario: el rol almacén (que hoy también hace calidad) da click
 * a un proyecto del calendario y ve lo que ventas dejó en la carpeta de ese
 * proyecto — planos, fotos, croquis, detalles — EXCEPTO el pedido, cualquier
 * documento con dinero (cotizaciones, precios, anticipos, contratos) y los
 * formatos de cierre (carta garantía, control de calidad, checks).
 *
 * Estructura real hoy:  VENTAS / {MES DD-DD} / {PROYECTO} / archivos
 * (p.ej. "JULIO 28-01" / "ARQ. VIRIDIANA NUÑEZ RAMIREZ").
 * Aun así la búsqueda baja recursivamente hasta MAX_PROFUNDIDAD niveles, para
 * que siga funcionando si mañana meten un nivel de asesor o de año.
 *
 * ACCESO: VENTAS vive en "Mi unidad" del dueño y hoy NO está compartida con la
 * cuenta de servicio, así que se intenta primero con la cuenta de servicio y se
 * cae a OAuth. Si algún día se comparte VENTAS (lector) con
 * inventario-calendar-reader@calendario-3g.iam.gserviceaccount.com, deja de
 * depender del refresh token.
 */
import { authenticate, authenticateEscritura } from './googleDrive.service.js';

// ID de la carpeta raíz de VENTAS en Drive (Mi unidad / 2026 / VENTAS).
// Se puede sobrescribir con la variable de entorno VENTAS_FOLDER_ID.
export const VENTAS_FOLDER_ID =
    process.env.VENTAS_FOLDER_ID || '11VDj3kRwcNufgamLMmV8zBlzmZsaBdDm';

// Hasta cuántos niveles bajar desde la raíz buscando la carpeta del proyecto.
// Cubre raíz → mes → proyecto, o raíz → asesor → mes → proyecto.
const MAX_PROFUNDIDAD = 3;

// Cuántos niveles de subcarpetas se recorren DENTRO de la carpeta del proyecto
// al listar sus archivos (p.ej. PROYECTO/FOTOS/foto1.jpg).
const MAX_PROFUNDIDAD_ARCHIVOS = 2;

// Caché en memoria para no golpear la API de Drive en cada click.
const TTL_CACHE_MS = 5 * 60 * 1000;
const cache = new Map();

// Devuelve undefined si no hay nada cacheado. Se distingue de null a propósito:
// null es un resultado válido ("este proyecto no tiene carpeta") y también se
// cachea, para no repetir el barrido de Drive en cada click.
const getCache = (clave) => {
    const entrada = cache.get(clave);
    if (!entrada) return undefined;
    if (Date.now() - entrada.ts > TTL_CACHE_MS) {
        cache.delete(clave);
        return undefined;
    }
    return entrada.valor;
};

const setCache = (clave, valor) => {
    cache.set(clave, { ts: Date.now(), valor });
};

export const limpiarCacheVentas = () => {
    cache.clear();
    clienteDrive = null;
};

/**
 * Cliente de Drive para leer VENTAS.
 * Se prueba la cuenta de servicio (no consume el refresh token) y, si no ve la
 * carpeta raíz, se cae a OAuth del dueño de "Mi unidad".
 * El cliente resuelto se memoriza para no repetir el sondeo en cada click.
 */
let clienteDrive = null;

const obtenerDrive = async () => {
    if (clienteDrive) return clienteDrive;

    try {
        const sa = await authenticate();
        // Ojo: la cuenta de servicio alcanza a LEER la metadata de VENTAS sin
        // tener permiso real sobre ella (canListChildren viene en false y el
        // listado sale vacío, sin error). Hay que preguntar por la capability.
        const meta = await sa.files.get({
            fileId: VENTAS_FOLDER_ID,
            fields: 'id, capabilities(canListChildren)',
            supportsAllDrives: true
        });

        if (meta.data.capabilities?.canListChildren) {
            console.log('🔑 [VENTAS] Leyendo con cuenta de servicio');
            clienteDrive = sa;
            return clienteDrive;
        }
        console.log('🔑 [VENTAS] La cuenta de servicio no puede listar VENTAS; usando OAuth');
    } catch (error) {
        console.log(`🔑 [VENTAS] Cuenta de servicio sin acceso (${error.message}); usando OAuth`);
    }

    clienteDrive = await authenticateEscritura();
    return clienteDrive;
};

/**
 * Patrones de archivos que NUNCA se muestran a almacén/calidad.
 * Dos motivos distintos, misma lista:
 *   - el pedido y todo lo que trae importes;
 *   - los formatos de cierre (carta garantía, control de calidad, checks), que
 *     el jefe pidió dejar fuera de esta vista.
 */
const PATRONES_EXCLUIDOS = [
    // Pedido y documentos con dinero
    /\bPEDIDO/,
    /\bCOTIZA/,          // COTIZACION, COTIZACIÓN, COTIZ
    /\bPRECIO/,
    /\bANTICIPO/,
    /\bCONTRATO/,
    /\bFACTURA/,
    /\bTICKET/,
    /\bPAGO/,
    /\bCOMPROBANTE/,
    /\bDEPOSITO/,
    /\bLIQUIDACION/,
    /\bPRESUPUESTO/,
    /\bREMISION/,

    // Formatos de cierre
    /\bGARANTIA/,        // GARANTIA, CARTA GARANTIA, CARTA DE GARANTIA
    /\bGTIA/,
    /\bCALIDAD/,         // CONTROL DE CALIDAD, FORMATO DE CALIDAD
    /\bCHECK/            // CHECK, CHECKLIST, CHECK LIST
];

const normalizar = (texto = '') =>
    texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();

/**
 * ¿Este archivo/carpeta se le oculta a almacén?
 * @param {string} nombre - Nombre del archivo o carpeta
 * @returns {boolean}
 */
export const esExcluido = (nombre) => {
    const norm = normalizar(nombre);
    return PATRONES_EXCLUIDOS.some(p => p.test(norm));
};

/**
 * Variantes del nombre del proyecto para hacer match con el nombre de la
 * carpeta. El calendario trae cosas como "ARQ. VIRIDIANA NUÑEZ RAMIREZ" o
 * "JUAN PEREZ / MTO"; en Drive la carpeta puede no traer el título ni el sufijo.
 * @param {string} nombreProyecto
 * @returns {string[]}
 */
const generarVariantes = (nombreProyecto) => {
    const base = normalizar(nombreProyecto);
    const variantes = [base];

    // Sin sufijo de tipo: "/ MTO", "/GTIA", "/ MTO ESTRUCTURA"
    const sinSufijo = base.replace(/\s*\/\s*(MTO|GTIA|MANTENIMIENTO|GARANTIA)(\s+[\w\s]*)?$/i, '').trim();
    if (sinSufijo && !variantes.includes(sinSufijo)) variantes.push(sinSufijo);

    // Sin título profesional al inicio
    const sinTitulo = sinSufijo.replace(/^(ARQ|ING|LIC|SR|SRA|SRTA|DR|DRA|C|CP)\.?\s+/i, '').trim();
    if (sinTitulo && !variantes.includes(sinTitulo)) variantes.push(sinTitulo);

    return variantes.filter(v => v.length >= 4);
};

const listarHijos = async (drive, parentId, soloCarpetas = false) => {
    const filtroTipo = soloCarpetas
        ? "and mimeType = 'application/vnd.google-apps.folder'"
        : '';

    const response = await drive.files.list({
        q: `'${parentId}' in parents and trashed = false ${filtroTipo}`,
        fields: 'files(id, name, mimeType, webViewLink, webContentLink, iconLink, thumbnailLink, size, createdTime, modifiedTime, shortcutDetails)',
        pageSize: 500,
        orderBy: 'folder,name',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
    });

    return response.data.files || [];
};

/**
 * Buscar la carpeta de un proyecto dentro de la raíz de VENTAS.
 *
 * Recorre por niveles (BFS). En cada nivel intenta match exacto primero y
 * substring después; si no encuentra nada, baja al siguiente nivel. Si hay
 * `mesHint` y en el primer nivel existen carpetas de mes, la búsqueda se
 * restringe a ese mes para no cruzar clientes homónimos de meses distintos.
 *
 * @param {string} nombreProyecto - Nombre tal como viene del calendario
 * @param {string|null} mesHint - Mes del calendario (ej. "AGOSTO")
 * @returns {Promise<Object|null>} - { id, name, ruta } o null
 */
export const buscarCarpetaVentas = async (nombreProyecto, mesHint = null) => {
    if (!VENTAS_FOLDER_ID) {
        throw new Error(
            'La carpeta de VENTAS no está configurada. Define VENTAS_FOLDER_ID ' +
            'en las variables de entorno del backend con el ID de la carpeta raíz de Drive.'
        );
    }

    const claveCache = `carpeta:${normalizar(nombreProyecto)}:${mesHint || ''}`;
    const enCache = getCache(claveCache);
    if (enCache !== undefined) return enCache;

    const drive = await obtenerDrive();
    const variantes = generarVariantes(nombreProyecto);
    if (variantes.length === 0) return null;

    console.log(`🔍 [VENTAS] Buscando carpeta de "${nombreProyecto}"${mesHint ? ` [mes: ${mesHint}]` : ''}`);

    const carpetasRaiz = await listarHijos(drive, VENTAS_FOLDER_ID, true);

    const buscarEn = (carpetas) => {
        // Pasada 1: match exacto
        for (const carpeta of carpetas) {
            const norm = normalizar(carpeta.name);
            if (variantes.some(v => norm === v)) return { carpeta, score: 1000 };
        }

        // Pasada 2: mejor substring (se prefiere el nombre más ajustado)
        let mejor = null;
        for (const carpeta of carpetas) {
            const norm = normalizar(carpeta.name);
            for (const variante of variantes) {
                let score = 0;
                if (norm.includes(variante)) {
                    score = 500 - (norm.length - variante.length);
                } else if (variante.includes(norm) && norm.length >= 6) {
                    score = 100 + norm.length;
                }
                if (score > 0 && (!mejor || score > mejor.score)) {
                    mejor = { carpeta, score };
                }
            }
        }
        return mejor;
    };

    // BFS por niveles a partir de un conjunto de carpetas de arranque.
    const bajarBuscando = async (carpetasInicio) => {
        let nivel = carpetasInicio;
        let rutaDe = new Map(nivel.map(c => [c.id, c.name]));

        for (let profundidad = 0; profundidad < MAX_PROFUNDIDAD && nivel.length > 0; profundidad++) {
            const encontrada = buscarEn(nivel);
            if (encontrada) {
                return {
                    id: encontrada.carpeta.id,
                    name: encontrada.carpeta.name,
                    ruta: rutaDe.get(encontrada.carpeta.id) || encontrada.carpeta.name,
                    link: `https://drive.google.com/drive/folders/${encontrada.carpeta.id}`,
                    score: encontrada.score
                };
            }

            const siguiente = [];
            const siguienteRuta = new Map();
            for (const carpeta of nivel) {
                const hijos = await listarHijos(drive, carpeta.id, true);
                const rutaActual = rutaDe.get(carpeta.id) || carpeta.name;
                for (const hijo of hijos) {
                    siguiente.push(hijo);
                    siguienteRuta.set(hijo.id, `${rutaActual}/${hijo.name}`);
                }
            }
            nivel = siguiente;
            rutaDe = siguienteRuta;
        }
        return null;
    };

    // 1) Preferir el mes del calendario. Las carpetas de mes son de rango
    //    ("JULIO 28-01"), así que una entrega de principios de agosto puede
    //    vivir en la de julio: por eso esto es preferencia, no filtro duro.
    if (mesHint) {
        const mesNorm = normalizar(mesHint);
        const carpetasDelMes = carpetasRaiz.filter(c => normalizar(c.name).startsWith(mesNorm));
        if (carpetasDelMes.length > 0) {
            console.log(`   🎯 [VENTAS] Primero en: ${carpetasDelMes.map(c => c.name).join(', ')}`);
            const enElMes = await bajarBuscando(carpetasDelMes);
            if (enElMes) {
                console.log(`✅ [VENTAS] Carpeta: "${enElMes.name}" en ${enElMes.ruta} (score ${enElMes.score})`);
                setCache(claveCache, enElMes);
                return enElMes;
            }
            console.log(`   ↪️ [VENTAS] Nada en "${mesHint}", buscando en todos los meses`);
        }
    }

    // 2) Búsqueda global en toda la raíz de VENTAS.
    const global = await bajarBuscando(carpetasRaiz);
    if (global) {
        console.log(`✅ [VENTAS] Carpeta: "${global.name}" en ${global.ruta} (score ${global.score})`);
        setCache(claveCache, global);
        return global;
    }

    console.log(`⚠️ [VENTAS] Sin carpeta para "${nombreProyecto}"`);
    setCache(claveCache, null);
    return null;
};

const tipoDeArchivo = (archivo) => {
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
        linkDescarga: archivo.webContentLink || null,
        thumbnail: archivo.thumbnailLink || null,
        tamaño: archivo.size ? Number(archivo.size) : null,
        creado: archivo.createdTime,
        modificado: archivo.modifiedTime
    };
};

/**
 * Listar los archivos visibles de una carpeta de ventas.
 * Recorre subcarpetas hasta MAX_PROFUNDIDAD_ARCHIVOS niveles y quita todo lo
 * que cae en PATRONES_EXCLUIDOS (pedido, cotizaciones, dinero).
 *
 * @param {string} carpetaId
 * @returns {Promise<Object>} - { archivos, ocultos }
 */
export const listarArchivosVentas = async (carpetaId) => {
    const claveCache = `archivos:${carpetaId}`;
    const enCache = getCache(claveCache);
    if (enCache !== undefined) return enCache;

    const drive = await obtenerDrive();
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
                if (profundidad < MAX_PROFUNDIDAD_ARCHIVOS) {
                    await recorrer(hijo.id, hijo.name, profundidad + 1);
                }
                continue;
            }

            archivos.push(mapearArchivo(hijo, nombreCarpeta));
        }
    };

    await recorrer(carpetaId, null, 1);

    // Imágenes y PDFs primero (es lo que le sirve a calidad), luego por nombre
    const peso = { imagen: 0, pdf: 1, documento: 2, hoja: 3, presentacion: 4, video: 5, otro: 6 };
    archivos.sort((a, b) => (peso[a.tipo] - peso[b.tipo]) || a.nombre.localeCompare(b.nombre, 'es'));

    const resultado = { archivos, ocultos };
    setCache(claveCache, resultado);
    return resultado;
};

/**
 * Descargar un archivo de la carpeta de VENTAS para servirlo desde el backend.
 *
 * Almacén/calidad NO tiene acceso a Drive: los archivos se ven a través del
 * sistema. Por eso hay que validar dos cosas antes de entregar nada:
 *   1. Que el archivo cuelgue realmente de la raíz de VENTAS (no de cualquier
 *      otro lado de Drive).
 *   2. Que no sea un archivo excluido — si no, bastaría con conocer el id del
 *      pedido (o del control de calidad) para saltarse el filtro de la lista.
 *
 * @param {string} archivoId
 * @returns {Promise<Object|null>} - { nombre, mimeType, stream } o null si no
 *                                   pertenece a VENTAS / está excluido
 */
export const obtenerArchivoVentas = async (archivoId) => {
    const drive = await obtenerDrive();

    const claveCache = `permitido:${archivoId}`;
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
            console.log(`⛔ [VENTAS] Archivo ${archivoId} no accesible: ${error.message}`);
            setCache(claveCache, false);
            return null;
        }

        if (esExcluido(actual.name)) {
            console.log(`⛔ [VENTAS] Archivo excluido: "${actual.name}"`);
            setCache(claveCache, false);
            return null;
        }

        // Subir por los padres hasta toparse con la raíz de VENTAS.
        let dentroDeVentas = false;
        let padre = actual.parents?.[0];
        for (let i = 0; i < MAX_PROFUNDIDAD + MAX_PROFUNDIDAD_ARCHIVOS + 1 && padre; i++) {
            if (padre === VENTAS_FOLDER_ID) { dentroDeVentas = true; break; }
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

        if (!dentroDeVentas) {
            console.log(`⛔ [VENTAS] Archivo ${archivoId} fuera de la carpeta de VENTAS`);
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
    VENTAS_FOLDER_ID,
    buscarCarpetaVentas,
    listarArchivosVentas,
    obtenerArchivoVentas,
    limpiarCacheVentas,
    esExcluido
};
