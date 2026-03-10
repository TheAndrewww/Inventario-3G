import express from 'express';
import {
    getAlmacenes,
    getAlmacenById,
    crearAlmacen,
    actualizarAlmacen,
    eliminarAlmacen,
    getCategoriasAlmacen,
    asignarCategoriaAlmacen,
    desasignarCategoriaAlmacen
} from '../controllers/almacenes.controller.js';
import { verificarToken, accesoInventario } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/almacenes
 * @desc    Obtener todos los almacenes
 * @access  Private
 */
router.get('/', verificarToken, getAlmacenes);

/**
 * @route   GET /api/almacenes/:id
 * @desc    Obtener un almacén por ID
 * @access  Private
 */
router.get('/:id', verificarToken, getAlmacenById);

/**
 * @route   POST /api/almacenes
 * @desc    Crear un nuevo almacén
 * @access  Private (almacen, encargado, administrador)
 */
router.post('/', verificarToken, accesoInventario, crearAlmacen);

/**
 * @route   PUT /api/almacenes/:id
 * @desc    Actualizar un almacén
 * @access  Private (almacen, encargado, administrador)
 */
router.put('/:id', verificarToken, accesoInventario, actualizarAlmacen);

/**
 * @route   DELETE /api/almacenes/:id
 * @desc    Eliminar un almacén
 * @access  Private (almacen, encargado, administrador)
 */
router.delete('/:id', verificarToken, accesoInventario, eliminarAlmacen);

/**
 * @route   GET /api/almacenes/:id/categorias
 * @desc    Obtener categorías de un almacén
 * @access  Private
 */
router.get('/:id/categorias', verificarToken, getCategoriasAlmacen);

/**
 * @route   POST /api/almacenes/:id/categorias
 * @desc    Asignar categoría a un almacén
 * @access  Private (almacen, encargado, administrador)
 */
router.post('/:id/categorias', verificarToken, accesoInventario, asignarCategoriaAlmacen);

/**
 * @route   DELETE /api/almacenes/:id/categorias/:categoriaId
 * @desc    Desasignar categoría de un almacén
 * @access  Private (almacen, encargado, administrador)
 */
router.delete('/:id/categorias/:categoriaId', verificarToken, accesoInventario, desasignarCategoriaAlmacen);

export default router;
