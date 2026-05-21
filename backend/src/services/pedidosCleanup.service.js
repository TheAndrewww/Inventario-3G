import { Op } from 'sequelize';
import { Movimiento, DetalleMovimiento, Articulo, SolicitudCompra } from '../models/index.js';

const ESTADOS_ACTIVOS = ['pendiente', 'pendiente_aprobacion', 'aprobado', 'listo_para_entrega'];

/**
 * Anula los pedidos abiertos asociados a un proyecto.
 * Revierte el stock de cada artículo y cancela las solicitudes de compra
 * pendientes/en_orden vinculadas al pedido. No toca pedidos ya entregados.
 *
 * @param {Object} params
 * @param {string} params.proyectoNombre - Nombre del proyecto (Movimiento.proyecto)
 * @param {string} [params.motivo] - Motivo registrado en la anulación
 * @param {import('sequelize').Transaction|null} [params.transaction]
 * @param {number|null} [params.usuarioId]
 * @returns {Promise<{anulados: number, ticketIds: string[]}>}
 */
export async function anularPedidosDeProyecto({ proyectoNombre, motivo = 'Proyecto cerrado', transaction = null, usuarioId = null }) {
    if (!proyectoNombre) return { anulados: 0, ticketIds: [] };

    const pedidos = await Movimiento.findAll({
        where: {
            tipo: 'pedido',
            proyecto: proyectoNombre,
            estado: { [Op.in]: ESTADOS_ACTIVOS }
        },
        include: [
            { model: DetalleMovimiento, as: 'detalles', include: [{ model: Articulo, as: 'articulo' }] },
            { model: SolicitudCompra, as: 'solicitudes_compra' }
        ],
        transaction
    });

    const ticketIds = [];
    for (const pedido of pedidos) {
        await anularPedidoInterno(pedido, motivo, transaction, usuarioId);
        ticketIds.push(pedido.ticket_id);
    }

    return { anulados: pedidos.length, ticketIds };
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
