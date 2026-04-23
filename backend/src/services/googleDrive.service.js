import { google } from 'googleapis';
import { Readable } from 'stream';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ID de la carpeta raíz PRODUCCION en Google Drive
const PRODUCCION_FOLDER_ID = '1CsvTpQCIYpgnYn9dJoj9HqGYO-nInsok';

/**
 * Autenticar con Google Drive API usando Service Account
 */
const authenticate = async () => {
    try {
        let authConfig;

        // En producción, usar variable de entorno
        if (process.env.GOOGLE_CREDENTIALS_JSON) {
            const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
            authConfig = {
                credentials,
                scopes: [
                    'https://www.googleapis.com/auth/drive.readonly',
                    'https://www.googleapis.com/auth/drive.metadata.readonly',
                    'https://www.googleapis.com/auth/drive.file'
                ],
            };
        }
        // En desarrollo, usar archivo local
        else {
            authConfig = {
                keyFile: path.join(__dirname, '../../google-credentials.json'),
                scopes: [
                    'https://www.googleapis.com/auth/drive.readonly',
                    'https://www.googleapis.com/auth/drive.metadata.readonly',
                    'https://www.googleapis.com/auth/drive.file'
                ],
            };
        }

        const auth = new google.auth.GoogleAuth(authConfig);
        const client = await auth.getClient();
        const drive = google.drive({ version: 'v3', auth: client });

        return drive;
    } catch (error) {
        console.error('❌ Error al autenticar con Google Drive:', error);
        throw new Error('No se pudo autenticar con Google Drive API');
    }
};

/**
 * Listar subcarpetas dentro de una carpeta
 * @param {string} parentId - ID de la carpeta padre
 * @returns {Promise<Array>} - Lista de carpetas
 */
const listarSubcarpetas = async (parentId) => {
    try {
        const drive = await authenticate();

        const response = await drive.files.list({
            q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
            pageSize: 1000,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        });

        return response.data.files || [];
    } catch (error) {
        console.error('❌ Error al listar subcarpetas:', error);
        throw error;
    }
};

/**
 * Buscar carpeta de proyecto por nombre dentro de PRODUCCION
 * Busca en todas las carpetas de meses
 * @param {string} nombreProyecto - Nombre del proyecto a buscar
 * @returns {Promise<Object|null>} - Carpeta encontrada o null
 */
