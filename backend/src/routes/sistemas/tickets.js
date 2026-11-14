/**
 * Carla cierra un ticket de salida que Charly ya surtió (13-nov-2026, jefe: «si Charly ya lo surtió, Carla debe ofrecerse
 * a cerrarlo»). En la junta de cierre Charly dice que ya surtió completo el ticket y acepta que Carla lo cierre; al
 * colgar, Operación lo cierra aquí.
 *
 *   POST /api/sistemas/v1/almacen/tickets/:folio/cerrar   (origen «operacion», alcance «almacen.tickets» o «almacen.solicitar»)
 *     Cuerpo: { quien (texto, quién lo pidió: «Carla (lo surtió Charly)»), motivo? }
 *     200 { ok: true, folio, proyecto, estado: 'entregado', ya: false }  · lo cerró ahora
 *     200 { ok: true, folio, proyecto, estado, ya: true }                · ya estaba cerrado (entregado, cancelado…): nada cambia
 *     404 { error } si no hay un pedido con ese folio · 400 { error } si el folio o «quien» vienen mal.
 *
 * Hace lo mismo que el botón «Terminar» del almacén (marcarPedidoEntregadoDirecto): todos los artículos dispersados y el
 * pedido entregado, y avisa al grupo de producción («✅ Ticket cerrado»). Sin usuario de sesión: supervisor y recibido
 * quedan vacíos y el aviso dice quién lo pidió.
 */
import { sequelize } from '../../config/database.js';
import { Movimiento, DetalleMovimiento } from '../../models/index.js';
import { avisarTicketCerrado } from '../../services/avisosProduccion.service.js';

export const ALCANCE_TICKETS = 'almacen.tickets';
const RE_FOLIO = /^PED-[\w-]{4,40}$/i;
const ABIERTOS = ['pendiente', 'aprobado'];

/** Revisa la petición. Exportada para las pruebas. */
export const leerCierreTicket = (folio, b) => {
    const f = String(folio ?? '').trim().toUpperCase();
    if (!RE_FOLIO.test(f)) return { error: 'El folio debe ser el del ticket (PED-…).' };
    const quien = typeof b?.quien === 'string' ? b.quien.trim().slice(0, 80) : '';
    if (!quien) return { error: 'Falta «quien».' };
    const motivo = typeof b?.motivo === 'string' ? b.motivo.trim().slice(0, 300) || null : null;
    return { folio: f, quien, motivo };
};

/** Cierra el ticket. `m` permite cambiar los modelos en las pruebas. Devuelve { codigo, cuerpo }. */
export async function cerrarTicket(folio, cuerpo, m = { Movimiento, DetalleMovimiento, sequelize, avisar: avisarTicketCerrado }) {
    const d = leerCierreTicket(folio, cuerpo);
    if (d.error) return { codigo: 400, cuerpo: { error: d.error } };
    const t = await m.sequelize.transaction();
    let pedido;
    try {
        pedido = await m.Movimiento.findOne({ where: { ticket_id: d.folio, tipo: 'pedido' }, transaction: t, lock: true });
        if (!pedido) {
            await t.rollback();
            return { codigo: 404, cuerpo: { error: `No hay un ticket con el folio ${d.folio}.` } };
        }
        if (!ABIERTOS.includes(pedido.estado)) {
            await t.rollback();
            return { codigo: 200, cuerpo: { ok: true, folio: d.folio, proyecto: pedido.proyecto ?? null, estado: pedido.estado, ya: true } };
        }
        await m.DetalleMovimiento.update(
            { dispersado: true, fecha_dispersado: new Date() },
            { where: { movimiento_id: pedido.id, dispersado: false }, transaction: t }
        );
        await pedido.update({ estado: 'entregado', fecha_recepcion: new Date() }, { transaction: t });
        await t.commit();
    } catch (e) {
        await t.rollback().catch(() => {});
        throw e;
    }
    console.log(`[puerta] ticket ${d.folio} cerrado por ${d.quien}${d.motivo ? ` (${d.motivo})` : ''}`);
    if (pedido.proyecto) {
        await m.avisar({ proyecto: pedido.proyecto, recibio: d.quien })
            .catch((err) => console.error('⚠️ No se pudo avisar el cierre del ticket:', err.message));
    }
    return { codigo: 200, cuerpo: { ok: true, folio: d.folio, proyecto: pedido.proyecto ?? null, estado: 'entregado', ya: false } };
}
