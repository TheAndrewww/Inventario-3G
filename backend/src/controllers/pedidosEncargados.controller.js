/**
 * Pedidos de los encargados a Almacén (23-oct-2026): lo que Charly ve y contesta en Planta › Pedidos de encargados.
 * Los pedidos llegan de Operación por la puerta entre sistemas (routes/sistemas/almacen.js); aquí solo se listan y se
 * atienden (surtido, parcial o no se puede, con su nota). La tableta del encargado lee el estado por la puerta.
 */
import { Op } from 'sequelize';
import SolicitudAlmacen, { ESTADOS_SOLICITUD_ALMACEN, ESTADO_CANCELADA, NOTA_CANCELADA } from '../models/SolicitudAlmacen.js';
// 6-nov-2026 (revisión, punto 9 c): aviso al encargado cuando Almacén contesta (pieza «encargado» de PLANTA_SEGUIMIENTO)
import { avisarRespuestaAlEncargado } from '../services/seguimientoPlanta.service.js';

const MAX_NOTA = 1000;

/** GET /api/pedidos-encargados?estado=pendiente|atendidas */
export const listarPedidosEncargados = async (req, res) => {
    try {
        const estado = String(req.query.estado || '').trim();
        // Los cancelados (borrados por el administrador) ya no salen en Planta; la tableta sí los ve como «cancelada».
        const where = estado === 'pendiente' ? { estado: 'pendiente' }
            : estado === 'atendidas' ? { estado: { [Op.notIn]: ['pendiente', ESTADO_CANCELADA] } } : { estado: { [Op.ne]: ESTADO_CANCELADA } };
        const [solicitudes, pendientes] = await Promise.all([
            SolicitudAlmacen.findAll({ where, order: [['created_at', 'DESC'], ['id', 'DESC']], limit: 200 }),
            SolicitudAlmacen.count({ where: { estado: 'pendiente' } })
        ]);
        res.json({ success: true, data: { solicitudes, pendientes } });
    } catch (e) {
        console.error('listarPedidosEncargados:', e);
        res.status(500).json({ success: false, message: 'No se pudieron cargar los pedidos de los encargados' });
    }
};

/** GET /api/pedidos-encargados/contador */
export const contarPedidosEncargados = async (req, res) => {
    try {
        res.json({ success: true, data: { pendientes: await SolicitudAlmacen.count({ where: { estado: 'pendiente' } }) } });
    } catch (e) {
        res.status(500).json({ success: false, message: 'No se pudo contar' });
    }
};

/** Revisa la respuesta de Almacén. Exportada para las pruebas. */
export const leerRespuesta = (b) => {
    const estado = String(b?.estado ?? '').trim().toLowerCase();
    if (!ESTADOS_SOLICITUD_ALMACEN.includes(estado) || estado === 'pendiente') return { error: '«estado» debe ser surtida, parcial o rechazada' };
    const nota = typeof b?.nota === 'string' ? b.nota.trim() : '';
    if (nota.length > MAX_NOTA) return { error: `La nota pasa de ${MAX_NOTA} caracteres` };
    // Parcial o no se puede: el encargado necesita saber qué falta o por qué
    if (estado !== 'surtida' && !nota) return { error: 'Escribe qué faltó o por qué no se puede' };
    return { estado, nota: nota || null };
};

/** PATCH /api/pedidos-encargados/:id  { estado: surtida|parcial|rechazada, nota? } */
export const responderPedidoEncargado = async (req, res) => {
    try {
        const r = leerRespuesta(req.body);
        if (r.error) return res.status(400).json({ success: false, message: r.error });
        const fila = await SolicitudAlmacen.findByPk(req.params.id);
        if (!fila) return res.status(404).json({ success: false, message: 'No existe ese pedido' });
        // Vuelta 1: un pedido que el administrador ya quitó no revive (antes de «cancelada» el renglón se borraba y esto
        // daba 404; Charly podía contestarlo con la lista de antes abierta y la tableta pasaba de «No se puede» a «Surtido»).
        if (fila.estado === ESTADO_CANCELADA) return res.status(404).json({ success: false, message: 'Ese pedido lo quitó el administrador' });
        await fila.update({
            estado: r.estado,
            nota_almacen: r.nota,
            atendida_por: req.usuario?.nombre || null,
            atendida_en: new Date()
        });
        // null = pieza «encargado» apagada · true = salió · false = no salió (ya quedó anotado y el administrador tiene campana)
        const avisoEncargado = await avisarRespuestaAlEncargado(fila);
        res.json({ success: true, data: fila, avisoEncargado });
    } catch (e) {
        console.error('responderPedidoEncargado:', e);
        res.status(500).json({ success: false, message: 'No se pudo guardar la respuesta' });
    }
};

/** DELETE /api/pedidos-encargados/:id — solo el administrador (29-oct-2026): para quitar los pedidos de prueba.
 *  6-nov-2026: ya no se borra el renglón, se marca «cancelada». Antes la tableta se quedaba con «por atender» para
 *  siempre, porque Operación guarda su copia y el pedido borrado ya no le llegaba en la lista. Ahora le llega por
 *  GET /api/sistemas/v1/almacen/solicitudes como «rechazada» con la nota «Lo quitó el administrador en Planta» (la
 *  tableta lo pinta «No se puede»), y en Planta deja de salir en las listas. */
export const borrarPedidoEncargado = async (req, res) => {
    try {
        const fila = await SolicitudAlmacen.findByPk(req.params.id);
        if (!fila) return res.status(404).json({ success: false, message: 'No existe ese pedido' });
        if (fila.estado === ESTADO_CANCELADA) return res.status(404).json({ success: false, message: 'No existe ese pedido' });
        await fila.update({
            estado: ESTADO_CANCELADA,
            nota_almacen: NOTA_CANCELADA,
            atendida_por: req.usuario?.nombre || null,
            atendida_en: new Date()
        });
        console.log(`🗑️ Pedido de encargado #${fila.id} (${fila.encargado}: «${fila.texto}») cancelado por ${req.usuario?.nombre || '?'}`);
        res.json({ success: true });
    } catch (e) {
        console.error('borrarPedidoEncargado:', e);
        res.status(500).json({ success: false, message: 'No se pudo borrar el pedido' });
    }
};
