import express from 'express';
import { getUbicaciones, crearUbicacion, actualizarUbicacion, eliminarUbicacion } from '../controllers/ubicaciones.controller.js';
import { verificarToken, accesoInventario } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/ubicaciones
 * @desc    Obtener todas las ubicaciones
 * @access  Private (todos los roles autenticados)
 */
router.get('/', verificarToken, getUbicaciones);

/**
 * @route   POST /api/ubicaciones
 * @desc    Crear una nueva ubicación
 * @access  Private (almacen, encargado, administrador)
 */
router.post('/', verificarToken, accesoInventario, crearUbicacion);

/**
 * @route   PUT /api/ubicaciones/:id
 * @desc    Actualizar una ubicación
 * @access  Private (almacen, encargado, administrador)
 */
router.put('/:id', verificarToken, accesoInventario, actualizarUbicacion);

/**
 * @route   DELETE /api/ubicaciones/:id
 * @desc    Eliminar una ubicación
 * @access  Private (almacen, encargado, administrador)
 */
router.delete('/:id', verificarToken, accesoInventario, eliminarUbicacion);

export default router;
