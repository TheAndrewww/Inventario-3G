import express from 'express';
import { getUbicaciones, crearUbicacion } from '../controllers/ubicaciones.controller.js';
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
 * @access  Private (almacen, supervisor, administrador)
 */
router.post('/', verificarToken, accesoInventario, crearUbicacion);

export default router;
