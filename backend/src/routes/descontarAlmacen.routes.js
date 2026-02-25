import express from 'express';
import {
    getAlmacenes,
    getArticulosPorAlmacen,
    descontarArticulo
} from '../controllers/descontarAlmacen.controller.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/descontar-almacen/almacenes
 * @desc    Obtener lista de almacenes con artículos
 * @access  Private
 */
router.get('/almacenes', verificarToken, getAlmacenes);

/**
 * @route   GET /api/descontar-almacen/:almacen/articulos
 * @desc    Obtener artículos de un almacén específico
 * @access  Private
 * @query   search
 */
router.get('/:almacen/articulos', verificarToken, getArticulosPorAlmacen);

/**
 * @route   POST /api/descontar-almacen/descontar
 * @desc    Descontar stock de un artículo
 * @access  Private
 * @body    { articulo_id, cantidad, observaciones? }
 */
router.post('/descontar', verificarToken, descontarArticulo);

export default router;
