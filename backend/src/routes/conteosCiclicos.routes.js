import express from 'express';
import {
    getConteoHoy,
    getArticulosPendientes,
    registrarConteo,
    adelantarConteo,
    getReportes,
    getResumen,
    aplicarConteosAnteriores,
    getArticulosEnConteoActivo
} from '../controllers/conteosCiclicos.controller.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/conteos-ciclicos/hoy
 * @desc    Obtener conteo del día (auto-crea si no existe, asigna 20 artículos)
 * @access  Private
 */
router.get('/hoy', verificarToken, getConteoHoy);

/**
 * @route   GET /api/conteos-ciclicos/articulos-activos
 * @desc    Obtener IDs de artículos en el conteo activo de hoy
 * @access  Private
 */
router.get('/articulos-activos', verificarToken, getArticulosEnConteoActivo);

/**
 * @route   POST /api/conteos-ciclicos/adelantar
 * @desc    Generar un nuevo conteo extra cuando el actual está completado
 * @access  Private
 */
router.post('/adelantar', verificarToken, adelantarConteo);

/**
 * @route   GET /api/conteos-ciclicos/reportes
 * @desc    Obtener historial de conteos con estadísticas
 * @access  Private
 * @query   desde, hasta, page, limit
 */
router.get('/reportes', verificarToken, getReportes);

/**
 * @route   GET /api/conteos-ciclicos/:id/pendientes
 * @desc    Obtener artículos pendientes de contar en un día
 * @access  Private
 * @query   search
 */
router.get('/:id/pendientes', verificarToken, getArticulosPendientes);

/**
 * @route   POST /api/conteos-ciclicos/:id/contar
 * @desc    Registrar conteo de un artículo
 * @access  Private
 * @body    { articulo_id, cantidad_fisica, observaciones? }
 */
router.post('/:id/contar', verificarToken, registrarConteo);

/**
 * @route   GET /api/conteos-ciclicos/:id/resumen
 * @desc    Obtener resumen detallado de un día
 * @access  Private
 */
router.get('/:id/resumen', verificarToken, getResumen);

/**
 * @route   POST /api/conteos-ciclicos/aplicar-anteriores
 * @desc    Aplicar retroactivamente los conteos anteriores que no actualizaron stock
 * @access  Private (Admin)
 */
router.post('/aplicar-anteriores', verificarToken, aplicarConteosAnteriores);

export default router;
