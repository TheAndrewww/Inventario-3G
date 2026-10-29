import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProduccionProyecto } from '../models/index.js';
import { Op } from 'sequelize';
import {
    empatePorObra, columnaId3G, ultimaColumnaConEncabezado, letraColumna, renglonesBK, idsPorRenglon, guardarObraIdProyecto,
    obraIdsDeMes
} from './obraId.service.js';
import { calidadDetieneCierre, proyectoCerradoPorElAval } from './calidad.service.js';

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
export const leerProyectosProduccion = async (mes = null, opciones = {}) => {
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

        // C1 · PLA-19: con EMPATE_POR_OBRA la lectura llega hasta la última columna con encabezado (Sheets corta lo
        // vacío) y «ID 3G» se busca por su nombre; B a K se arman tal cual los manda Sheets con B6:K200. Apagada, la
        // lectura de siempre.
        const conId = opciones.conId ?? empatePorObra();
        const lectura = await leerPestana(sheets, mes, conId);
        const rows = lectura.rows;

        if (rows.length === 0) {
            console.log(`⚠️ No se encontraron proyectos en el mes: ${mes}`);
            return {
                success: true,
                data: [],
                mes,
                total: 0,
                ...(conId ? { id3g: lectura.id3g } : {})
            };
        }

        const proyectos = interpretarRenglones(rows, mes, conId ? lectura.ids : null);

        console.log(`✅ Proyectos encontrados: ${proyectos.length}`);

        return {
            success: true,
            data: proyectos,
            mes,
            total: proyectos.length,
            ...(conId ? { id3g: lectura.id3g } : {})
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
 * Una pestaña del libro. Sin ID (lo de siempre): `B6:K200`. Con ID (EMPATE_POR_OBRA): una sola lectura desde A1 hasta
 * la última columna con datos (incluye la última con encabezado), la columna «ID 3G» por su encabezado y los renglones
 * B..K recortados igual que los manda Sheets con `B6:K200`.
 */
const leerPestana = async (sheets, mes, conId) => {
    if (!conId) {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${mes}!B6:K200`, // Leer un rango amplio
        });
        return { rows: response.data.values || [] };
    }
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${mes}!A1:ZZ200`,
    });
    const valores = response.data.values || [];
    const col = columnaId3G(valores);
    const { ids, invalidas, repetidos } = idsPorRenglon(valores, col.col);
    const ultima = ultimaColumnaConEncabezado(valores);
    avisarColumnaId3G(mes, col, repetidos);
    return {
        rows: renglonesBK(valores),
        ids,
        invalidas,
        repetidos,
        hastaColumna: ultima >= 0 ? letraColumna(ultima) : null,
        id3g: col.col === null ? { columna: null, motivo: col.motivo, ...(col.letras ? { columnas: col.letras } : {}) } : { columna: col.letra }
    };
};

// Un aviso en el registro cuando cambia el estado de la columna «ID 3G» de una pestaña (no cada 5 minutos).
const estadoColumnaId3G = new Map();
const avisarColumnaId3G = (mes, col, repetidos) => {
    const estado = col.col === null ? col.motivo : `ok:${col.letra}:${repetidos.length}`;
    if (estadoColumnaId3G.get(mes) === estado) return;
    estadoColumnaId3G.set(mes, estado);
    if (col.motivo === 'sin-columna') console.log(`🏷️ [ID 3G] La pestaña ${mes} no tiene la columna «ID 3G» (DUE-14): sus proyectos quedan sin ID.`);
    else if (col.motivo === 'varias') console.warn(`⚠️ [ID 3G] La pestaña ${mes} tiene más de una columna «ID 3G» (${col.letras.join(', ')}): no se lee ninguna.`);
    else console.log(`🏷️ [ID 3G] ${mes}: columna ${col.letra}${repetidos.length ? `; ${repetidos.length} ID repetido(s) no se toman` : ''}.`);
};

/**
 * Renglones (B..K, desde el renglón 6) → proyectos. Es la interpretación de siempre; con `ids` (EMPATE_POR_OBRA) cada
 * proyecto suma `obraId` (el ID 3G de su renglón o null).
 */
const interpretarRenglones = (rows, mes, ids) => {
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

            // Determinar flags de columna J — SOLO aplican cuando columna K es MTO o GTIA.
            // Para A/B/C, cualquier valor en J se ignora (siempre entran a producción).
            const tipoUpper = tipoProyecto.toUpperCase();
            const aplicaFlagJ = tipoUpper === 'MTO' || tipoUpper === 'GTIA';
            const esExtensivo = aplicaFlagJ && extensivoFlag === 'EXTENSIVO';
            const esPremium = aplicaFlagJ && extensivoFlag === 'PREMIUM';

            const proyecto = {
                nombre,
                fechaIngreso,
                fechaEntrega,
                estaEntregado,
                tipoProyecto,
                esExtensivo,
                esPremium,
                filaOriginal: i + 6, // Para referencia (fila real en el sheet)
                spreadsheetRowId: `${mes}_${i + 6}` // ID único para sincronización
            };

            // C1 · PLA-19: el ID 3G es un dato más; la llave sigue siendo «MES_fila» (A3)
            if (ids) proyecto.obraId = ids[i] || null;

            proyectos.push(proyecto);
        }

        return proyectos;
};