export const buscarCarpetaProyecto = async (nombreProyecto) => {
    try {
        const drive = await authenticate();

        // Primero obtener las carpetas de meses
        const carpetasMeses = await listarSubcarpetas(PRODUCCION_FOLDER_ID);

        // Generar variantes del nombre para búsqueda más flexible
        const normalizarNombre = (nombre) =>
            nombre
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toUpperCase()
                .replace(/\s+/g, ' ') // Colapsar múltiples espacios en uno
                .trim();

        const nombreNormalizado = normalizarNombre(nombreProyecto);

        // Crear variantes sin sufijos tipo /MTO, /GTIA, etc.
        const variantes = [nombreNormalizado];
        // Quitar "/ MTO", "/MTO", "/ GTIA", "/GTIA", "/ MTO ESTRUCTURA", etc.
        const sinSufijo = nombreNormalizado
            .replace(/\s*\/\s*(MTO|GTIA)(\s+\w+)*\s*$/i, '')
            .trim();
        if (sinSufijo && sinSufijo !== nombreNormalizado) {
            variantes.push(sinSufijo);
        }

        console.log(`🔍 Buscando carpeta Drive para: "${nombreProyecto}"`);
        console.log(`   Variantes normalizadas: [${variantes.map(v => `"${v}"`).join(', ')}]`);
        console.log(`   Carpetas de meses encontradas: ${carpetasMeses.map(c => c.name).join(', ')}`);

        // ESTRATEGIA: primero recolectamos TODAS las carpetas candidatas en todos
        // los meses (y subcarpetas MTO/GTIA), luego corremos 2 pasadas de matching:
        //   Pasada 1: match exacto — si existe en cualquier mes, gana siempre.
        //   Pasada 2: mejor substring — ranking global por cercanía de longitud.
        //
        // La alternativa ingenua (retornar en el primer mes con match) hacía que,
        // por ejemplo, "GERARDO HERNANDEZ" (tipo C, carpeta propia) cayera en
        // "GERARDO HERNÁNDEZ / GTIA" de ENERO si ese mes se escaneaba antes que
        // ABRIL.
        const todasLasCarpetas = []; // {carpeta, carpetaMes, subcarpetaName}

        for (const carpetaMes of carpetasMeses) {
            const response = await drive.files.list({
                q: `'${carpetaMes.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                fields: 'files(id, name)',
                pageSize: 500,
                supportsAllDrives: true,
                includeItemsFromAllDrives: true
            });
            const carpetasProyectos = response.data.files || [];

            // Carpetas directamente dentro del mes
            for (const carpeta of carpetasProyectos) {
                todasLasCarpetas.push({ carpeta, carpetaMes, subcarpetaName: null });
            }

            // Subcarpetas especiales tipo MANTENIMIENTO, GARANTIA
            const subcarpetasEspeciales = carpetasProyectos.filter(c => {
                const norm = normalizarNombre(c.name);
                return norm.includes('MANTENIMIENTO') || norm.includes('MTO') ||
                       norm.includes('GARANTIA') || norm.includes('GTIA');
            });

            for (const subcarpeta of subcarpetasEspeciales) {
                const subResponse = await drive.files.list({
                    q: `'${subcarpeta.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                    fields: 'files(id, name)',
                    pageSize: 500,
                    supportsAllDrives: true,
                    includeItemsFromAllDrives: true
                });
                for (const carpeta of (subResponse.data.files || [])) {
                    todasLasCarpetas.push({ carpeta, carpetaMes, subcarpetaName: subcarpeta.name });
                }
            }
        }

        const ubicacionDe = (c) => c.subcarpetaName ? `${c.carpetaMes.name}/${c.subcarpetaName}` : c.carpetaMes.name;

        // Pasada 1: match exacto (global — gana siempre, sin importar el mes)
        for (const item of todasLasCarpetas) {
            const norm = normalizarNombre(item.carpeta.name);
            if (variantes.some(v => norm === v)) {
                console.log(`✅ Carpeta encontrada (exacto): "${item.carpeta.name}" en ${ubicacionDe(item)}`);
                return { id: item.carpeta.id, name: item.carpeta.name, mes: item.carpetaMes.name };
            }
        }

        // Pasada 2: mejor substring — ranking global.
        let mejor = null;
        for (const item of todasLasCarpetas) {
            const norm = normalizarNombre(item.carpeta.name);
            for (const variante of variantes) {
                let score = 0;
                if (norm.includes(variante)) {
                    // Folder contiene la variante → preferir el folder más corto
                    score = 500 - (norm.length - variante.length);
                } else if (variante.includes(norm) && norm.length >= 6) {
                    // Variante contiene al folder → solo si folder es suficientemente largo
                    score = 100 + norm.length;
                }
                if (score > 0 && (!mejor || score > mejor.score)) {
                    mejor = { ...item, variante, score };
                }
            }
        }

        if (mejor) {
            console.log(`✅ Carpeta encontrada (substring, score=${mejor.score}): "${mejor.carpeta.name}" en ${ubicacionDe(mejor)} (variante: "${mejor.variante}")`);
            return { id: mejor.carpeta.id, name: mejor.carpeta.name, mes: mejor.carpetaMes.name };
        }

        console.log(`⚠️ No se encontró carpeta en Drive para: "${nombreProyecto}"`);
        return null;
    } catch (error) {
        console.error('❌ Error al buscar carpeta de proyecto:', error);
        throw error;
    }
};

