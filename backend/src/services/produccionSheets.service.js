import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProduccionProyecto } from '../models/index.js';
import { Op } from 'sequelize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración del Google Sheet de Producción
const SPREADSHEET_ID = '1-F2qIlbPdUUxu8Fb0ok1Y15eQk2R1yRYN70l8vBxugk';

// Meses en español
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

/**
 * Autenticar con Google Sheets API usando Service Account
 */
const authenticate = async () => {
    try {
        let authConfig;

        // En producción, usar variable de entorno
        if (process.env.GOOGLE_CREDENTIALS_JSON) {
            const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
            authConfig = {
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
            };
        }
        // En desarrollo, usar archivo local
        else {
            authConfig = {
                keyFile: path.join(__dirname, '../../google-credentials.json'),
                scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
            };
        }

        const auth = new google.auth.GoogleAuth(authConfig);
        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });

        return sheets;
    } catch (error) {
        console.error('Error al autenticar con Google Sheets:', error);
        throw new Error('No se pudo autenticar con Google Sheets API');
    }
};

/**
 * Meses en español para parseo de fechas
 */
const MESES_ESPANOL = {
    'enero': 0, 'ene': 0,
    'febrero': 1, 'feb': 1,
    'marzo': 2, 'mar': 2,
    'abril': 3, 'abr': 3,
    'mayo': 4, 'may': 4,
    'junio': 5, 'jun': 5,
    'julio': 6, 'jul': 6,
    'agosto': 7, 'ago': 7,
    'septiembre': 8, 'sep': 8, 'sept': 8,
    'octubre': 9, 'oct': 9,
    'noviembre': 10, 'nov': 10,
    'diciembre': 11, 'dic': 11
};

/**
 * Parsear fecha en múltiples formatos:
 * - dd/mm/yyyy (02/01/2026)
 * - dd MES yyyy (02 enero 2026)
 * - dd-MES-yyyy (02-enero-2026)
 */
const parsearFecha = (fechaStr) => {
    if (!fechaStr) return null;

    const fechaLimpia = fechaStr.toString().trim().toLowerCase();

    // Formato dd/mm/yyyy o dd-mm-yyyy
    const partesSlash = fechaLimpia.split(/[\/\-]/);
    if (partesSlash.length === 3 && !isNaN(partesSlash[1])) {
        const dia = parseInt(partesSlash[0]);
        const mes = parseInt(partesSlash[1]) - 1;
        let anio = parseInt(partesSlash[2]);
        if (anio < 100) anio += 2000;

        const fecha = new Date(anio, mes, dia);
        if (!isNaN(fecha.getTime())) {
            return fecha.toISOString().split('T')[0];
        }
    }

    // Formato "dd MES yyyy" o "dd-MES-yyyy" (español)
    // Ejemplos: "02 enero 2026", "15-febrero-2026"
    const regexEspanol = /^(\d{1,2})[\s\-]+([a-záéíóú]+)[\s\-]+(\d{4})$/i;
    const matchEspanol = fechaLimpia.match(regexEspanol);

    if (matchEspanol) {
        const dia = parseInt(matchEspanol[1]);
        const mesTexto = matchEspanol[2].toLowerCase();
        const anio = parseInt(matchEspanol[3]);

        const mes = MESES_ESPANOL[mesTexto];

        if (mes !== undefined) {
            const fecha = new Date(anio, mes, dia);
            if (!isNaN(fecha.getTime())) {
                return fecha.toISOString().split('T')[0];
            }
        }
    }

    // Intentar parseo directo como último recurso
    const fechaDirecta = new Date(fechaLimpia);
    if (!isNaN(fechaDirecta.getTime())) {
        return fechaDirecta.toISOString().split('T')[0];
    }

    return null;
};

/**
 * Leer proyectos de producción del mes actual
 * @param {string} mes - Nombre del mes (ENERO, FEBRERO, etc.)
 */
export const leerProyectosProduccion = async (mes = null) => {
    try {
        const sheets = await authenticate();

        // Si no se especifica mes, usar el actual
        if (!mes) {
            const ahora = new Date();
            mes = MESES[ahora.getMonth()];
        }

        console.log(`📊 Leyendo proyectos de producción del mes: ${mes}`);

        // Estructura del spreadsheet:
        // Columna B: Nombre del proyecto
        // Columna C: Fecha de ingreso
        // Columna D: Fecha de entrega máxima
        // Columna E: Check de entregado
        // Columna J: EXTENSIVO (para MTO)
        // Columna K: Tipo de proyecto
        // Datos desde fila 6

        const range = `${mes}!B6:K200`; // Leer un rango amplio

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
        });

        const rows = response.data.values || [];

        if (rows.length === 0) {
            console.log(`⚠️ No se encontraron proyectos en el mes: ${mes}`);
            return {
                success: true,
                data: [],
                mes,
                total: 0
            };
        }

        const proyectos = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const nombre = row[0]?.toString().trim(); // Columna B (índice 0 en nuestro rango)

            // Saltar filas vacías o encabezados
            if (!nombre || nombre.length < 3) continue;

            // Ignorar filas que parecen ser encabezados
            if (nombre.toUpperCase() === 'NOMBRE' || nombre.toUpperCase() === 'PROYECTO') continue;

            const fechaIngreso = parsearFecha(row[1]); // Columna C
            const fechaEntrega = parsearFecha(row[2]); // Columna D
            const entregadoCheck = row[3]?.toString().trim(); // Columna E
            const extensivoFlag = row[8]?.toString().trim().toUpperCase() || ''; // Columna J (índice 8)
            const tipoProyecto = row[9]?.toString().trim() || ''; // Columna K (índice 9)

            // Determinar si está entregado
            const estaEntregado = entregadoCheck && (
                entregadoCheck.toUpperCase() === 'TRUE' ||
                entregadoCheck.toUpperCase() === 'SI' ||
                entregadoCheck.toUpperCase() === 'SÍ' ||
                entregadoCheck === '✓' ||
                entregadoCheck === 'X' ||
                entregadoCheck === 'x'
            );

            // Determinar si es EXTENSIVO (solo aplica para MTO)
            const esExtensivo = extensivoFlag === 'EXTENSIVO';

            const proyecto = {
                nombre,
                fechaIngreso,
                fechaEntrega,
                estaEntregado,
                tipoProyecto,
                esExtensivo,
                filaOriginal: i + 6, // Para referencia (fila real en el sheet)
                spreadsheetRowId: `${mes}_${i + 6}` // ID único para sincronización
            };

            proyectos.push(proyecto);
        }

        console.log(`✅ Proyectos encontrados: ${proyectos.length}`);

        return {
            success: true,
            data: proyectos,
            mes,
            total: proyectos.length
        };

    } catch (error) {
        console.error('❌ Error al leer proyectos de producción:', error);

        if (error.message?.includes('Unable to parse range')) {
            throw new Error(`La pestaña "${mes}" no existe en el Google Sheet de producción`);
        }

        throw new Error(`Error al leer proyectos: ${error.message}`);
    }
};

