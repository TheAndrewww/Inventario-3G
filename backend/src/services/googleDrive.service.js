import { google } from 'googleapis';
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
                    'https://www.googleapis.com/auth/drive.metadata.readonly'
                ],
            };
        }
        // En desarrollo, usar archivo local
        else {
            authConfig = {
                keyFile: path.join(__dirname, '../../google-credentials.json'),
                scopes: [
                    'https://www.googleapis.com/auth/drive.readonly',
                    'https://www.googleapis.com/auth/drive.metadata.readonly'
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
            pageSize: 1000
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
        console.log(`📁 Carpetas de meses encontradas: ${carpetasMeses.length}`);

        // Normalizar nombre para búsqueda (quitar acentos, mayúsculas)
        const nombreNormalizado = nombreProyecto
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .trim();

        // Buscar en cada carpeta de mes
        for (const carpetaMes of carpetasMeses) {
            // Buscar carpetas de proyectos dentro del mes
            const response = await drive.files.list({
                q: `'${carpetaMes.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                fields: 'files(id, name)',
                pageSize: 500
            });

            const carpetasProyectos = response.data.files || [];

            // Buscar coincidencia por nombre
            for (const carpeta of carpetasProyectos) {
                const carpetaNormalizada = carpeta.name
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toUpperCase()
                    .trim();

                // Coincidencia exacta o si el nombre está contenido
                if (carpetaNormalizada === nombreNormalizado ||
                    carpetaNormalizada.includes(nombreNormalizado) ||
                    nombreNormalizado.includes(carpetaNormalizada)) {
                    console.log(`✅ Carpeta encontrada: "${carpeta.name}" en mes "${carpetaMes.name}"`);
                    return {
                        id: carpeta.id,
                        name: carpeta.name,
                        mes: carpetaMes.name
                    };
                }
            }
        }

        console.log(`⚠️ No se encontró carpeta para proyecto: "${nombreProyecto}"`);
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

        // Listar solo archivos PDF
        const response = await drive.files.list({
            q: `'${carpetaId}' in parents and mimeType = 'application/pdf' and trashed = false`,
            fields: 'files(id, name, webViewLink, webContentLink, size, createdTime)',
            pageSize: 100
        });

        const archivos = response.data.files || [];
        console.log(`📄 PDFs encontrados: ${archivos.length}`);

        const resultado = {
            herreria: [],
            manufactura: [],
            ignorados: []
        };

        for (const archivo of archivos) {
            // Normalizar nombre: quitar acentos y convertir a mayúsculas
            const nombreNormalizado = archivo.name
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toUpperCase();

            if (nombreNormalizado.startsWith('HERRERIA')) {
                resultado.herreria.push({
                    id: archivo.id,
                    nombre: archivo.name,
                    link: archivo.webViewLink,
                    linkDescarga: archivo.webContentLink,
                    tamaño: archivo.size,
                    creado: archivo.createdTime
                });
                console.log(`  🔴 Herrería: ${archivo.name}`);
            } else if (nombreNormalizado.startsWith('TICKET')) {
                resultado.ignorados.push(archivo.name);
                console.log(`  ⏭️ Ignorado: ${archivo.name}`);
            } else {
                resultado.manufactura.push({
                    id: archivo.id,
                    nombre: archivo.name,
                    link: archivo.webViewLink,
                    linkDescarga: archivo.webContentLink,
                    tamaño: archivo.size,
                    creado: archivo.createdTime
                });
                console.log(`  🟠 Manufactura: ${archivo.name}`);
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
        console.log(`\n🔄 Sincronizando proyecto: "${proyecto.nombre}"`);

        // Buscar la carpeta del proyecto
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

        console.log(`✅ Proyecto sincronizado: Manufactura=${clasificacion.tieneManufactura}, Herrería=${clasificacion.tieneHerreria}`);

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

export default {
    buscarCarpetaProyecto,
    clasificarArchivosPDF,
    obtenerLinksArchivo,
    sincronizarProyecto,
    PRODUCCION_FOLDER_ID
};
