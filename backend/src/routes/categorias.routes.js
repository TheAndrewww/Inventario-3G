import express from 'express';
import { getCategorias } from '../controllers/categorias.controller.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/categorias
 * @desc    Obtener todas las categorías
 * @access  Private
 */
router.get('/', verificarToken, getCategorias);

export default router;