const conflictosAvisados = new Set();

/**
 * Recuperación de la sincronización: si ambas sub-etapas están marcadas pero la etapa no es 'instalacion' ni
 * 'completado' (= ya cerrado desde el Excel), promover a 'instalacion' (pantalla de Completados). Regresa los cambios
 * que hay que sumar (o {}).
 * 28-oct · CALIDAD_AVAL_CIERRA: una obra que espera el aval de Calidad no es un estado inconsistente; se queda en
 * producción hasta el aval. Apagada, calidadDetieneCierre contesta false sin tocar la base y todo queda como antes.
 */
export const recuperarPorSubetapas = async (existente, etapaFinalCambios, nombre = existente.nombre) => {
    const cambios = {};
    const ambasSubEtapasDone = existente.manufactura_completado && existente.herreria_completado;
    if (ambasSubEtapasDone && etapaFinalCambios !== 'instalacion' && etapaFinalCambios !== 'completado') {
        if (!existente.instalacion_completado_en && await calidadDetieneCierre(existente)) {
            if (etapaFinalCambios !== 'produccion') cambios.etapa_actual = 'produccion';
        } else if (!existente.instalacion_completado_en && await proyectoCerradoPorElAval(existente)) {
            // 29-oct · el aval ya la pasó a Preparado mientras tanto: no hay nada que recuperar
        } else {
            cambios.etapa_actual = 'instalacion';
            if (!existente.instalacion_completado_en) cambios.instalacion_completado_en = new Date();
            console.log(`🔧 Proyecto "${nombre}" tenía manufactura+herrería completas pero etapa=${etapaFinalCambios}; promoviendo a instalacion`);
        }
    }
    return cambios;
};

/**
 * Sincronizar proyectos de un solo mes con la base de datos.
 * Función interna, no exportada.
 * @param {string} mes - Nombre del mes (ENERO, FEBRERO, etc.)
 * @returns {{ creados: number, actualizados: number, total: number }}
 */
