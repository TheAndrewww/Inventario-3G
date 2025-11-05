import express from 'express';
import {
    getMovimientos,
    getMovimientoById,
    createMovimiento,
    updateMovimiento,
    getMovimientosByUsuario
} from '../controllers/movimientos.controller.js';
import {
    verificarToken,
    esEncargadoOAdmin
} from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/movimientos
 * @desc    Obtener historial de movimientos (con filtros)
 * @access  Private
 * @query   tipo, usuario_id, fecha_desde, fecha_hasta, estado, page, limit
 */
router.get('/', verificarToken, getMovimientos);

/**
 * @route   GET /api/movimientos/usuario/:usuario_id
 * @desc    Obtener movimientos de un usuario específico
 * @access  Private
 */
router.get('/usuario/:usuario_id', verificarToken, getMovimientosByUsuario);

/**
 * @route   GET /api/movimientos/:id
 * @desc    Obtener detalle de un movimiento
 * @access  Private
 */
router.get('/:id', verificarToken, getMovimientoById);

/**
 * @route   POST /api/movimientos
 * @desc    Crear nuevo movimiento (retiro, devolución, ajuste)
 * @access  Private
 */
router.post('/', verificarToken, createMovimiento);

/**
 * @route   PUT /api/movimientos/:id
 * @desc    Actualizar estado de movimiento (aprobar/rechazar)
 * @access  Private (Supervisor o Admin)
 */
router.put('/:id', verificarToken, esEncargadoOAdmin, updateMovimiento);

export default router;
