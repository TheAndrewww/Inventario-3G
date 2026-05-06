import express from 'express';
import {
  obtenerUsuarios,
  obtenerUsuarioPorId,
  obtenerEncargados,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
  reactivarUsuario,
  eliminarUsuarioPermanente
} from '../controllers/usuarios.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/usuarios
 * @desc    Obtener todos los usuarios
 * @access  Administrador
 */
router.get(
  '/',
  verificarToken,
  verificarRol('administrador'),
  obtenerUsuarios
);

/**
 * @route   GET /api/usuarios/encargados
 * @desc    Obtener solo encargados activos
 * @access  Administrador, Encargado, Diseñador, Compras
 */
router.get(
  '/encargados',
  verificarToken,
  verificarRol('administrador', 'encargado', 'diseñador', 'compras'),
  obtenerEncargados
);

/**
 * @route   GET /api/usuarios/:id
 * @desc    Obtener usuario por ID
 * @access  Administrador
 */
router.get(
  '/:id',
  verificarToken,
  verificarRol('administrador'),
  obtenerUsuarioPorId
);

/**
 * @route   POST /api/usuarios
 * @desc    Crear nuevo usuario
 * @access  Administrador
 */
router.post(
  '/',
  verificarToken,
  verificarRol('administrador'),
  crearUsuario
);

/**
 * @route   PUT /api/usuarios/:id
 * @desc    Actualizar usuario
 * @access  Administrador
 */
router.put(
  '/:id',
  verificarToken,
  verificarRol('administrador'),
  actualizarUsuario
);

/**
 * @route   DELETE /api/usuarios/:id
 * @desc    Eliminar usuario (soft delete)
 * @access  Administrador
 */
router.delete(
  '/:id',
  verificarToken,
  verificarRol('administrador'),
  eliminarUsuario
);

/**
 * @route   POST /api/usuarios/:id/reactivar
 * @desc    Reactivar usuario desactivado
 * @access  Administrador
 */
router.post(
  '/:id/reactivar',
  verificarToken,
  verificarRol('administrador'),
  reactivarUsuario
);

/**
 * @route   DELETE /api/usuarios/:id/permanente
 * @desc    Eliminar usuario permanentemente (solo si ya está desactivado y sin FK)
 * @access  Administrador
 */
router.delete(
  '/:id/permanente',
  verificarToken,
  verificarRol('administrador'),
  eliminarUsuarioPermanente
);

export default router;
