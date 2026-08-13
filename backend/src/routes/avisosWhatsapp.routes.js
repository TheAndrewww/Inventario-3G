/**
 * Cola de avisos de WhatsApp — la consume el bot contable.
 *
 * No usa el JWT de usuarios: quien llama es otro sistema, no una persona.
 * Se autentica con el token compartido WHATSAPP_PUENTE_TOKEN.
 */

import express from 'express';
import { Op } from 'sequelize';
import { AvisoWhatsApp, OrdenCompra, Usuario, Proveedor, DetalleOrdenCompra, Articulo } from '../models/index.js';
import { crearNotificacion } from '../controllers/notificaciones.controller.js';
import { enviarEmailEstadoOrden } from '../services/email.service.js';

const router = express.Router();

/** Solo pasa quien traiga el token compartido del puente. */
const verificarPuente = (req, res, next) => {
    const esperado = process.env.WHATSAPP_PUENTE_TOKEN;

    if (!esperado) {
        return res.status(503).json({ success: false, message: 'Puente de WhatsApp no configurado' });
    }

    const recibido = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (recibido !== esperado) {
        console.warn('⚠️ Acceso al puente de WhatsApp con token inválido');
        return res.status(401).json({ success: false, message: 'Token inválido' });
    }

    next();
};

router.use(verificarPuente);

/**
 * GET /api/avisos-whatsapp/pendientes
 * Avisos que faltan por publicar, del más viejo al más nuevo.
 */
router.get('/pendientes', async (req, res) => {
    try {
        const limite = Math.min(parseInt(req.query.limit) || 20, 50);

        const avisos = await AvisoWhatsApp.findAll({
            where: {
                estado: 'pendiente',
                intentos: { [Op.lt]: 5 } // tras 5 intentos fallidos deja de reintentarse
            },
            order: [['id', 'ASC']], // el id autoincremental ya da el orden cronológico
            limit: limite,
            attributes: ['id', 'destino', 'mensaje', 'intentos', 'tipo', 'referencia_id']
        });

        res.json({ success: true, data: { avisos } });
    } catch (error) {
        console.error('Error al listar avisos pendientes:', error);
        // El detalle sí se devuelve: esta ruta solo la ve el bot (va con token),
        // y sin él es imposible diagnosticar el puente desde el otro extremo.
        res.status(500).json({ success: false, message: 'Error al listar avisos', error: error.message });
    }
});

/**
 * POST /api/avisos-whatsapp/:id/resultado
 * El bot reporta si pudo publicarlo. Body: { ok: boolean, error?: string }
 */
