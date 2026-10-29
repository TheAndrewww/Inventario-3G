/**
 * Pedidos de los encargados a Almacén (23-oct-2026): lo que Charly ve y contesta en Planta › Pedidos de encargados.
 * Los pedidos llegan de Operación por la puerta entre sistemas (routes/sistemas/almacen.js); aquí solo se listan y se
 * atienden (surtido, parcial o no se puede, con su nota). La tableta del encargado lee el estado por la puerta.
 */
import { Op } from 'sequelize';
import SolicitudAlmacen, { ESTADOS_SOLICITUD_ALMACEN } from '../models/SolicitudAlmacen.js';

const MAX_NOTA = 1000;

/** GET /api/pedidos-encargados?estado=pendiente|atendidas */
export const listarPedidosEncargados = async (req, res) => {
    try {
        const estado = String(req.query.estado || '').trim();
        const where = estado === 'pendiente' ? { estado: 'pendiente' }
            : estado === 'atendidas' ? { estado: { [Op.ne]: 'pendiente' } } : {};
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
        await fila.update({
            estado: r.estado,
            nota_almacen: r.nota,
            atendida_por: req.usuario?.nombre || null,
            atendida_en: new Date()
        });
        res.json({ success: true, data: fila });
    } catch (e) {
        console.error('responderPedidoEncargado:', e);
        res.status(500).json({ success: false, message: 'No se pudo guardar la respuesta' });
    }
};

/** DELETE /api/pedidos-encargados/:id — solo el administrador (29-oct-2026): para quitar los pedidos de prueba.
 *  Se borra de verdad; la tableta deja de verlo en su lista. */
export const borrarPedidoEncargado = async (req, res) => {
    try {
        const fila = await SolicitudAlmacen.findByPk(req.params.id);
        if (!fila) return res.status(404).json({ success: false, message: 'No existe ese pedido' });
        await fila.destroy();
        console.log(`🗑️ Pedido de encargado #${fila.id} (${fila.encargado}: «${fila.texto}») borrado por ${req.usuario?.nombre || '?'}`);
        res.json({ success: true });
    } catch (e) {
        console.error('borrarPedidoEncargado:', e);
        res.status(500).json({ success: false, message: 'No se pudo borrar el pedido' });
    }
};
