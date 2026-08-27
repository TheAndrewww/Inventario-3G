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
import {
    PATRONES_DINERO,
    PATRONES_CIERRE,
    PATRONES_TICKET,
    crearFiltro,
    normalizar,
    listarHijos,
    listarArchivos,
    obtenerArchivo,
    getCache,
    setCache,
    limpiarCache
} from './driveCarpetas.service.js';

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

export const limpiarCacheVentas = () => {
    limpiarCache();
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

    // El OAuth es el plan B y existe para SUBIR tickets: si no está configurado
    // (p.ej. faltan las GOOGLE_OAUTH_* en Railway) su error habla de subidas y
    // no se entiende aquí. Se traduce a lo que de verdad hay que hacer.
    try {
        clienteDrive = await authenticateEscritura();
        return clienteDrive;
    } catch (error) {
        console.error('❌ [VENTAS] Sin forma de leer la carpeta:', error.message);
        throw new Error(
            'El sistema no puede leer la carpeta de VENTAS en Drive. Compártela ' +
            'como lector con la cuenta del sistema ' +
            '(inventario-calendar-reader@calendario-3g.iam.gserviceaccount.com), ' +
            'o configura GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET y ' +
            'GOOGLE_OAUTH_REFRESH_TOKEN en el servidor.'
        );
    }
};

/**
 * Qué se oculta en la carpeta de ventas: el pedido y el dinero, los formatos de
 * cierre y también los tickets (esos se consultan en el dashboard de producción,
 * no aquí).
 */
export const esExcluido = crearFiltro([
    ...PATRONES_DINERO,
    ...PATRONES_CIERRE,
    ...PATRONES_TICKET
]);

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

/**
 * Listar los archivos visibles de una carpeta de ventas.
 * @param {string} carpetaId
 * @returns {Promise<{archivos: Array, ocultos: number}>}
 */
export const listarArchivosVentas = async (carpetaId) => {
    const drive = await obtenerDrive();
    return listarArchivos({
        drive,
        carpetaId,
        esExcluido,
        maxProfundidad: MAX_PROFUNDIDAD_ARCHIVOS,
        prefijoCache: 'ventas'
    });
};

/**
 * Entregar un archivo de la carpeta de VENTAS para servirlo desde el backend.
 * @param {string} archivoId
 * @returns {Promise<Object|null>}
 */
export const obtenerArchivoVentas = async (archivoId) => {
    const drive = await obtenerDrive();
    return obtenerArchivo({
        drive,
        archivoId,
        raizId: VENTAS_FOLDER_ID,
        esExcluido,
        maxSaltos: MAX_PROFUNDIDAD + MAX_PROFUNDIDAD_ARCHIVOS + 1,
        etiqueta: 'VENTAS'
    });
};

export default {
    VENTAS_FOLDER_ID,
    buscarCarpetaVentas,
    listarArchivosVentas,
    obtenerArchivoVentas,
    limpiarCacheVentas,
    esExcluido
};
