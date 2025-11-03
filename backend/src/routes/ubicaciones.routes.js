import express from 'express';
import { getUbicaciones } from '../controllers/ubicaciones.controller.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/ubicaciones
 * @desc    Obtener todas las ubicaciones
 * @access  Private
 */
router.get('/', verificarToken, getUbicaciones);

export default router;