router.post('/:id/resultado', async (req, res) => {
    try {
        const aviso = await AvisoWhatsApp.findByPk(req.params.id);
        if (!aviso) {
            return res.status(404).json({ success: false, message: 'Aviso no encontrado' });
        }

        if (req.body?.ok) {
            await aviso.update({ estado: 'enviado', enviado_at: new Date(), error: null });
        } else {
            const intentos = aviso.intentos + 1;
            await aviso.update({
                intentos,
                // Se rinde a los 5 intentos para no reintentar por siempre un mensaje roto
                estado: intentos >= 5 ? 'error' : 'pendiente',
                error: (req.body?.error || 'error desconocido').slice(0, 500)
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error al marcar el aviso:', error);
        res.status(500).json({ success: false, message: 'Error al marcar el aviso' });
    }
});

/** Deja un teléfono en sus últimos 10 dígitos, para comparar sin importar el formato. */
const soloDigitos = (valor) => (valor || '').toString().replace(/\D/g, '').slice(-10);

/**
 * POST /api/avisos-whatsapp/:id/decision
 * El bot reporta que alguien reaccionó sobre un aviso de autorización.
 *
 * Body: { aprobado: boolean, telefono: string, motivo?: string }
 *
 * Solo autorizan los ADMINISTRADORES activos cuyo teléfono esté registrado en
 * Usuarios: la reacción de cualquier otro integrante del grupo no mueve nada.
 */
router.post('/:id/decision', async (req, res) => {
    try {
        const { aprobado, telefono, motivo } = req.body || {};

        const aviso = await AvisoWhatsApp.findByPk(req.params.id);
        if (!aviso) {
            return res.status(404).json({ success: false, message: 'Aviso no encontrado' });
        }
        if (aviso.tipo !== 'aprobacion_orden' || !aviso.referencia_id) {
            return res.status(400).json({ success: false, message: 'Ese aviso no espera autorización' });
        }

        // ¿Quién reaccionó? Debe ser un administrador activo con ese teléfono.
        const digitos = soloDigitos(telefono);
        if (!digitos) {
            return res.status(400).json({ success: false, message: 'No se recibió el teléfono de quien reaccionó' });
        }

        const administradores = await Usuario.findAll({
            where: { rol: 'administrador', activo: true },
            attributes: ['id', 'nombre', 'telefono']
        });
        const autorizador = administradores.find(u => soloDigitos(u.telefono) === digitos);

        if (!autorizador) {
            // Distinguir "no eres tú" de "nadie puede": si ningún administrador
            // tiene teléfono capturado, la autorización por WhatsApp no funciona
            // para nadie y conviene decirlo en vez de dejarlo en un "no autorizado".
            const conTelefono = administradores.filter(u => soloDigitos(u.telefono));
            const message = conTelefono.length === 0
                ? 'Ningún administrador tiene teléfono registrado en Usuarios, así que no se puede autorizar por WhatsApp. Captúralo en el sistema.'
                : 'Ese número no está autorizado para aprobar órdenes de compra';

            return res.status(403).json({ success: false, message });
        }

        const orden = await OrdenCompra.findByPk(aviso.referencia_id, {
            include: [
                { model: Usuario, as: 'creador', attributes: ['id', 'nombre', 'email'], required: false },
                { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre'], required: false },
                {
                    model: DetalleOrdenCompra,
                    as: 'detalles',
                    include: [{ model: Articulo, as: 'articulo', attributes: ['id', 'nombre', 'unidad'] }]
                }
            ]
        });

        if (!orden) {
            return res.status(404).json({ success: false, message: 'La orden ya no existe' });
        }

        // Si ya se resolvió (por correo o desde el sistema), no se vuelve a mover.
        if (orden.estado !== 'pendiente_aprobacion') {
            return res.json({
                success: true,
                yaProcesada: true,
                message: `La orden ${orden.ticket_id} ya estaba ${orden.estado}`
            });
        }

        if (aprobado) {
            await orden.update({
                estado: 'enviada',
                motivo_rechazo: null,
                aprobado_por_id: autorizador.id,
                fecha_aprobacion: new Date(),
                fecha_envio: new Date()
            });
        } else {
            await orden.update({
                estado: 'rechazada',
                aprobado_por_id: autorizador.id,
                fecha_aprobacion: new Date(),
                motivo_rechazo: motivo || `Rechazada por ${autorizador.nombre} desde WhatsApp`
            });
        }

        // Avisos al creador; que fallen no debe deshacer la autorización
        try {
            await crearNotificacion({
                usuario_id: orden.usuario_creador_id,
                tipo: 'orden_estado_cambiado',
                titulo: aprobado ? '✅ Orden de compra aprobada' : '❌ Orden de compra rechazada',
                mensaje: `Tu orden ${orden.ticket_id} fue ${aprobado ? 'aprobada' : 'rechazada'} por ${autorizador.nombre} desde WhatsApp.`,
                url: '/ordenes-compra'
            });
        } catch (e) { /* el aviso es secundario */ }

        enviarEmailEstadoOrden(orden, aprobado ? 'aprobada' : 'rechazada', motivo || null, `${autorizador.nombre} (por WhatsApp)`)
            .catch(e => console.error('Error al avisar por correo:', e.message));

        console.log(`🛒 Orden ${orden.ticket_id} ${aprobado ? 'aprobada' : 'rechazada'} por ${autorizador.nombre} desde WhatsApp`);

        res.json({
            success: true,
            message: aprobado
                ? `Orden ${orden.ticket_id} autorizada por ${autorizador.nombre}. Ya puede enviarse al proveedor.`
                : `Orden ${orden.ticket_id} rechazada por ${autorizador.nombre}.`
        });

    } catch (error) {
        console.error('Error al procesar la decisión:', error);
        res.status(500).json({ success: false, message: 'Error al procesar la decisión', error: error.message });
    }
});

export default router;
