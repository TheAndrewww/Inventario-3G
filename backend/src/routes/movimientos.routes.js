import express from 'express';
import {
    getMovimientos,
    getMovimientoById,
    createMovimiento,
    updateMovimiento,
    getMovimientosByUsuario,
    crearMovimientoRapido,
    getConsolidadoDestinos
} from '../controllers/movimientos.controller.js';
import {
    verificarToken,
    esEncargadoOAdmin,
    accesoInventario,
    accesoGestion
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
 * @route   GET /api/movimientos/consolidado
 * @desc    Corte por destino de los movimientos rápidos (camionetas y áreas)
 * @access  Private (encargado, administrador)
 * @nota    Debe declararse antes de /:id para que no lo capture esa ruta
 */
router.get('/consolidado', verificarToken, accesoGestion, getConsolidadoDestinos);

/**
 * @route   GET /api/movimientos/:id
 * @desc    Obtener detalle de un movimiento
 * @access  Private
 */
router.get('/:id', verificarToken, getMovimientoById);

/**
 * @route   POST /api/movimientos/rapido
 * @desc    Entrada/salida rápida hacia camioneta o área (sin ticket ni aprobación)
 * @access  Private (almacen, compras, encargado, administrador)
 */
router.post('/rapido', verificarToken, accesoInventario, crearMovimientoRapido);

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
