import express from 'express';
import { getCategorias, crearCategoria } from '../controllers/categorias.controller.js';
import { verificarToken, accesoInventario } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/categorias
 * @desc    Obtener todas las categorías
 * @access  Private (todos los roles autenticados)
 */
router.get('/', verificarToken, getCategorias);

/**
 * @route   POST /api/categorias
 * @desc    Crear una nueva categoría
 * @access  Private (almacen, supervisor, administrador)
 */
router.post('/', verificarToken, accesoInventario, crearCategoria);

export default router;
