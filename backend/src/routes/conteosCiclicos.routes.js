import express from 'express';
import {
    getConteoHoy,
    getArticulosPendientes,
    registrarConteo,
    getReportes,
    getResumen
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

export default router;
