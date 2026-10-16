import { Op } from 'sequelize';
import { Movimiento, DetalleMovimiento, Articulo, SolicitudCompra } from '../models/index.js';

const ESTADOS_ACTIVOS = ['pendiente', 'pendiente_aprobacion', 'aprobado', 'listo_para_entrega'];

const SEPARADORES = [' / ', ' /', '/ ', '/', ' - ', ' -', '- ', '-'];

function normalizar(s) {
    return (s || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

// Match bidireccional: t≈p si son iguales normalizados o uno empieza con
// el otro seguido de un separador conocido.
export function mismosProyectos(a, b) {
    const an = normalizar(a);
    const bn = normalizar(b);
    if (!an || !bn) return false;
    if (an === bn) return true;
    for (const sep of SEPARADORES) {
        if (an.startsWith(bn + sep) || bn.startsWith(an + sep)) return true;
    }
    return false;
}

// ===== A6 · PLA-05: cerrar una obra respeta el material entregado =====
// Con CIERRE_OBRA_RESPETA_ENTREGADO=1, un ticket con artículos ya entregados (dispersados) o con compras ya
// recibidas (solicitudes «completada») NO se anula al cerrar su obra: queda abierto y marcado «Por revisar ·
// cierre de obra» con su motivo, y el material entregado no regresa solo al almacén. El resto se anula como hoy.
// Apagada (por omisión) todo es como antes. La anulación manual y la masiva no pasan por aquí y no cambian.
export const BANDERA_CIERRE_OBRA = 'CIERRE_OBRA_RESPETA_ENTREGADO';
export const cierreRespetaEntregado = () =>
    ['1', 'true', 'si', 'sí', 'encendida'].includes(String(process.env[BANDERA_CIERRE_OBRA] || '').trim().toLowerCase());

/** Lo ya entregado de un ticket: artículos dispersados y compras recibidas (solicitudes «completada»). */
export function entregadoDelTicket(pedido) {
    const detalles = pedido.detalles || [];
    const solicitudes = pedido.solicitudes_compra || [];
    return {
        articulos: detalles.length,
        dispersados: detalles.filter(d => d.dispersado).length,
        comprasRecibidas: solicitudes.filter(s => s.estado === 'completada').length
    };
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const fechaCorta = (fecha) => new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short' })
    .format(fecha).replace('.', '').replace(' ', '-');

/** «Obra cerrada el 12-nov: 3 artículos ya entregados, 1 compra recibida» */
export function motivoRevision({ dispersados, comprasRecibidas }, fecha = new Date()) {
    const partes = [];
    if (dispersados) partes.push(plural(dispersados, 'artículo ya entregado', 'artículos ya entregados'));
    if (comprasRecibidas) partes.push(plural(comprasRecibidas, 'compra recibida', 'compras recibidas'));
    return `Obra cerrada el ${fechaCorta(fecha)}: ${partes.join(', ')}`;
}

/** Regla nueva: ¿este ticket queda por revisar en lugar de anularse? */
export const quedaPorRevisar = (entregado) => entregado.dispersados > 0 || entregado.comprasRecibidas > 0;

/**
 * Anula los pedidos abiertos asociados a un proyecto.
 * Revierte el stock de cada artículo y cancela las solicitudes de compra
 * pendientes/en_orden vinculadas al pedido. No toca pedidos ya entregados.
 * Con CIERRE_OBRA_RESPETA_ENTREGADO, los que ya tienen material entregado o compras recibidas
 * no se anulan: quedan «Por revisar · cierre de obra» (A6).
 *
 * C1 · PLA-19 (EMPATE_POR_OBRA): con el id del proyecto, se busca primero por ID 3G: un ticket que trae ID se empata
 * solo por ID (los de OTRA obra con el mismo nombre ya no se anulan) y uno sin ID, por nombre como siempre.
 * Apagada (o sin proyectoId), todo por nombre como hoy.
 *
 * @param {Object} params
 * @param {string} params.proyectoNombre - Nombre del proyecto (Movimiento.proyecto)
 * @param {number|null} [params.proyectoId] - Id del ProduccionProyecto que se cierra (para buscar por su ID 3G)
 * @param {string} [params.motivo] - Motivo registrado en la anulación
 * @param {import('sequelize').Transaction|null} [params.transaction]
 * @param {number|null} [params.usuarioId]
 * @returns {Promise<{anulados: number, ticketIds: string[], porRevisar: number, ticketIdsPorRevisar: string[]}>}
 */
export async function anularPedidosDeProyecto({ proyectoNombre, proyectoId = null, motivo = 'Proyecto cerrado', transaction = null, usuarioId = null }) {
    if (!proyectoNombre) return { anulados: 0, ticketIds: [], porRevisar: 0, ticketIdsPorRevisar: [] };

    // Match flexible: traer TODOS los pedidos activos y filtrar en JS, ya que
    // el match SQL (iLike + prefijo) no cubre el caso inverso (proyecto del
    // ticket más corto que el ProduccionProyecto.nombre).
    const candidatos = await Movimiento.findAll({
        where: {
            tipo: 'pedido',
            estado: { [Op.in]: ESTADOS_ACTIVOS }
        },
        include: [
            { model: DetalleMovimiento, as: 'detalles', include: [{ model: Articulo, as: 'articulo' }] },
            { model: SolicitudCompra, as: 'solicitudes_compra' }
        ],
        transaction
    });

    const pedidos = await deLaObra(candidatos, { proyectoNombre, proyectoId, transaction });
    const respetaEntregado = cierreRespetaEntregado();

    const ticketIds = [];
    const ticketIdsPorRevisar = [];
    for (const pedido of pedidos) {
        const entregado = entregadoDelTicket(pedido);
        if (respetaEntregado && quedaPorRevisar(entregado)) {
            await marcarPorRevisar(pedido, entregado, transaction);
            ticketIdsPorRevisar.push(pedido.ticket_id);
            continue;
        }
        await anularPedidoInterno(pedido, motivo, transaction, usuarioId);
        ticketIds.push(pedido.ticket_id);
    }

    return { anulados: ticketIds.length, ticketIds, porRevisar: ticketIdsPorRevisar.length, ticketIdsPorRevisar };
}

// Los tickets de la obra que se cierra. Sin EMPATE_POR_OBRA (o sin proyectoId): por nombre, la regla de siempre.
// Con la bandera: primero por ID 3G (un ticket con ID es de la obra solo si es el mismo ID) y, si el ticket no lo trae,
// por nombre. Si leer los ID falla, por nombre como hoy.
async function deLaObra(candidatos, { proyectoNombre, proyectoId, transaction }) {
    const porNombre = () => candidatos.filter(p => mismosProyectos(p.proyecto, proyectoNombre));
    const { empatePorObra, obraIdDeProyecto, obraIdsDeTickets, ticketEsDeLaObra } = await import('./obraId.service.js');
    if (!empatePorObra() || !proyectoId) return porNombre();
    try {
        const obraId = await obraIdDeProyecto(proyectoId, transaction);
        const ids = await obraIdsDeTickets(candidatos.map(p => p.id), transaction);
        return candidatos.filter(p => ticketEsDeLaObra({
            ticketObraId: ids.get(p.id), ticketProyecto: p.proyecto, obraId, proyectoNombre, mismosProyectos
        }));
    } catch (err) {
        console.error('[ID 3G] no se pudo empatar por ID; se anula por nombre como siempre:', err.message);
        return porNombre();
    }
}

// El ticket se queda como está (estado, stock y solicitudes); solo se marca con su motivo.
// Si ya estaba marcado, conserva el motivo y la fecha de la primera vez.
async function marcarPorRevisar(pedido, entregado, transaction) {
    if (pedido.revision_requerida) return;
    const ahora = new Date();
    await pedido.update({
        revision_requerida: true,
        revision_motivo: motivoRevision(entregado, ahora),
        revision_desde: ahora
    }, { transaction });
}

async function anularPedidoInterno(pedido, motivo, transaction, usuarioId) {
    for (const detalle of pedido.detalles || []) {
        if (!detalle.articulo) continue;
        const cantidad = parseFloat(detalle.cantidad);
        const stockNuevo = parseFloat(detalle.articulo.stock_actual) + cantidad;
        await detalle.articulo.update({ stock_actual: stockNuevo }, { transaction });
    }

    for (const solicitud of pedido.solicitudes_compra || []) {
        if (['pendiente', 'en_orden'].includes(solicitud.estado)) {
            await solicitud.update({
                estado: 'cancelada',
                observaciones: `Cancelada automáticamente por anulación del pedido ${pedido.ticket_id}. ${motivo}`
            }, { transaction });
        }
    }

    const obs = `${pedido.observaciones || ''}\n\n[ANULADO automáticamente - ${new Date().toLocaleString('es-MX')}]\nMotivo: ${motivo}`;
    await pedido.update({
        estado: 'cancelado',
        observaciones: obs,
        motivo_rechazo: motivo,
        ...(usuarioId ? { aprobado_por_id: usuarioId, fecha_aprobacion: new Date() } : {})
    }, { transaction });
}

const AREAS_FIJAS = ['manufactura', 'herreria'];

/**
 * A6 · PLA-05 — Ensayo de solo lectura (GET /api/admin/ensayo-cierre-obras, administración).
 * Por cada ticket abierto de una obra: qué pasaría hoy al cerrarse su obra y qué pasaría con la regla nueva.
 * No escribe nada (solo SELECT).
 *
 * @param {string[]} nombresAbiertos - Nombres de las obras abiertas en producción (getNombresProyectosAbiertos)
 */
export async function ensayoCierreObras(nombresAbiertos = []) {
    const tickets = await Movimiento.findAll({
        where: { tipo: 'pedido', estado: { [Op.in]: ESTADOS_ACTIVOS } },
        include: [
            { model: DetalleMovimiento, as: 'detalles', include: [{ model: Articulo, as: 'articulo', attributes: ['id', 'nombre', 'unidad', 'stock_actual'] }] },
            { model: SolicitudCompra, as: 'solicitudes_compra', attributes: ['id', 'ticket_id', 'estado'] }
        ],
        order: [['fecha_hora', 'ASC']]
    });

    const filas = tickets
        .filter(t => t.proyecto && !AREAS_FIJAS.includes(normalizar(t.proyecto)))
        .map(t => {
            const entregado = entregadoDelTicket(t);
            const porRevisar = quedaPorRevisar(entregado);
            const regresaria = (t.detalles || []).filter(d => d.articulo).map(d => ({
                articulo: d.articulo.nombre,
                unidad: d.articulo.unidad,
                cantidad: parseFloat(d.cantidad),
                entregado: !!d.dispersado
            }));
            const piezasHoy = regresaria.reduce((s, r) => s + r.cantidad, 0);
            const obraAbierta = nombresAbiertos.some(n => mismosProyectos(t.proyecto, n));
            return {
                ticket: t.ticket_id,
                estado: t.estado,
                proyecto: t.proyecto,
                obra: obraAbierta ? 'abierta' : 'cerrada o sin obra en producción',
                articulos: entregado.articulos,
                dispersados: entregado.dispersados,
                comprasRecibidas: entregado.comprasRecibidas,
                solicitudesQueSeCancelarianHoy: (t.solicitudes_compra || []).filter(s => ['pendiente', 'en_orden'].includes(s.estado)).length,
                hoy: { decision: 'se anula', piezasQueRegresan: piezasHoy, detalle: regresaria },
                reglaNueva: porRevisar
                    ? { decision: 'por revisar', piezasQueRegresan: 0, motivo: motivoRevision(entregado) }
                    : { decision: 'se anula', piezasQueRegresan: piezasHoy },
                yaMarcado: !!t.revision_requerida
            };
        });

    const suma = (f) => filas.reduce((s, x) => s + f(x), 0);
    return {
        soloLectura: true,
        generado: new Date().toISOString(),
        bandera: { nombre: BANDERA_CIERRE_OBRA, encendida: cierreRespetaEntregado() },
        resumen: {
            ticketsAbiertosDeObras: filas.length,
            deObrasYaCerradas: filas.filter(f => f.obra !== 'abierta').length,
            hoySeAnularian: filas.length,
            conReglaNuevaSeAnularian: filas.filter(f => f.reglaNueva.decision === 'se anula').length,
            conReglaNuevaQuedanPorRevisar: filas.filter(f => f.reglaNueva.decision === 'por revisar').length,
            piezasQueRegresarianHoy: suma(f => f.hoy.piezasQueRegresan),
            piezasQueRegresarianConReglaNueva: suma(f => f.reglaNueva.piezasQueRegresan),
            yaMarcadosPorRevisar: filas.filter(f => f.yaMarcado).length
        },
        tickets: filas
    };
}
