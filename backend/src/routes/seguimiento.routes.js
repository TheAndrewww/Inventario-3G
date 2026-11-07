import express from 'express';
import { pendientesDePlanta, ticketsPorDia } from '../services/seguimientoPlanta.service.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';

/**
 * Seguimiento de Planta con sesión (6-nov-2026, revisión punto 9 d y e). Solo lectura y solo el administrador.
 *   GET /api/seguimiento/pendientes          pedidos de encargados sin atender, tickets sin llegar a Drive y celdas del
 *                                            calendario que Planta no entiende (lo mismo que la puerta entre sistemas)
 *   GET /api/seguimiento/tickets-drive?dias=14  cuántas órdenes de salida hubo y cuántos tickets se subieron a Drive
 *                                            cada día (1 a 31 días; 14 por omisión)
 */
const router = express.Router();
router.use(verificarToken, verificarRol('administrador'));

router.get('/pendientes', async (req, res) => {
    try {
        res.json({ success: true, data: await pendientesDePlanta() });
    } catch (e) {
        console.error('seguimiento/pendientes:', e.message);
        res.status(500).json({ success: false, message: 'No se pudieron armar los pendientes de Planta' });
    }
});

router.get('/tickets-drive', async (req, res) => {
    try {
        res.json({ success: true, data: { dias: await ticketsPorDia({ dias: req.query.dias }) } });
    } catch (e) {
        console.error('seguimiento/tickets-drive:', e.message);
        res.status(500).json({ success: false, message: 'No se pudo contar los tickets de salida' });
    }
});

export default router;
