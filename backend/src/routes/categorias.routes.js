import express from 'express';
import { getCategorias, crearCategoria, actualizarCategoria, eliminarCategoria } from '../controllers/categorias.controller.js';
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
 * @access  Private (almacen, encargado, administrador)
 */
router.post('/', verificarToken, accesoInventario, crearCategoria);

/**
 * @route   PUT /api/categorias/:id
 * @desc    Actualizar una categoría
 * @access  Private (almacen, encargado, administrador)
 */
router.put('/:id', verificarToken, accesoInventario, actualizarCategoria);

/**
 * @route   DELETE /api/categorias/:id
 * @desc    Eliminar una categoría
 * @access  Private (almacen, encargado, administrador)
 */
router.delete('/:id', verificarToken, accesoInventario, eliminarCategoria);

export default router;
