/**
 * REABRIR MANUFACTURA POR FALLA DE INSTALACIÓN (11-nov-2026, pedido de Isa).
 *
 * Una obra en «Preparado» (etapa interna 'instalacion') cuya instalación no quedó: el día de la instalación la hora se
 * pinta en rojo oscuro en el calendario (FALLA) y el comentario de la celda dice por qué. Producción sube el ajuste y la
 * Manufactura de esa obra tiene que volver a hacerse: la obra regresa a 'produccion' con Manufactura pendiente.
 *
 * Reglas:
 *  · Solo obras en Preparado, y solo si su ÚLTIMA instalación está marcada como FALLA en el calendario (la misma regla
 *    del aviso «Falla en la instalación · reprogramar» de Preparados). Sin falla no se reabre.
 *  · El motivo no se le pide a nadie: es el comentario de la falla en el calendario. Quien llama desde otro sistema
 *    (la acción de Sofía) puede mandar otro; el del calendario se guarda igual.
 *  · Nada se borra: los sellos que se quitan (Manufactura terminada, Preparado) quedan en el historial de reaperturas
 *    (produccion_proyectos.reaperturas), junto con el motivo, la fecha de la falla, quién y desde dónde.
 *  · Herrería, Diseño, Compras y Producción se quedan como estaban.
 *
 * La usan el botón del tablero (POST /api/produccion/:id/reabrir-manufactura) y la puerta entre sistemas
 * (POST /api/sistemas/v1/produccion/reabrir-manufactura, alcance «produccion.reabrir»). La lista de Preparados que lee
 * Sofía (GET /api/sistemas/v1/produccion/preparados, 12-nov-2026) dice con estas MISMAS reglas (impedimentoDeObra,
 * SIN_FALLA y la falla del calendario) qué obra se puede reabrir, sin escribir nada.
 */
import { sequelize } from '../config/database.js';
import { ProduccionProyecto } from '../models/index.js';
import { leerCitasCercanas, leerCitasMesAnterior, proyectosAbiertos, fallaDeInstalacion } from './fechaInstalacion.service.js';

export const MAX_MOTIVO = 500;
const MOTIVO_SIN_NOTA = 'Falla en la instalación (sin comentario en el calendario)';

/** Error con el código HTTP que le toca. */
export class ErrorReapertura extends Error {
    constructor(codigo, mensaje) {
        super(mensaje);
        this.codigo = codigo;
    }
}
const falla = (codigo, mensaje) => { throw new ErrorReapertura(codigo, mensaje); };

/** Un id como número, o null («abc» o «1.5» no llegan a la base). */
export const idProyecto = (v) => {
    const t = String(v ?? '').trim();
    return /^\d{1,10}$/.test(t) && Number(t) > 0 ? Number(t) : null;
};

/** MTO y GTIA no extensivos van directo a Preparado: no tienen producción que reabrir. */
export const usaTimelineSimplificado = (p) => {
    const tipo = String(p?.tipo_proyecto || '').toUpperCase();
    return ((tipo === 'MTO' || tipo === 'GTIA') && !p.es_extensivo) || !!p?.es_premium;
};

export const SIN_FALLA = 'La última instalación de esta obra no está marcada como FALLA en el calendario: no se reabre Manufactura.';

/**
 * Por qué no se reabre esta obra ANTES de mirar el calendario: { codigo, mensaje }, o null si por la obra sí se puede
 * (falta la falla del calendario). Puro: lo usan reabrirManufacturaPorFalla y la lista de Preparados que lee Sofía.
 */
export const impedimentoDeObra = (proyecto) => {
    if (!proyecto || proyecto.activo === false) return { codigo: 404, mensaje: 'Proyecto no encontrado' };
    if (proyecto.etapa_actual !== 'instalacion') {
        return { codigo: 409, mensaje: 'Solo se reabre Manufactura de una obra que está en Preparado (instalación).' };
    }
    if (usaTimelineSimplificado(proyecto)) {
        return { codigo: 409, mensaje: 'Esta obra no pasa por producción (MTO, garantía o premium): no hay Manufactura que reabrir.' };
    }
    return null;
};

