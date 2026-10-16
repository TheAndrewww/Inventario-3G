/**
 * C4 · PLA-16 — POST /api/sistemas/v1/ordenes/:folio/seguimiento (origen «finanzas», alcance «ordenes.seguimiento»).
 *
 * Julia (FIN-10, bandera SEGUIMIENTO_A_PLANTA) manda aquí cada cambio de estado que ya lleva en
 * requisiciones-pedidos.json. Planta solo agrega un renglón a orden_seguimiento: no cambia la orden, ni su estado, ni
 * manda ningún aviso.
 *
 * Cuerpo (contrato §4.4 del plan):
 *   { estado: "autorizada_sin_pago"|"pagada"|"pedida"|"llego"|"vencida", fecha (ISO), fechaEstimada? (AAAA-MM-DD o ISO),
 *     nota? (hasta 500) }
 * Respuestas: 201 { ok, id, orden, estado, duplicado: false, recibido } · 200 { …, duplicado: true } si ese mismo
 * renglón ya estaba · 404 { error } si no existe la orden · 400 { error } si falta o sobra algo.
 *
 * También: la historia de una orden para la pantalla (franja «Pago y pedido (Julia)») y la llegada que anota la
 * recepción de Planta con LLEGADA_CON_DATOS (paso 3).
 */
import crypto from 'crypto';
import { Op } from 'sequelize';
import OrdenSeguimiento, { ESTADOS_SEGUIMIENTO, TEXTO_ESTADO } from '../../models/OrdenSeguimiento.js';
import { isoMexico } from '../../utils/revisarConfig.js';
import { sinTelefonos } from './bitacora.js';

const FUTURO_MS = 5 * 60 * 1000;
const DIA_MX = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' });
const RE_FOLIO = /^[A-Za-z0-9][A-Za-z0-9-]{0,29}$/;
// Fotos de factura: solo las que Planta misma subió a su Cloudinary (paso 3)
export const RE_FOTO = /^https:\/\/res\.cloudinary\.com\/[\w-]+\/image\/upload\/[\w/.,-]+$/;

const huellaDe = (partes) => crypto.createHash('sha256').update(partes.map((p) => p ?? '').join('|'), 'utf8').digest('hex');

/** Revisa el cuerpo; devuelve { errores } o { datos }. Exportada para las pruebas. */
export const leerSeguimiento = (b, ahora = new Date()) => {
    const errores = [];
    const estado = String(b?.estado ?? '').trim().toLowerCase();
    if (!ESTADOS_SEGUIMIENTO.includes(estado)) errores.push(`«estado» debe ser ${ESTADOS_SEGUIMIENTO.join(', ')}`);
    const fecha = typeof b?.fecha === 'string' ? new Date(b.fecha) : null;
    if (!fecha || Number.isNaN(fecha.getTime())) errores.push('«fecha» debe ser una fecha ISO');
    else if (fecha.getTime() > ahora.getTime() + FUTURO_MS) errores.push('«fecha» está en el futuro');
    let fechaEstimada = null;
    if (b?.fechaEstimada !== undefined && b?.fechaEstimada !== null && b?.fechaEstimada !== '') {
        const t = String(b.fechaEstimada).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(t) && !Number.isNaN(new Date(`${t}T12:00:00Z`).getTime())) fechaEstimada = t;
        else {
            const d = new Date(t);
            if (typeof b.fechaEstimada === 'string' && !Number.isNaN(d.getTime())) fechaEstimada = DIA_MX.format(d); // día de México
            else errores.push('«fechaEstimada» debe ser AAAA-MM-DD o una fecha ISO');
        }
    }
    let nota = null;
    if (b?.nota !== undefined && b?.nota !== null && b?.nota !== '') {
        if (typeof b.nota !== 'string' || b.nota.trim().length > 500) errores.push('«nota» debe ser texto de hasta 500 caracteres');
        else nota = sinTelefonos(b.nota.trim()) || null;
    }
    if (errores.length) return { errores };
    return { errores: [], datos: { estado, fecha, fecha_estimada: fechaEstimada, nota } };
};