/**
 * Sincronizar proyectos del spreadsheet con la base de datos
 * @param {string} mes - Mes a sincronizar (opcional, por defecto el actual)
 */
export const sincronizarConDB = async (mes = null) => {
    try {
        // Leer proyectos del spreadsheet
        const resultado = await leerProyectosProduccion(mes);

        if (!resultado.success || resultado.data.length === 0) {
            return {
                success: true,
                message: 'No hay proyectos para sincronizar',
                creados: 0,
                actualizados: 0,
                total: 0
            };
        }

        let creados = 0;
        let actualizados = 0;

        for (const proyecto of resultado.data) {
            // Buscar si ya existe por spreadsheet_row_id
            const existente = await ProduccionProyecto.findOne({
                where: { spreadsheet_row_id: proyecto.spreadsheetRowId }
            });

            if (existente) {
                // Actualizar si cambió algo importante
                const cambios = {};

                if (existente.nombre !== proyecto.nombre) {
                    cambios.nombre = proyecto.nombre;
                }

                // Actualizar fecha_entrada si existe en el sheet y es diferente o estaba vacía
                if (proyecto.fechaIngreso && existente.fecha_entrada !== proyecto.fechaIngreso) {
                    cambios.fecha_entrada = proyecto.fechaIngreso;
                }

                // Actualizar fecha_limite si existe en el sheet y es diferente o estaba vacía
                if (proyecto.fechaEntrega && existente.fecha_limite !== proyecto.fechaEntrega) {
                    cambios.fecha_limite = proyecto.fechaEntrega;
                }

                if (proyecto.estaEntregado && existente.etapa_actual !== 'completado') {
                    cambios.etapa_actual = 'completado';
                    cambios.fecha_completado = new Date();
                }

                // Actualizar tipo_proyecto si cambió
                if (proyecto.tipoProyecto && existente.tipo_proyecto !== proyecto.tipoProyecto.toUpperCase()) {
                    cambios.tipo_proyecto = proyecto.tipoProyecto.toUpperCase();
                }

                // Actualizar es_extensivo si cambió
                if (existente.es_extensivo !== proyecto.esExtensivo) {
                    cambios.es_extensivo = proyecto.esExtensivo;
                }

                if (Object.keys(cambios).length > 0) {
                    await existente.update(cambios);
                    actualizados++;
                    console.log(`📝 Actualizado: "${proyecto.nombre}" - Cambios: ${Object.keys(cambios).join(', ')}`);
                }
            } else {
                // Crear nuevo proyecto
                await ProduccionProyecto.create({
                    nombre: proyecto.nombre,
                    fecha_entrada: proyecto.fechaIngreso,
                    fecha_limite: proyecto.fechaEntrega,
                    etapa_actual: proyecto.estaEntregado ? 'completado' : 'diseno',
                    spreadsheet_row_id: proyecto.spreadsheetRowId,
                    tipo_proyecto: proyecto.tipoProyecto ? proyecto.tipoProyecto.toUpperCase() : null,
                    es_extensivo: proyecto.esExtensivo,
                    prioridad: 3, // Prioridad normal por defecto
                    activo: true
                });
                creados++;
                console.log(`✨ Creado: "${proyecto.nombre}" (${proyecto.tipoProyecto || 'sin tipo'})`);
            }
        }

        console.log(`🔄 Sincronización completada: ${creados} creados, ${actualizados} actualizados`);

        return {
            success: true,
            message: `Sincronización completada`,
            mes: resultado.mes,
            creados,
            actualizados,
            total: resultado.data.length
        };

    } catch (error) {
        console.error('❌ Error al sincronizar:', error);
        throw error;
    }
};

/**
 * Obtener lista de meses disponibles en el spreadsheet
 */
export const obtenerMesesDisponibles = async () => {
    try {
        const sheets = await authenticate();

        const response = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });

        const hojas = response.data.sheets.map(sheet => sheet.properties.title);

        // Filtrar solo los que parecen ser meses
        const mesesEncontrados = hojas.filter(hoja =>
            MESES.includes(hoja.toUpperCase())
        );

        return {
            success: true,
            data: mesesEncontrados,
            todasLasHojas: hojas
        };

    } catch (error) {
        console.error('Error al obtener meses:', error);
        throw error;
    }
};

export default {
    leerProyectosProduccion,
    sincronizarConDB,
    obtenerMesesDisponibles
};
