/**
 * Rutas Mi Equipo - Dashboard personal
 */

import express from 'express';
import { verificarToken } from '../middleware/auth.middleware.js';
import { obtenerMiEquipo, obtenerMiHistorial } from '../controllers/miEquipo.controller.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verificarToken);

// Dashboard personal
router.get('/', obtenerMiEquipo);

// Historial de asignaciones del usuario
router.get('/historial', obtenerMiHistorial);

export default router;