/** Guarda un cambio de estado de Julia. Devuelve { codigo, cuerpo } para la puerta. */
export const registrarSeguimiento = async (folioCrudo, cuerpo, origen = 'finanzas') => {
    const folio = String(folioCrudo || '').trim();
    if (!RE_FOLIO.test(folio)) return { codigo: 400, cuerpo: { error: 'Folio de orden no válido.' } };
    const { errores, datos } = leerSeguimiento(cuerpo);
    if (errores.length) return { codigo: 400, cuerpo: { error: `No se anotó: ${errores.join('; ')}.` } };
    const { OrdenCompra } = await import('../../models/index.js');
    const orden = await OrdenCompra.findOne({ where: { ticket_id: { [Op.iLike]: folio } }, attributes: ['id', 'ticket_id'] });
    if (!orden) return { codigo: 404, cuerpo: { error: `No existe la orden ${folio.toUpperCase()} en Planta.` } };
    const huella = huellaDe([orden.id, origen, 'estado', datos.estado, datos.fecha.toISOString(), datos.fecha_estimada, datos.nota]);
    const respuesta = (fila, duplicado) => ({ ok: true, id: `seguimiento-${fila.id}`, orden: orden.ticket_id, estado: datos.estado, duplicado, ...(duplicado ? {} : { recibido: isoMexico() }) });
    const previa = await OrdenSeguimiento.findOne({ where: { huella }, attributes: ['id'] });
    if (previa) return { codigo: 200, cuerpo: respuesta(previa, true) };
    try {
        const fila = await OrdenSeguimiento.create({ orden_id: orden.id, folio: orden.ticket_id, origen, tipo: 'estado', ...datos, huella });
        return { codigo: 201, cuerpo: respuesta(fila, false) };
    } catch (e) {
        if (e?.name === 'SequelizeUniqueConstraintError') {
            const otra = await OrdenSeguimiento.findOne({ where: { huella }, attributes: ['id'] });
            if (otra) return { codigo: 200, cuerpo: respuesta(otra, true) };
        }
        throw e;
    }
};

/**
 * C4 paso 3 (LLEGADA_CON_DATOS): la recepción de Planta anota la llegada con el folio de la factura y la foto.
 * Nunca lanza: una historia que no se anotó no debe tumbar una recepción.
 */
export const anotarLlegadaPlanta = async ({ orden, folioFactura = null, fotos = [], movimiento = null, fecha = new Date() }) => {
    try {
        const datos = {
            folioFactura: folioFactura ? String(folioFactura).slice(0, 60) : null,
            fotos: (fotos || []).filter((u) => RE_FOTO.test(u)).slice(0, 5),
            movimiento: movimiento || null
        };
        const huella = huellaDe([orden.id, 'planta', 'llegada', fecha.toISOString(), datos.movimiento, datos.folioFactura]);
        return await OrdenSeguimiento.create({
            orden_id: orden.id, folio: orden.ticket_id, origen: 'planta', tipo: 'llegada', estado: 'llego',
            fecha, fecha_estimada: null, nota: null, datos, huella
        });
    } catch (e) {
        console.error(`No se pudo anotar la llegada de ${orden?.ticket_id} en su historia:`, e.message);
        return null;
    }
};

/** La historia de una orden para la pantalla (de la más vieja a la más nueva) y el estado actual según Julia. */
export const seguimientoDeOrden = async (ordenId) => {
    const filas = await OrdenSeguimiento.findAll({
        where: { orden_id: ordenId },
        order: [['fecha', 'ASC'], ['id', 'ASC']],
        limit: 50
    });
    const seguimiento = filas.map((f) => {
        const t = TEXTO_ESTADO[f.estado] || { texto: f.estado, tono: 'neutro' };
        return {
            id: `seguimiento-${f.id}`,
            origen: f.origen,
            tipo: f.tipo,
            estado: f.estado,
            texto: f.tipo === 'llegada' ? 'Llegó material (recepción en Planta)' : t.texto,
            tono: t.tono,
            fecha: isoMexico(new Date(f.fecha)),
            fechaEstimada: f.fecha_estimada || null,
            nota: f.nota || null,
            folioFactura: f.datos?.folioFactura || null,
            fotos: Array.isArray(f.datos?.fotos) ? f.datos.fotos.filter((u) => RE_FOTO.test(u)) : []
        };
    });
    const deJulia = seguimiento.filter((s) => s.origen === 'finanzas');
    return { seguimiento, actual: deJulia.length ? deJulia[deJulia.length - 1] : null };
};
