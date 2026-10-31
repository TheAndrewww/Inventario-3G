/**
 * Pedidos de los encargados a Almacén (23-oct-2026) — origen «operacion», alcance «almacen.solicitar».
 *
 *   POST /api/sistemas/v1/almacen/solicitudes
 *     Cuerpo: { encargado, tipo: "MATERIAL"|"REPOSICION"|"HERRAMIENTA_ESPECIAL", texto, paraFecha? (AAAA-MM-DD), proyecto?,
 *               obra? (ID 3G «3G-AA-NNNN»), referencia (id del pedido en Operación) }
 *     Respuestas: 201 { ok, id: "almacen-N", estado, duplicado: false, recibido } · 200 { ok, id, estado, duplicado: true }
 *     si esa referencia ya estaba (aunque llegue con otra Idempotency-Key) · 400 { error } si falta o sobra algo.
 *   GET /api/sistemas/v1/almacen/solicitudes?encargado=GERAS
 *     { solicitudes: [{ id, referencia, tipo, texto, paraFecha, estado, nota, atendidaEn, creada }] } (50 como máximo, la
 *     más nueva primero). Sin «encargado», las de todos.
 *
 * El encargado lo pide desde su tableta (Operación lo reenvía aquí) y Charly lo atiende en Planta › Pedidos de encargados
 * (surtido, parcial o no se puede, con su nota). Al llegar uno nuevo se avisa en la campana (y push) a Almacén.
 */
import SolicitudAlmacen, { TIPOS_SOLICITUD_ALMACEN } from '../../models/SolicitudAlmacen.js';
import { isoMexico } from '../../utils/revisarConfig.js';
import { sinTelefonos, RE_OBRA } from './bitacora.js';

export const ALCANCE_ALMACEN = 'almacen.solicitar';
const MAX_TEXTO = 2000;
const MAX_LISTA = 50;
const RE_ENCARGADO = /^[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ .-]{1,39}$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_REFERENCIA = /^[\w:.-]{1,100}$/;

const textoOpcional = (v, max) => {
    if (v === undefined || v === null || v === '') return { valor: null };
    if (typeof v !== 'string') return { error: true };
    const t = v.trim();
    if (t.length > max) return { error: true };
    return { valor: t || null };
};

