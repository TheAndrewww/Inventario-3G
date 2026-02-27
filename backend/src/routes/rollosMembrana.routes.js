import express from 'express';
import {
    getArticulosMembrana,
    getRollosByArticulo,
    crearRollo,
    editarRollo,
    desactivarRollo,
    descontarMetraje
} from '../controllers/rollosMembrana.controller.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/rollos-membrana/articulos
 * @desc    Obtener artículos del almacén de Membranas con resumen de rollos
 * @access  Private
 * @query   search
 */
router.get('/articulos', verificarToken, getArticulosMembrana);

/**
 * @route   GET /api/rollos-membrana/:articuloId/rollos
 * @desc    Obtener rollos de un artículo específico
 * @access  Private
 * @query   estado (opcional: disponible, en_uso, agotado)
 */
router.get('/:articuloId/rollos', verificarToken, getRollosByArticulo);

/**
 * @route   POST /api/rollos-membrana/:articuloId/rollos
 * @desc    Crear un nuevo rollo para un artículo
 * @access  Private
 * @body    { identificador, metraje_total, color?, observaciones?, fecha_ingreso? }
 */
router.post('/:articuloId/rollos', verificarToken, crearRollo);

/**
 * @route   PUT /api/rollos-membrana/rollos/:rolloId
 * @desc    Editar un rollo existente
 * @access  Private
 * @body    { identificador?, metraje_total?, metraje_restante?, color?, estado?, observaciones? }
 */
router.put('/rollos/:rolloId', verificarToken, editarRollo);

/**
 * @route   DELETE /api/rollos-membrana/rollos/:rolloId
 * @desc    Desactivar (soft delete) un rollo
 * @access  Private
 */
router.delete('/rollos/:rolloId', verificarToken, desactivarRollo);

/**
 * @route   POST /api/rollos-membrana/rollos/:rolloId/descontar
 * @desc    Descontar metraje de un rollo
 * @access  Private
 * @body    { cantidad, observaciones? }
 */
router.post('/rollos/:rolloId/descontar', verificarToken, descontarMetraje);

export default router;
