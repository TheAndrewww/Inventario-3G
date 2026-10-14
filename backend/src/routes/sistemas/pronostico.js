/**
 * C7 · PLA-17 — POST /api/sistemas/v1/produccion/pronostico (origen «finanzas», alcance «produccion.pronostico»).
 *
 * Julia (FIN-11, en recordatorios.js donde ya interpreta la respuesta; bandera PRONOSTICO_A_PLANTA) manda aquí el sí o
 * el no de Producción a «¿se completa hoy?», con el ID del proyecto que ya trae la agenda de Planta
 * (/api/avisos-whatsapp/produccion/agenda → `id`). Planta solo lo MUESTRA: no cierra nada ni mueve etapas.
 *
 * Cuerpo (contrato §4.4 del plan):
 *   { proyectoId, respuesta: "si"|"no", motivo?, fechaPropuesta? (AAAA-MM-DD o el texto que dijo), autor,
 *     preguntadoEn (ISO), contestadoEn (ISO) }
 * Respuestas: 201 { ok, proyectoId, respuesta, texto, guardado: true } · 200 { ok, guardado: false } si ya había una
 * respuesta más nueva · 404 si no existe el proyecto · 400 { error } si falta o sobra algo.
 * Se muestra: SÍ → «Confirmado por WhatsApp (14:52)»; NO → «Reagendar: motivo · fecha».
 */
import { isoMexico } from '../../utils/revisarConfig.js';
import { sinTelefonos } from './bitacora.js';

const FUTURO_MS = 5 * 60 * 1000;
const DIA_MX = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' });
const HORA_MX = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false });
const DIA_HORA_MX = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const DIA_CORTO = new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const sinPuntos = (t) => t.replace(/\./g, '');

/** El texto que se ve en el tablero, la TV y (VEN-18) la tarjeta Producción del asesor. */
export const textoPronostico = (p, ahora = new Date()) => {
    if (!p) return null;
    if (p.respuesta === 'si') {
        const c = new Date(p.contestadoEn);
        const hora = DIA_MX.format(c) === DIA_MX.format(ahora) ? HORA_MX.format(c) : sinPuntos(DIA_HORA_MX.format(c));
        return `Confirmado por WhatsApp (${hora})`;
    }
    const f = String(p.fechaPropuesta || '').trim();
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(f) ? sinPuntos(DIA_CORTO.format(new Date(`${f}T12:00:00Z`))) : (f || 'sin fecha');
    return `Reagendar: ${p.motivo || 'sin motivo'} · ${fecha}`;
};

const texto = (v, max) => {
    if (v === undefined || v === null || v === '') return { valor: null };
    if (typeof v !== 'string' || v.trim().length > max) return { error: true };
    return { valor: v.trim() || null };
};

/** Revisa el cuerpo; devuelve { errores } o { datos }. Exportada para las pruebas. */
export const leerPronostico = (b, ahora = new Date()) => {
    const errores = [];
    const proyectoId = typeof b?.proyectoId === 'number' ? b.proyectoId : (/^\d+$/.test(String(b?.proyectoId ?? '')) ? Number(b.proyectoId) : NaN);
    if (!Number.isInteger(proyectoId) || proyectoId <= 0) errores.push('«proyectoId» debe ser el id del proyecto de Planta');
    const r = String(b?.respuesta ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!['si', 'no'].includes(r)) errores.push('«respuesta» debe ser si o no');
    const motivo = texto(b?.motivo, 300);
    if (motivo.error) errores.push('«motivo» debe ser texto de hasta 300 caracteres');
    const fechaPropuesta = texto(b?.fechaPropuesta, 120);
    if (fechaPropuesta.error) errores.push('«fechaPropuesta» debe ser texto de hasta 120 caracteres');
    const autor = texto(b?.autor, 60);
    if (autor.error || !autor.valor) errores.push('Falta «autor» (hasta 60 caracteres)');
    const fecha = (v) => (typeof v === 'string' ? new Date(v) : null);
    const preguntado = fecha(b?.preguntadoEn);
    const contestado = fecha(b?.contestadoEn);
    if (!preguntado || Number.isNaN(preguntado.getTime())) errores.push('«preguntadoEn» debe ser una fecha ISO');
    if (!contestado || Number.isNaN(contestado.getTime())) errores.push('«contestadoEn» debe ser una fecha ISO');
    else if (contestado.getTime() > ahora.getTime() + FUTURO_MS) errores.push('«contestadoEn» está en el futuro');
    if (preguntado && contestado && !Number.isNaN(preguntado.getTime()) && !Number.isNaN(contestado.getTime()) && preguntado.getTime() > contestado.getTime() + FUTURO_MS) {
        errores.push('«preguntadoEn» es después de «contestadoEn»');
    }
    if (errores.length) return { errores };
    return {
        errores: [],
        datos: {
            proyectoId,
            pronostico: {
                respuesta: r,
                motivo: r === 'no' && motivo.valor ? sinTelefonos(motivo.valor) : null,
                fechaPropuesta: r === 'no' ? fechaPropuesta.valor : null,
                autor: autor.valor,
                preguntadoEn: isoMexico(preguntado),
                contestadoEn: isoMexico(contestado),
                recibido: isoMexico(ahora)
            }
        }
    };
};

/** Guarda la respuesta. Devuelve { codigo, cuerpo } para la puerta. */
export const registrarPronostico = async (cuerpo) => {
    const { errores, datos } = leerPronostico(cuerpo);
    if (errores.length) return { codigo: 400, cuerpo: { error: `No se guardó: ${errores.join('; ')}.` } };
    const { ProduccionProyecto } = await import('../../models/index.js');
    const proyecto = await ProduccionProyecto.findByPk(datos.proyectoId, { attributes: ['id'] });
    if (!proyecto) return { codigo: 404, cuerpo: { error: `No existe el proyecto ${datos.proyectoId} en Planta.` } };
    const guardado = await ProduccionProyecto.guardarPronostico(datos.proyectoId, datos.pronostico);
    if (!guardado) return { codigo: 200, cuerpo: { ok: true, proyectoId: datos.proyectoId, guardado: false, motivo: 'Ya había una respuesta más nueva para ese proyecto.' } };
    return { codigo: 201, cuerpo: { ok: true, proyectoId: datos.proyectoId, respuesta: datos.pronostico.respuesta, texto: textoPronostico(datos.pronostico), guardado: true } };
};

/** Lo que el tablero suma a cada proyecto (sin el autor: la TV y dashboard-publico no piden sesión). */
export const pronosticoParaTablero = (p, ahora = new Date()) => (p ? {
    respuesta: p.respuesta,
    texto: textoPronostico(p, ahora),
    motivo: p.motivo || null,
    fechaPropuesta: p.fechaPropuesta || null,
    preguntadoEn: p.preguntadoEn || null,
    contestadoEn: p.contestadoEn || null
} : null);
