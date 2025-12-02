import express from 'express';
import {
    getArticulos,
    getArticuloById,
    getArticuloByEAN13,
    createArticulo,
    updateArticulo,
    deleteArticulo,
    deleteArticuloPermanente,
    getArticuloBarcode,
    getArticuloBarcodeSVG,
    getArticuloEtiqueta,
    generarEtiquetasLote,
    generarEtiquetasMixtas,
    uploadArticuloImagen,
    deleteArticuloImagen,
    reprocessArticuloImagen,
    batchProcessImages,
    getProcessingQueueStatus,
    getProcessingQueueHistory,
    retryQueueItem,
    cleanProcessingQueue,
    diagnosticarImagenes
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
 * @route   POST /api/articulos/etiquetas/lote-mixto
 * @desc    Generar PDF con múltiples etiquetas mixtas (artículos + unidades de herramientas)
 * @access  Private
 * @body    { articulos_ids: [1, 2, 3, ...], unidades_ids: [1, 2, 3, ...] }
 */
router.post('/etiquetas/lote-mixto', verificarToken, generarEtiquetasMixtas);

/**
 * @route   POST /api/articulos/etiquetas/lote
 * @desc    Generar PDF con múltiples etiquetas (3cm x 9cm) en hojas A4
 * @access  Private
 * @body    { articulos_ids: [1, 2, 3, ...] }
 */
router.post('/etiquetas/lote', verificarToken, generarEtiquetasLote);

/**
 * @route   POST /api/articulos/diagnosticar-imagenes
 * @desc    Diagnosticar problemas con las URLs de imágenes de artículos
 * @access  Private
 * @body    { articulos_ids: [1, 2, 3, ...] }
 */
router.post('/diagnosticar-imagenes', verificarToken, diagnosticarImagenes);

/**
 * @route   POST /api/articulos/batch-process-images
 * @desc    Agregar múltiples artículos a la cola de procesamiento masivo con Gemini
 * @access  Private (Almacen, Supervisor, Admin)
 * @body    { articuloIds: [1, 2, 3, ...], prioridad: 0 }
 */
router.post('/batch-process-images', verificarToken, accesoInventario, batchProcessImages);

/**
 * @route   GET /api/articulos/processing-queue/status
 * @desc    Obtener estado actual de la cola de procesamiento
 * @access  Private
 */
router.get('/processing-queue/status', verificarToken, getProcessingQueueStatus);

/**
 * @route   GET /api/articulos/processing-queue/history
 * @desc    Obtener historial de la cola de procesamiento
 * @access  Private
 * @query   limit, offset
 */
router.get('/processing-queue/history', verificarToken, getProcessingQueueHistory);

/**
 * @route   POST /api/articulos/processing-queue/:id/retry
 * @desc    Reintentar procesamiento de un artículo fallido
 * @access  Private (Admin)
 */
router.post('/processing-queue/:id/retry', verificarToken, esAdministrador, retryQueueItem);

/**
 * @route   DELETE /api/articulos/processing-queue/clean
 * @desc    Limpiar cola (eliminar completados y fallidos antiguos)
 * @access  Private (Admin)
 * @query   dias (default: 7)
 */
router.delete('/processing-queue/clean', verificarToken, esAdministrador, cleanProcessingQueue);

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
 * @route   DELETE /api/articulos/:id/permanente
 * @desc    Eliminar permanentemente un artículo de la base de datos
 * @access  Private (Solo Admin)
 */
router.delete('/:id/permanente', verificarToken, esAdministrador, deleteArticuloPermanente);

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
 * @route   POST /api/articulos/:id/imagen/reprocess
 * @desc    Reprocesar imagen existente con Nano Banana (IA)
 * @access  Private (Almacen, Supervisor, Admin)
 */
router.post('/:id/imagen/reprocess', verificarToken, accesoInventario, reprocessArticuloImagen);

/**
 * @route   DELETE /api/articulos/:id/imagen
 * @desc    Eliminar imagen de un artículo
 * @access  Private (Admin o Supervisor)
 */
router.delete('/:id/imagen', verificarToken, esEncargadoOAdmin, deleteArticuloImagen);

export default router;