/**
 * Clasificar archivos PDF de una carpeta según la lógica de negocio
 * - HERRERIA*.pdf → Herrería
 * - Ticket*.pdf → Ignorar
 * - Cualquier otro .pdf → Manufactura
 * @param {string} carpetaId - ID de la carpeta del proyecto
 * @returns {Promise<Object>} - Archivos clasificados
 */
export const clasificarArchivosPDF = async (carpetaId) => {
    try {
        const drive = await authenticate();

        // Listar TODOS los archivos no-carpeta. El filtrado por "es PDF" se
        // hace después en JS para cubrir mimeTypes raros y shortcuts.
        const response = await drive.files.list({
            q: `'${carpetaId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
            fields: 'files(id, name, mimeType, webViewLink, webContentLink, size, createdTime, shortcutDetails)',
            pageSize: 500,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        });

        const archivos = response.data.files || [];

        // Aceptamos como PDF relevante:
        //  - mimeType application/pdf (caso normal)
        //  - shortcut cuyo target es application/pdf
        //  - cualquier archivo cuyo nombre termine en .pdf (cubre octet-stream
        //    y otros casos de uploads desde escáner / móvil)
        const esPDFRelevante = (f) => {
            if (f.mimeType === 'application/pdf') return true;
            if (f.mimeType === 'application/vnd.google-apps.shortcut' &&
                f.shortcutDetails?.targetMimeType === 'application/pdf') return true;
            if (f.name?.toLowerCase().endsWith('.pdf')) return true;
            return false;
        };

        const resultado = {
            herreria: [],
            manufactura: [],
            ignorados: []
        };

        for (const archivo of archivos) {
            if (!esPDFRelevante(archivo)) {
                resultado.ignorados.push(`${archivo.name} [${archivo.mimeType}]`);
                continue;
            }

            // Normalizar nombre: quitar acentos y convertir a mayúsculas
            const nombreNormalizado = archivo.name
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toUpperCase();

            if (nombreNormalizado.includes('HERRERIA')) {
                resultado.herreria.push({
                    id: archivo.id,
                    nombre: archivo.name,
                    link: archivo.webViewLink,
                    linkDescarga: archivo.webContentLink,
                    tamaño: archivo.size,
                    creado: archivo.createdTime
                });

            } else if (nombreNormalizado.startsWith('TICKET')) {
                resultado.ignorados.push(archivo.name);

            } else {
                resultado.manufactura.push({
                    id: archivo.id,
                    nombre: archivo.name,
                    link: archivo.webViewLink,
                    linkDescarga: archivo.webContentLink,
                    tamaño: archivo.size,
                    creado: archivo.createdTime
                });

            }
        }

        return {
            tieneHerreria: resultado.herreria.length > 0,
            tieneManufactura: resultado.manufactura.length > 0,
            archivos: resultado
        };
    } catch (error) {
        console.error('❌ Error al clasificar archivos PDF:', error);
        throw error;
    }
};

/**
 * Obtener link de visualización/descarga de un archivo
 * @param {string} archivoId - ID del archivo en Drive
 * @returns {Promise<Object>} - Links de visualización y descarga
 */
export const obtenerLinksArchivo = async (archivoId) => {
    try {
        const drive = await authenticate();

        const response = await drive.files.get({
            fileId: archivoId,
            fields: 'id, name, webViewLink, webContentLink, mimeType'
        });

        return {
            id: response.data.id,
            nombre: response.data.name,
            linkVisualizacion: response.data.webViewLink,
            linkDescarga: response.data.webContentLink,
            // Link para embed en iframe (requiere que el archivo sea público o compartido)
            linkEmbed: `https://drive.google.com/file/d/${archivoId}/preview`
        };
    } catch (error) {
        console.error('❌ Error al obtener links de archivo:', error);
        throw error;
    }
};

/**
 * Sincronizar información de Drive para un proyecto específico
 * @param {Object} proyecto - Instancia del modelo ProduccionProyecto
 * @returns {Promise<Object>} - Resultado de la sincronización
 */
export const sincronizarProyecto = async (proyecto) => {
    try {


        // Regla: un proyecto pasa directo a Preparado (sin producción) si es
        // (MTO o GTIA) y NO es EXTENSIVO. También los MTO PREMIUM. En ese caso
        // no se busca carpeta en Drive.
        const tipoProyecto = proyecto.tipo_proyecto?.toUpperCase();
        const esMTOoGTIA = tipoProyecto === 'MTO' || tipoProyecto === 'GTIA';
        const pasaDirecto = (esMTOoGTIA && !proyecto.es_extensivo) || proyecto.es_premium;

        if (pasaDirecto) {
            await proyecto.update({
                tiene_manufactura: false,
                tiene_herreria: false,
                drive_sync_at: new Date()
            });

            return {
                success: true,
                message: proyecto.es_premium
                    ? 'Proyecto MTO PREMIUM - no requiere carpeta en Drive'
                    : `Proyecto ${tipoProyecto} (no EXTENSIVO) - no requiere carpeta en Drive`,
                proyecto: proyecto.nombre,
                tieneManufactura: false,
                tieneHerreria: false
            };
        }

        // Buscar la carpeta del proyecto (A, B, C y todos los MTO)
        const carpeta = await buscarCarpetaProyecto(proyecto.nombre);

        if (!carpeta) {
            return {
                success: false,
                message: 'Carpeta no encontrada',
                proyecto: proyecto.nombre
            };
        }

        // Clasificar archivos PDF
        const clasificacion = await clasificarArchivosPDF(carpeta.id);

        // Preparar datos para actualizar
        const datosActualizacion = {
            drive_folder_id: carpeta.id,
            tiene_manufactura: clasificacion.tieneManufactura,
            tiene_herreria: clasificacion.tieneHerreria,
            archivos_manufactura: clasificacion.archivos.manufactura,
            archivos_herreria: clasificacion.archivos.herreria,
            drive_sync_at: new Date()
        };

        // Actualizar el proyecto
        await proyecto.update(datosActualizacion);



        return {
            success: true,
            carpeta: carpeta.name,
            mes: carpeta.mes,
            tieneManufactura: clasificacion.tieneManufactura,
            tieneHerreria: clasificacion.tieneHerreria,
            totalArchivosManufactura: clasificacion.archivos.manufactura.length,
            totalArchivosHerreria: clasificacion.archivos.herreria.length
        };
    } catch (error) {
        console.error(`❌ Error al sincronizar proyecto "${proyecto.nombre}":`, error);
        return {
            success: false,
            message: error.message,
            proyecto: proyecto.nombre
        };
    }
};

/**
 * Subir un archivo PDF a una carpeta de Drive
 * @param {string} carpetaId - ID de la carpeta destino
 * @param {Buffer} pdfBuffer - Buffer del PDF
 * @param {string} fileName - Nombre del archivo
 * @returns {Promise<Object>} - Datos del archivo creado en Drive
 */
export const uploadTicket = async (carpetaId, pdfBuffer, fileName) => {
    try {
        const drive = await authenticate();
        const stream = Readable.from(pdfBuffer);

        const response = await drive.files.create({
            requestBody: {
                name: fileName,
                mimeType: 'application/pdf',
                parents: [carpetaId]
            },
            media: {
                mimeType: 'application/pdf',
                body: stream
            },
            fields: 'id, name, webViewLink',
            // Soporte para Shared Drives y carpetas compartidas
            // Esto permite que el Service Account suba archivos a carpetas
            // donde tiene permisos de edición pero no es dueño
            supportsAllDrives: true
        });

        console.log(`✅ Ticket "${fileName}" subido a Drive (carpeta ${carpetaId})`);
        return response.data;
    } catch (error) {
        console.error('❌ Error al subir ticket a Drive:', error.message);
        throw error;
    }
};

export default {
    buscarCarpetaProyecto,
    clasificarArchivosPDF,
    obtenerLinksArchivo,
    sincronizarProyecto,
    uploadTicket,
    PRODUCCION_FOLDER_ID
};
