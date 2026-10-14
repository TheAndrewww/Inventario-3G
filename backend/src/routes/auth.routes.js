import express from 'express';
import {
    register,
    login,
    verify,
    getMe,
    cambiarPassword,
    entrarConCuentas3g,
    avisoCuentas3g,
    estadoCuentas3g,
    reporteCuentas3g
} from '../controllers/auth.controller.js';
import {
    verificarToken,
    esAdministrador
} from '../middleware/auth.middleware.js';
import { limiteLogin, limiteCuentas3g } from '../middleware/limiteLogin.middleware.js';
import { soloConCuentas3g } from '../services/cuentas3g.service.js';

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
 * @route   POST /api/auth/cuentas3g
 * @desc    Entrar con Cuentas 3G (E1 · PLA-23): { code, code_verifier, nonce } → { usuario, token }, como /login.
 *          Con CUENTAS3G_MODO apagado no existe (responde como hoy). La cubre el límite de A10.
 * @access  Public
 */
router.post('/cuentas3g', soloConCuentas3g, limiteCuentas3g, entrarConCuentas3g);

/**
 * @route   POST /api/auth/cuentas3g/aviso
 * @desc    Aviso de baja de Cuentas 3G (OpenID Back-Channel Logout, logout_token firmado). Con apagado no existe.
 * @access  Cuentas 3G (se valida la firma)
 */
router.post('/cuentas3g/aviso', soloConCuentas3g, avisoCuentas3g);

/**
 * @route   GET /api/auth/cuentas3g/estado
 * @desc    { modo, emergencia } para la pantalla de entrada (E1 · PLA-24). Sin datos. Con apagado no existe.
 * @access  Public
 */
router.get('/cuentas3g/estado', soloConCuentas3g, estadoCuentas3g);

/**
 * @route   GET /api/auth/cuentas3g/reporte
 * @desc    «Quién no ha entrado con su cuenta 3G» y entradas de emergencia (E1 · PLA-24). Con apagado no existe.
 * @access  Private (Admin)
 */
router.get('/cuentas3g/reporte', soloConCuentas3g, verificarToken, esAdministrador, reporteCuentas3g);

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
