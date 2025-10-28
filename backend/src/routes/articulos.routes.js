import express from 'express';
import {
    getArticulos,
    getArticuloById,
    getArticuloByQR,
    createArticulo,
    updateArticulo,
    deleteArticulo,
    regenerarQR
} from '../controllers/articulos.controller.js';
import {
    verificarToken,
    esAdministrador,
    esSupervisorOAdmin
} from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/articulos
 * @desc    Obtener todos los artículos (con filtros opcionales)
 * @access  Private
 * @query   search, categoria_id, ubicacion_id, stock_bajo, activo, page, limit
 */
router.get('/', verificarToken, getArticulos);

/**
 * @route   GET /api/articulos/qr/:codigoQR
 * @desc    Buscar artículo por código QR
 * @access  Private
 */
router.get('/qr/:codigoQR', verificarToken, getArticuloByQR);

/**
 * @route   GET /api/articulos/:id
 * @desc    Obtener un artículo por ID
 * @access  Private
 */
router.get('/:id', verificarToken, getArticuloById);

/**
 * @route   POST /api/articulos
 * @desc    Crear nuevo artículo (genera QR automáticamente)
 * @access  Private (Admin)
 */
router.post('/', verificarToken, esAdministrador, createArticulo);

/**
 * @route   PUT /api/articulos/:id
 * @desc    Actualizar artículo existente
 * @access  Private (Admin)
 */
router.put('/:id', verificarToken, esAdministrador, updateArticulo);

/**
 * @route   DELETE /api/articulos/:id
 * @desc    Eliminar (desactivar) artículo
 * @access  Private (Admin)
 */
router.delete('/:id', verificarToken, esAdministrador, deleteArticulo);

/**
 * @route   POST /api/articulos/:id/regenerar-qr
 * @desc    Regenerar código QR de un artículo
 * @access  Private (Admin)
 */
router.post('/:id/regenerar-qr', verificarToken, esAdministrador, regenerarQR);

export default router;
