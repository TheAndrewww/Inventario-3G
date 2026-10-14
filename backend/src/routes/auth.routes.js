import express from 'express';
import {
    register,
    login,
    verify,
    getMe,
    cambiarPassword
} from '../controllers/auth.controller.js';
import {
    verificarToken,
    esAdministrador
} from '../middleware/auth.middleware.js';
import { limiteLogin } from '../middleware/limiteLogin.middleware.js';

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Registrar nuevo usuario (solo administradores)
 * @access  Private (Admin)
 */
router.post('/register', verificarToken, esAdministrador, register);

/**
 * @route   POST /api/auth/login
 * @desc    Iniciar sesión (con límite de intentos fallidos, A10 · PLA-02: ver LOGIN_LIMITE)
 * @access  Public
 */
router.post('/login', limiteLogin, login);

/**
 * @route   GET /api/auth/verify
 * @desc    Verificar token JWT
 * @access  Private
 */
router.get('/verify', verificarToken, verify);

/**
 * @route   GET /api/auth/me
 * @desc    Obtener información del usuario autenticado
 * @access  Private
 */
router.get('/me', verificarToken, getMe);

/**
 * @route   PUT /api/auth/cambiar-password
 * @desc    Cambiar contraseña del usuario autenticado
 * @access  Private
 */
router.put('/cambiar-password', verificarToken, cambiarPassword);

export default router;
