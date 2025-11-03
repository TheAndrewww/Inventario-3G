import express from 'express';
import {
  obtenerUsuarios,
  obtenerUsuarioPorId,
  obtenerSupervisores,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario
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
 * @route   GET /api/usuarios/supervisores
 * @desc    Obtener solo supervisores activos
 * @access  Administrador, Supervisor
 */
router.get(
  '/supervisores',
  verificarToken,
  verificarRol('administrador', 'supervisor'),
  obtenerSupervisores
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

export default router;