const fechaValida = (s) => {
    if (!RE_FECHA.test(s)) return false;
    const d = new Date(`${s}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** Revisa el cuerpo; devuelve { errores: [] } o { datos }. Exportada para las pruebas. */
export const leerSolicitudAlmacen = (b) => {
    const errores = [];
    const encargado = String(b?.encargado ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
    if (!RE_ENCARGADO.test(encargado)) errores.push('«encargado» debe ser el nombre del encargado (GERAS, MIGUEL…)');
    const tipo = String(b?.tipo ?? '').trim().toUpperCase();
    if (!TIPOS_SOLICITUD_ALMACEN.includes(tipo)) errores.push('«tipo» debe ser MATERIAL, REPOSICION o HERRAMIENTA_ESPECIAL');
    const texto = typeof b?.texto === 'string' ? b.texto.trim() : '';
    if (!texto) errores.push('Falta «texto»');
    else if (texto.length > MAX_TEXTO) errores.push(`«texto» pasa de ${MAX_TEXTO} caracteres`);
    const referencia = typeof b?.referencia === 'string' ? b.referencia.trim() : '';
    if (!RE_REFERENCIA.test(referencia)) errores.push('«referencia» debe ser el id del pedido en Operación (hasta 100 caracteres)');
    let paraFecha = null;
    if (b?.paraFecha !== undefined && b?.paraFecha !== null && b?.paraFecha !== '') {
        if (typeof b.paraFecha !== 'string' || !fechaValida(b.paraFecha.trim())) errores.push('«paraFecha» debe ser AAAA-MM-DD');
        else paraFecha = b.paraFecha.trim();
    }
    const proyecto = textoOpcional(b?.proyecto, 200);
    if (proyecto.error) errores.push('«proyecto» debe ser texto de hasta 200 caracteres');
    const obra = textoOpcional(b?.obra, 12);
    if (obra.error || (obra.valor && !RE_OBRA.test(obra.valor))) errores.push('«obra» debe ser un ID 3G (3G-AA-NNNN)');
    if (errores.length) return { errores };
    return {
        errores: [],
        datos: { encargado, tipo, texto: sinTelefonos(texto), para_fecha: paraFecha, proyecto: proyecto.valor, obra_id: obra.valor, referencia }
    };
};

export const TEXTO_TIPO = { MATERIAL: 'Material', REPOSICION: 'Reposición de stock', HERRAMIENTA_ESPECIAL: 'Herramienta especial' };

/** Campana y push a Almacén (y al administrador). No tumba el registro si falla. */
const avisarAlmacen = async (fila) => {
    try {
        const { notificarPorRol } = await import('../../controllers/notificaciones.controller.js');
        await notificarPorRol({
            roles: ['almacen', 'administrador'],
            tipo: 'pedido_pendiente', // tipo que ya existe en el enum de notificaciones (no se agrega uno nuevo)
            titulo: `${TEXTO_TIPO[fila.tipo]} · ${fila.encargado}`,
            mensaje: fila.texto.length > 140 ? `${fila.texto.slice(0, 137)}…` : fila.texto,
            url: '/pedidos-encargados',
            datos_adicionales: { solicitud_almacen_id: fila.id }
        });
    } catch (e) {
        console.error('[puerta] aviso de pedido de encargado (no crítico):', e.message);
    }
    // 26-oct (jefe): la requisición del encargado también va al grupo de WhatsApp REQUISICIONES (sin importes).
    try {
        const { enviarWhatsApp } = await import('../../services/whatsapp.service.js');
        await enviarWhatsApp(textoRequisicion(fila), 'requisiciones');
    } catch (e) {
        console.error('[puerta] aviso a Requisiciones (no crítico):', e.message);
    }
};

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const nombreBonito = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase());

/** El aviso al grupo Requisiciones. Pura. */
export const textoRequisicion = (f) => {
    const para = f.para_fecha ? (() => { const [, m, d] = String(f.para_fecha).split('-').map(Number); return `${d} ${MESES_CORTOS[m - 1]}`; })() : null;
    return [
        `📋 *Requisición de ${nombreBonito(f.encargado)}* · ${TEXTO_TIPO[f.tipo] ?? f.tipo}`,
        f.texto,
        f.proyecto ? `Obra: ${f.proyecto}` : null,
        para ? `Para el ${para}` : null,
        'Se atiende en Inventario › Pedidos de encargados.',
    ].filter(Boolean).join('\n');
};

/** Guarda un pedido. Devuelve { codigo, cuerpo } para la puerta. `avisar` se puede cambiar en las pruebas. */
export const registrarSolicitudAlmacen = async (cuerpo, { modelo = SolicitudAlmacen, avisar = avisarAlmacen } = {}) => {
    const { errores, datos } = leerSolicitudAlmacen(cuerpo);
    if (errores.length) return { codigo: 400, cuerpo: { error: `No se anotó: ${errores.join('; ')}.` } };
    const duplicado = (f) => ({ codigo: 200, cuerpo: { ok: true, id: f ? `almacen-${f.id}` : null, estado: f?.estado ?? null, duplicado: true } });
    const previa = await modelo.findOne({ where: { referencia: datos.referencia }, attributes: ['id', 'estado'] });
    if (previa) return duplicado(previa);
    try {
        const fila = await modelo.create(datos);
        await avisar(fila);
        return { codigo: 201, cuerpo: { ok: true, id: `almacen-${fila.id}`, estado: fila.estado, duplicado: false, recibido: isoMexico() } };
    } catch (e) {
        // Dos entregas iguales al mismo tiempo: la segunda choca con la referencia única y es la misma.
        if (e?.name === 'SequelizeUniqueConstraintError') {
            return duplicado(await modelo.findOne({ where: { referencia: datos.referencia }, attributes: ['id', 'estado'] }));
        }
        throw e;
    }
};

/** Lo que ve la tableta: el estado de sus pedidos. */
export const formaSolicitud = (f) => ({
    id: `almacen-${f.id}`,
    referencia: f.referencia,
    tipo: f.tipo,
    texto: f.texto,
    paraFecha: f.para_fecha || null,
    estado: f.estado,
    nota: f.nota_almacen || null,
    atendidaEn: f.atendida_en ? isoMexico(new Date(f.atendida_en)) : null,
    creada: f.created_at ? isoMexico(new Date(f.created_at)) : null
});

export const listarSolicitudesAlmacen = async (req, { modelo = SolicitudAlmacen } = {}) => {
    const encargado = String(req.query?.encargado ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
    const where = encargado ? { encargado } : {};
    const filas = await modelo.findAll({ where, order: [['created_at', 'DESC'], ['id', 'DESC']], limit: MAX_LISTA });
    return { solicitudes: filas.map(formaSolicitud) };
};