const sincronizarMes = async (mes) => {
    // C1 · PLA-19 (EMPATE_POR_OBRA): el ID 3G de cada renglón se guarda en el proyecto (dato; nunca pisa uno distinto)
    const conId = empatePorObra();
    const resultado = await leerProyectosProduccion(mes, { conId });

    if (!resultado.success || resultado.data.length === 0) {
        return { creados: 0, actualizados: 0, total: 0 };
    }

    let creados = 0;
    let actualizados = 0;
    const id3g = { guardados: 0, conflictos: 0 };
    const yaGuardados = conId ? await obraIdsDeMes(mes).catch(() => new Map()) : new Map();
    const guardarId = async (proyectoId, p) => {
        if (!conId || !p.obraId || yaGuardados.get(p.spreadsheetRowId) === p.obraId) return;
        try {
            const r = await guardarObraIdProyecto(proyectoId, p.obraId);
            if (r === 'guardado') id3g.guardados++;
            else if (r === 'conflicto' || r === 'repetido') {
                id3g.conflictos++;
                // Una vez por proyecto e ID mientras el servidor esté arriba (la sincronización corre cada 5 minutos)
                const clave = `${proyectoId}|${p.obraId}|${r}`;
                if (conflictosAvisados.has(clave)) return;
                conflictosAvisados.add(clave);
                console.warn(`⚠️ [ID 3G] "${p.nombre}" (${mes}, fila ${p.filaOriginal}): la hoja dice ${p.obraId}; no se guardó (${r === 'conflicto' ? 'el proyecto ya tiene otro ID' : 'otro proyecto activo ya tiene ese ID'}).`);
            }
        } catch (e) {
            console.error(`⚠️ [ID 3G] No se pudo guardar el ID de "${p.nombre}":`, e.message);
        }
    };

    for (const proyecto of resultado.data) {
        const existente = await ProduccionProyecto.findOne({
            where: { spreadsheet_row_id: proyecto.spreadsheetRowId }
        });

        if (existente) {
            const cambios = {};

            // Si estaba desactivado (se había quitado del sheet) y ahora reapareció,
            // reactivarlo para que vuelva al dashboard.
            if (existente.activo === false) {
                cambios.activo = true;
            }

            if (existente.nombre !== proyecto.nombre) {
                cambios.nombre = proyecto.nombre;
            }

            if (proyecto.fechaIngreso && existente.fecha_entrada !== proyecto.fechaIngreso) {
                cambios.fecha_entrada = proyecto.fechaIngreso;
            }

            if (proyecto.fechaEntrega) {
                if (existente.fecha_limite !== proyecto.fechaEntrega) {
                    cambios.fecha_limite = proyecto.fechaEntrega;
                }
            } else if (existente.fecha_limite !== null) {
                // Col D (fecha máxima de entrega) vacía / "-": limpiar la fecha
                // vieja para no seguir mostrando un residuo en el panel. La fecha
                // real, si existe, la resuelve el calendario en el frontend.
                cambios.fecha_limite = null;
                console.log(`🧹 "${proyecto.nombre}" (${mes}): col D sin fecha → limpiando fecha_limite previa (${existente.fecha_limite})`);
            }

            if (proyecto.estaEntregado && existente.etapa_actual !== 'completado') {
                cambios.etapa_actual = 'completado';
                cambios.fecha_completado = new Date();
            }

            // Si el proyecto estaba completado en la DB pero ya NO está marcado en el Excel,
            // revertir a 'diseno' para que vuelva a aparecer en el dashboard.
            if (!proyecto.estaEntregado && existente.etapa_actual === 'completado') {
                cambios.etapa_actual = 'diseno';
                cambios.fecha_completado = null;
                console.log(`⚠️ Proyecto "${proyecto.nombre}" desmarcado como completado en Excel, revirtiendo a diseño`);
            }

            // Recuperación: arreglar proyectos que quedaron en estado inconsistente (ver recuperarPorSubetapas).
            Object.assign(cambios, await recuperarPorSubetapas(existente, cambios.etapa_actual ?? existente.etapa_actual, proyecto.nombre));

            if (proyecto.tipoProyecto && existente.tipo_proyecto !== proyecto.tipoProyecto.toUpperCase()) {
                cambios.tipo_proyecto = proyecto.tipoProyecto.toUpperCase();
            }

            if (existente.es_extensivo !== proyecto.esExtensivo) {
                cambios.es_extensivo = proyecto.esExtensivo;
            }

            if (existente.es_premium !== proyecto.esPremium) {
                cambios.es_premium = proyecto.esPremium;
            }

            if (Object.keys(cambios).length > 0) {
                await existente.update(cambios);
                actualizados++;
                console.log(`📝 Actualizado: "${proyecto.nombre}" (${mes}) - Cambios: ${Object.keys(cambios).join(', ')}`);
            }
            await guardarId(existente.id, proyecto);
        } else {
            const nuevo = await ProduccionProyecto.create({
                nombre: proyecto.nombre,
                fecha_entrada: proyecto.fechaIngreso,
                fecha_limite: proyecto.fechaEntrega,
                etapa_actual: proyecto.estaEntregado ? 'completado' : 'diseno',
                spreadsheet_row_id: proyecto.spreadsheetRowId,
                tipo_proyecto: proyecto.tipoProyecto ? proyecto.tipoProyecto.toUpperCase() : null,
                es_extensivo: proyecto.esExtensivo,
                es_premium: proyecto.esPremium,
                prioridad: 3,
                activo: true
            });
            creados++;
            console.log(`✨ Creado: "${proyecto.nombre}" (${mes}) - ${proyecto.tipoProyecto || 'sin tipo'}`);
            await guardarId(nuevo.id, proyecto);
        }
    }
    if (conId && id3g.guardados) {
        console.log(`🏷️ [ID 3G] ${mes}: ${id3g.guardados} ID guardado(s), ${id3g.conflictos} sin guardar por conflicto`);
    }

    // Desactivar proyectos de ESTE mes que ya NO están en el sheet (fila borrada o
    // vaciada = proyecto cancelado/quitado). Quedan en la DB como histórico pero
    // salen de todos los dashboards. Es seguro: el early-return de arriba evita
    // ejecutar esto cuando la lectura del mes vino vacía (no desactiva en masa).
    const rowIdsEnSheet = resultado.data.map(p => p.spreadsheetRowId);
    const huerfanos = await ProduccionProyecto.findAll({
        where: {
            activo: true,
            spreadsheet_row_id: { [Op.like]: `${mes}\\_%`, [Op.notIn]: rowIdsEnSheet }
        }
    });

    let desactivados = 0;
    for (const orf of huerfanos) {
        await orf.update({ activo: false });
        desactivados++;
        console.log(`🚫 Desactivado (ya no está en el sheet): "${orf.nombre}" (${mes})`);
    }

    return { creados, actualizados, desactivados, total: resultado.data.length, ...(conId ? { id3g } : {}) };
};

