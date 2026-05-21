/**
 * Rutas Mi Equipo - Dashboard personal
 */

import express from 'express';
import { verificarToken } from '../middleware/auth.middleware.js';
import { obtenerMiEquipo, obtenerMiHistorial, listarUsuariosConEquipo } from '../controllers/miEquipo.controller.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verificarToken);

// Lista de usuarios con equipo asignado (solo admin)
router.get('/usuarios-con-equipo', listarUsuariosConEquipo);

// Dashboard personal (opcional ?usuario_id=N para admin)
router.get('/', obtenerMiEquipo);

// Historial de asignaciones del usuario
router.get('/historial', obtenerMiHistorial);

export default router;
