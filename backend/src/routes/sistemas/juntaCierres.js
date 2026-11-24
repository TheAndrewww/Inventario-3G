import { ProduccionProyecto, CampanaControl } from '../../models/index.js';

/**
 * Lo que Carla (Operación) cierra al colgar la junta (23-nov, regla del jefe: «si Carla queda en cerrar, debe cerrar»).
 * Hasta hoy el análisis de la llamada apuntaba los cierres y las marcas de campaña y nadie los hacía.
 *
 *   POST /api/sistemas/v1/produccion/cerrar-etapa
 *       { proyectoId, etapa: manufactura | herreria | herreria_armado | herreria_pintado | todo, quien, motivo? }
 *       → { ok, proyectoId, proyecto, cerradas: [etapa], yaEstaban: [etapa], etapa (la del proyecto), esperaCalidad? }
 *     Lo mismo que el botón de la terminal (completarSubEtapaProduccion + el aviso al grupo de Producción). «todo» cierra
 *     las áreas que la obra lleva y faltan. Lo que ya estaba cerrado no es error (`yaEstaban`).
 *
 *   POST /api/sistemas/v1/campana/marcar
 *       { area, nota, fecha: AAAA-MM-DD, quien }
 *       → { ok, year, quarter, week, area, status: 'bad', nota, ya }
 *     Una «✗» en la semana ISO de esa fecha, con la nota (si la celda ya tenía nota, se suma). La misma nota dos veces: `ya`.
 *
 * Alcances: produccion.cerrar / campana.marcar, o las de los tickets de la junta (almacen.tickets o almacen.solicitar), las que
 * Operación ya tiene para cerrar lo que Charly confirma en la llamada.
 */

export const ALCANCE_CIERRE = 'produccion.cerrar';
export const ALCANCE_CAMPANA = 'campana.marcar';
export const ETAPAS_CIERRE = ['manufactura', 'herreria', 'herreria_armado', 'herreria_pintado', 'todo'];
export const AREAS_CAMPANA = ['ventas', 'ventas_dlba', 'ventas_vrj', 'diseno', 'manufactura', 'herreria', 'equipo1', 'equipo2', 'equipo3', 'equipo4', 'operacion', 'logistica', 'almacen', 'calidad'];

const texto = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

/** Revisa la petición de cierre. Pura. */
export const leerCierreEtapa = (b) => {
    const id = Number(b?.proyectoId);
    if (!Number.isInteger(id) || id <= 0) return { error: 'Falta «proyectoId» (el de en-curso).' };
    const etapa = texto(b?.etapa, 30).toLowerCase();
    if (!ETAPAS_CIERRE.includes(etapa)) return { error: `«etapa» debe ser ${ETAPAS_CIERRE.join(', ')}.` };
    const quien = texto(b?.quien, 80);
    if (!quien) return { error: 'Falta «quien».' };
    return { proyectoId: id, etapa, quien, motivo: texto(b?.motivo, 300) || null };
};

const hecha = (p, s) => (s === 'manufactura' ? p.manufactura_completado
    : s === 'herreria' ? p.herreria_completado
        : s === 'herreria_armado' ? p.herreria_armado_completado || p.herreria_completado
            : p.herreria_pintado_completado || p.herreria_completado);
const lleva = (p, s) => (s === 'manufactura' ? p.tiene_manufactura : p.tiene_herreria);

/** Qué sub-etapas hay que cerrar y cuáles ya estaban. Pura. */
export function planDeCierre(p, etapa) {
    const pedidas = etapa === 'todo' ? ['manufactura', 'herreria'].filter((s) => lleva(p, s)) : [etapa];
    const noLleva = pedidas.filter((s) => !lleva(p, s));
    const aplican = pedidas.filter((s) => lleva(p, s));
    return { cerrar: aplican.filter((s) => !hecha(p, s)), yaEstaban: aplican.filter((s) => hecha(p, s)), noLleva };
}

async function avisarReal(datos) {
    const { avisarCambioDeEtapa } = await import('../../controllers/produccion.controller.js');
    return avisarCambioDeEtapa(datos);
}