/**
 * Sincronizar proyectos del spreadsheet con la base de datos.
 * - Si se pasa un mes específico, sincroniza solo esa pestaña.
 * - Si no se pasa mes, sincroniza todas las pestañas desde ENERO hasta el mes actual,
 *   de modo que los proyectos rezagados de meses anteriores también se actualizan.
 * @param {string} mes - Mes específico a sincronizar (opcional)
 */
export const sincronizarConDB = async (mes = null) => {
    try {
        // Mes específico solicitado → una sola pestaña
        if (mes) {
            console.log(`🔄 Sincronizando mes específico: ${mes}...`);
            const resultado = await sincronizarMes(mes);
            console.log(`✅ Sincronización completada (${mes}): ${resultado.creados} creados, ${resultado.actualizados} actualizados, ${resultado.desactivados} desactivados`);

            return {
                success: true,
                message: `Sincronización completada (${mes})`,
                meses: [mes],
                creados: resultado.creados,
                actualizados: resultado.actualizados,
                desactivados: resultado.desactivados,
                total: resultado.total
            };
        }

        // Sin mes → iterar desde enero hasta el mes actual
        const ahora = new Date();
        const mesActualIndex = ahora.getMonth(); // 0 = enero
        const mesesCandidatos = MESES.slice(0, mesActualIndex + 1);

        console.log(`🔄 Sincronizando meses: ${mesesCandidatos.join(', ')}...`);

        let totalCreados = 0;
        let totalActualizados = 0;
        let totalDesactivados = 0;
        let totalProyectos = 0;
        const mesesSincronizados = [];

        for (const m of mesesCandidatos) {
            try {
                const resultado = await sincronizarMes(m);
                totalCreados += resultado.creados;
                totalActualizados += resultado.actualizados;
                totalDesactivados += resultado.desactivados;
                totalProyectos += resultado.total;
                mesesSincronizados.push(m);
            } catch (error) {
                // Pestaña inexistente en el spreadsheet → se omite sin cortar el bucle
                if (error.message?.includes('no existe')) {
                    console.log(`⚠️ Pestaña "${m}" no encontrada en el spreadsheet, se omitió`);
                    continue;
                }
                throw error;
            }
        }

        console.log(`✅ Sincronización completada: ${totalCreados} creados, ${totalActualizados} actualizados, ${totalDesactivados} desactivados en ${mesesSincronizados.length} mes(es)`);

        return {
            success: true,
            message: `Sincronización completada (${mesesSincronizados.length} mes${mesesSincronizados.length !== 1 ? 'es' : ''})`,
            meses: mesesSincronizados,
            creados: totalCreados,
            actualizados: totalActualizados,
            desactivados: totalDesactivados,
            total: totalProyectos
        };

    } catch (error) {
        console.error('❌ Error al sincronizar:', error);
        throw error;
    }
};

/**
 * C1 · PLA-19 — Para el ensayo del ID 3G (solo lectura): una pestaña leída como hoy (B6:K200) y como la leería la
 * sincronización con EMPATE_POR_OBRA, y si lo de B a K salió igual. No guarda nada.
 */
export const leerMesParaEnsayoId3g = async (mes) => {
    const sheets = await authenticate();
    let hoy, ancha;
    try {
        hoy = await leerPestana(sheets, mes, false);
        ancha = await leerPestana(sheets, mes, true);
    } catch (error) {
        if (error.message?.includes('Unable to parse range')) throw new Error(`La pestaña "${mes}" no existe en el Google Sheet de producción`);
        throw error;
    }
    const deHoy = interpretarRenglones(hoy.rows, mes, null);
    const conId = interpretarRenglones(ancha.rows, mes, ancha.ids);
    const sinId = conId.map(({ obraId, ...resto }) => resto);
    const diferenciasBK = [];
    const n = Math.max(deHoy.length, sinId.length);
    for (let i = 0; i < n; i++) {
        if (JSON.stringify(deHoy[i]) !== JSON.stringify(sinId[i])) diferenciasBK.push({ renglon: (deHoy[i] || sinId[i])?.filaOriginal ?? null });
    }
    return {
        proyectos: conId,
        id3g: ancha.id3g,
        invalidas: ancha.invalidas,
        repetidos: ancha.repetidos,
        hastaColumna: ancha.hastaColumna,
        bkIgual: diferenciasBK.length === 0,
        diferenciasBK: diferenciasBK.slice(0, 20)
    };
};

/** Los meses que recorre la sincronización sin mes (de enero al mes actual). */
export const mesesDeLaSincronizacion = () => MESES.slice(0, new Date().getMonth() + 1);

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