/** La falla de una obra con las citas y las obras abiertas ya leídas (la obra se suma si no está entre las abiertas). */
const fallaConAbiertas = (proyecto, abiertos, citas) => {
    const proyectos = abiertos.some(p => p.id === proyecto.id) ? abiertos : [...abiertos, proyecto];
    return fallaDeInstalacion(proyecto, proyectos, citas);
};

/** La falla de la obra según el calendario (mes anterior completo, el en curso y el siguiente). */
export const leerFallaDelCalendario = async (proyecto) => {
    const [anteriores, cercanas, abiertos] = await Promise.all([leerCitasMesAnterior(), leerCitasCercanas(), proyectosAbiertos()]);
    return fallaConAbiertas(proyecto, abiertos, [...anteriores, ...cercanas]);
};

/**
 * Lo mismo que leerFallaDelCalendario para varias obras, con UNA lectura del calendario y de las obras abiertas (la lista
 * de Preparados que lee Sofía, 12-nov-2026). Lanza si el calendario no se puede leer.
 * @returns {Promise<Map<number, { falla: boolean, fecha: string|null, nota: string|null }>>}
 */
export const leerFallasDelCalendario = async (proyectos) => {
    if (!proyectos?.length) return new Map();
    const [anteriores, cercanas, abiertos] = await Promise.all([leerCitasMesAnterior(), leerCitasCercanas(), proyectosAbiertos()]);
    const citas = [...anteriores, ...cercanas];
    return new Map(proyectos.map(p => [p.id, fallaConAbiertas(p, abiertos, citas)]));
};

const texto = (v) => {
    const t = String(v ?? '').replace(/\s+/g, ' ').trim();
    return t ? t.slice(0, MAX_MOTIVO) : null;
};
const iso = (d) => (d instanceof Date ? d.toISOString() : d || null);

/**
 * @param {number|string} id - id del proyecto de producción
 * @param {object} [ctx] - { usuarioId, quien, origen ('web' | sistema), motivo (opcional, solo otros sistemas) }
 *        y, para las pruebas, buscar / leerFalla / enTransaccion / anotar / ahora.
 * @returns {{ proyecto, reapertura }}
 */
export const reabrirManufacturaPorFalla = async (id, ctx = {}) => {
    const {
        usuarioId = null, quien = null, origen = 'web', motivo = null, ahora = new Date(),
        buscar = (n) => ProduccionProyecto.findByPk(n),
        leerFalla = leerFallaDelCalendario,
        enTransaccion = (fn) => sequelize.transaction(fn),
        anotar = (n, entrada, opciones) => ProduccionProyecto.anotarReapertura(n, entrada, opciones)
    } = ctx;

    const n = idProyecto(id);
    const proyecto = n ? await buscar(n) : null;
    const impedimento = impedimentoDeObra(proyecto);
    if (impedimento) falla(impedimento.codigo, impedimento.mensaje);

    let calendario;
    try {
        calendario = await leerFalla(proyecto);
    } catch (e) {
        console.error(`[reabrir manufactura] no se pudo leer el calendario para «${proyecto.nombre}»:`, e.message);
        falla(503, 'No se pudo leer el calendario para revisar la falla de instalación. Intenta de nuevo en un momento.');
    }
    if (!calendario?.falla) falla(409, SIN_FALLA);

    const motivoCalendario = texto(calendario.nota);
    const reapertura = {
        cuando: ahora.toISOString(),
        area: 'manufactura',
        de: 'instalacion',
        a: 'produccion',
        motivo: texto(motivo) || motivoCalendario || MOTIVO_SIN_NOTA,
        motivoCalendario,
        fechaFalla: calendario.fecha || null,
        quien: quien || null,
        usuarioId: usuarioId || null,
        origen,
        // Lo que se quita, para no perderlo
        antes: {
            manufactura_completado_en: iso(proyecto.manufactura_completado_en),
            manufactura_completado_por: proyecto.manufactura_completado_por ?? null,
            instalacion_completado_en: iso(proyecto.instalacion_completado_en),
            instalacion_completado_por: proyecto.instalacion_completado_por ?? null
        }
    };

    await enTransaccion(async (transaction) => {
        await proyecto.reabrirManufactura({ transaction });
        await anotar(proyecto.id, reapertura, { transaction });
    });

    console.log(`⏪ Manufactura reabierta por falla de instalación en "${proyecto.nombre}" (${origen}): ${reapertura.motivo}`);
    return { proyecto, reapertura };
};
