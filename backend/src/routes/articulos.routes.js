import express from 'express';
import {
    getArticulos,
    getArticuloById,
    getArticuloByEAN13,
    createArticulo,
    updateArticulo,
    deleteArticulo,
    getArticuloBarcode,
    getArticuloBarcodeSVG,
    getArticuloEtiqueta,
    uploadArticuloImagen,
    deleteArticuloImagen
} from '../controllers/articulos.controller.js';
import {
    verificarToken,
    esAdministrador,
    esEncargadoOAdmin,
    accesoInventario
} from '../middleware/auth.middleware.js';
import { uploadArticuloImagen as multerUpload } from '../config/cloudinary.js';

const router = express.Router();

/**
 * @route   GET /api/articulos
 * @desc    Obtener todos los artículos (con filtros opcionales)
 * @access  Private
 * @query   search, categoria_id, ubicacion_id, stock_bajo, activo, page, limit
 */
router.get('/', verificarToken, getArticulos);

/**
 * @route   GET /api/articulos/ean13/:codigoEAN13
 * @desc    Buscar artículo por código de barras EAN-13
 * @access  Private
 */
router.get('/ean13/:codigoEAN13', verificarToken, getArticuloByEAN13);

/**
 * @route   GET /api/articulos/:id/barcode
 * @desc    Generar código de barras PNG del artículo
 * @access  Private
 */
router.get('/:id/barcode', verificarToken, getArticuloBarcode);

/**
 * @route   GET /api/articulos/:id/barcode-svg
 * @desc    Generar código de barras SVG del artículo
 * @access  Private
 */
router.get('/:id/barcode-svg', verificarToken, getArticuloBarcodeSVG);

/**
 * @route   GET /api/articulos/:id/etiqueta
 * @desc    Generar etiqueta para imprimir con código de barras
 * @access  Private
 */
router.get('/:id/etiqueta', verificarToken, getArticuloEtiqueta);

/**
 * @route   GET /api/articulos/:id
 * @desc    Obtener un artículo por ID
 * @access  Private
 */
router.get('/:id', verificarToken, getArticuloById);

/**
 * @route   POST /api/articulos
 * @desc    Crear nuevo artículo (genera QR automáticamente)
 * @access  Private (Almacen, Supervisor, Admin)
 */
router.post('/', verificarToken, accesoInventario, createArticulo);

/**
 * @route   PUT /api/articulos/:id
 * @desc    Actualizar artículo existente
 * @access  Private (Almacen, Supervisor, Admin)
 */
router.put('/:id', verificarToken, accesoInventario, updateArticulo);

/**
 * @route   DELETE /api/articulos/:id
 * @desc    Eliminar (desactivar) artículo
 * @access  Private (Admin o Supervisor)
 */
router.delete('/:id', verificarToken, esEncargadoOAdmin, deleteArticulo);

/**
 * @route   POST /api/articulos/:id/imagen
 * @desc    Subir imagen para un artículo
 * @access  Private (Almacen, Supervisor, Admin)
 */
router.post('/:id/imagen', verificarToken, accesoInventario, multerUpload.single('imagen'), uploadArticuloImagen);

/**
 * @route   DELETE /api/articulos/:id/imagen
 * @desc    Eliminar imagen de un artículo
 * @access  Private (Admin o Supervisor)
 */
router.delete('/:id/imagen', verificarToken, esEncargadoOAdmin, deleteArticuloImagen);

export default router;