/** Cierra. `m` permite cambiar el modelo y el aviso en las pruebas. Devuelve { codigo, cuerpo }. */
export async function cerrarEtapa(cuerpo, m = { ProduccionProyecto, avisar: avisarReal }) {
    const d = leerCierreEtapa(cuerpo);
    if (d.error) return { codigo: 400, cuerpo: { error: d.error } };
    const p = await m.ProduccionProyecto.findByPk(d.proyectoId);
    if (!p || p.activo === false) return { codigo: 404, cuerpo: { error: `No hay una obra activa con el proyectoId ${d.proyectoId}.` } };
    const plan = planDeCierre(p, d.etapa);
    if (plan.noLleva.length && d.etapa !== 'todo') {
        return { codigo: 409, cuerpo: { error: `«${p.nombre}» no lleva ${plan.noLleva.join(' ni ')}.`, proyecto: p.nombre } };
    }
    if (d.etapa === 'todo' && !plan.cerrar.length && !plan.yaEstaban.length) {
        return { codigo: 409, cuerpo: { error: `«${p.nombre}» no lleva manufactura ni herrería.`, proyecto: p.nombre } };
    }
    const cerradas = [];
    let esperaCalidad = false;
    for (const s of plan.cerrar) {
        const previa = p.etapa_actual;
        const r = await p.completarSubEtapaProduccion(s, null);
        cerradas.push(s);
        if (r.esperaCalidad) esperaCalidad = true;
        await m.avisar({ proyecto: p, etapa: s, etapaNueva: r.proyecto.etapa_actual, etapaPrevia: r.autoAvanzado ? 'produccion' : previa, usuario: d.quien })
            .catch((err) => console.error('⚠️ No se pudo avisar el cierre de la junta:', err.message));
    }
    console.log(`[puerta] ${d.quien} cerró ${cerradas.join(', ') || 'nada (ya estaba)'} de "${p.nombre}"${d.motivo ? ` (${d.motivo})` : ''}`);
    return { codigo: 200, cuerpo: { ok: true, proyectoId: p.id, proyecto: p.nombre, cerradas, yaEstaban: plan.yaEstaban, etapa: p.etapa_actual, ...(esperaCalidad ? { esperaCalidad: true } : {}) } };
}

/** Semana ISO (lunes a domingo) y su año, como la pantalla del control de campaña. Pura. */
export function semanaIso(fecha) {
    const [y, mo, da] = fecha.split('-').map(Number);
    const t = new Date(Date.UTC(y, mo - 1, da));
    const dia = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dia);
    const inicio = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return { year: t.getUTCFullYear(), week: Math.ceil(((t - inicio) / 86400000 + 1) / 7) };
}
/** La celda del control: la semana 53 cae en la 52 (la pantalla tiene 52) y el trimestre va de 13 en 13. Pura. */
export function celdaDeCampana(fecha) {
    const { year, week } = semanaIso(fecha);
    const w = Math.min(Math.max(week, 1), 52);
    return { year, week: w, quarter: Math.min(Math.ceil(w / 13), 4) };
}

/** Revisa la petición de la marca. Pura. */
export const leerMarcaCampana = (b) => {
    const area = texto(b?.area, 30).toLowerCase();
    if (!AREAS_CAMPANA.includes(area)) return { error: `«area» debe ser una de: ${AREAS_CAMPANA.join(', ')}.` };
    const nota = texto(b?.nota, 500);
    if (!nota) return { error: 'Falta «nota».' };
    const fecha = texto(b?.fecha, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(`${fecha}T12:00:00Z`))) return { error: '«fecha» debe ser AAAA-MM-DD.' };
    const quien = texto(b?.quien, 80);
    if (!quien) return { error: 'Falta «quien».' };
    return { area, nota, fecha, quien };
};

/** Marca ✗. `m` permite cambiar el modelo en las pruebas. Devuelve { codigo, cuerpo }. */
export async function marcarCampana(cuerpo, m = { CampanaControl }) {
    const d = leerMarcaCampana(cuerpo);
    if (d.error) return { codigo: 400, cuerpo: { error: d.error } };
    const c = celdaDeCampana(d.fecha);
    const donde = { year: c.year, quarter: c.quarter, area: d.area, week: c.week };
    const previa = await m.CampanaControl.findOne({ where: donde });
    const notaPrevia = String(previa?.note ?? '').trim();
    // 24-nov (jefe): en el control de campaña se escribe en MAYÚSCULAS. Si la misma nota ya estaba en minúsculas, se
    // reescribe en mayúsculas en su lugar (no se repite).
    const nueva = d.nota.toLocaleUpperCase('es-MX');
    const i = notaPrevia.toLocaleUpperCase('es-MX').indexOf(nueva);
    const ya = previa?.status === 'bad' && i >= 0 && notaPrevia.slice(i, i + nueva.length) === nueva;
    const nota = ya ? notaPrevia
        : i >= 0 ? `${notaPrevia.slice(0, i)}${nueva}${notaPrevia.slice(i + nueva.length)}`
            : (notaPrevia ? `${notaPrevia}\n• ${nueva}` : nueva).slice(0, 4000);
    if (!ya) await m.CampanaControl.upsert({ ...donde, status: 'bad', note: nota });
    console.log(`[puerta] ${d.quien} marcó ✗ ${d.area} semana ${c.week}${ya ? ' (ya estaba)' : ''}`);
    return { codigo: 200, cuerpo: { ok: true, ...c, area: d.area, status: 'bad', nota, ya } };
}
