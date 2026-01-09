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
 * Parsear fecha en formato dd/mm/yyyy o similar
 */
const parsearFecha = (fechaStr) => {
    if (!fechaStr) return null;

    // Intentar diferentes formatos
    const fechaLimpia = fechaStr.toString().trim();

    // Formato dd/mm/yyyy
    const partes = fechaLimpia.split('/');
    if (partes.length === 3) {
        const dia = parseInt(partes[0]);
        const mes = parseInt(partes[1]) - 1; // JavaScript usa 0-11 para meses
        let anio = parseInt(partes[2]);

        // Si el año es de 2 dígitos, asumir 2000s
        if (anio < 100) anio += 2000;

        const fecha = new Date(anio, mes, dia);
        if (!isNaN(fecha.getTime())) {
            return fecha.toISOString().split('T')[0]; // Retorna YYYY-MM-DD
        }
    }

    // Intentar parseo directo
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

            const proyecto = {
                nombre,
                fechaIngreso,
                fechaEntrega,
                estaEntregado,
                tipoProyecto,
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
                if (proyecto.fechaEntrega && existente.fecha_limite !== proyecto.fechaEntrega) {
                    cambios.fecha_limite = proyecto.fechaEntrega;
                }
                if (proyecto.estaEntregado && existente.etapa_actual !== 'completado') {
                    cambios.etapa_actual = 'completado';
                    cambios.fecha_completado = new Date();
                }
                // Actualizar tipo_proyecto si cambió
                if (proyecto.tipoProyecto && existente.tipo_proyecto !== proyecto.tipoProyecto) {
                    cambios.tipo_proyecto = proyecto.tipoProyecto.toUpperCase();
                }

                if (Object.keys(cambios).length > 0) {
                    await existente.update(cambios);
                    actualizados++;
                    console.log(`📝 Actualizado: "${proyecto.nombre}"`);
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
