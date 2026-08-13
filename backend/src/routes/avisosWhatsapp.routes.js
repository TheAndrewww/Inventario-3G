/**
 * Cola de avisos de WhatsApp — la consume el bot contable.
 *
 * No usa el JWT de usuarios: quien llama es otro sistema, no una persona.
 * Se autentica con el token compartido WHATSAPP_PUENTE_TOKEN.
 */

import express from 'express';
import { Op } from 'sequelize';
import { AvisoWhatsApp } from '../models/index.js';

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
            order: [['createdAt', 'ASC']],
            limit: limite,
            attributes: ['id', 'destino', 'mensaje', 'intentos', 'createdAt']
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

export default router;
