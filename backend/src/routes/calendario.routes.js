import express from 'express';
import {
  obtenerCalendarioMes,
  obtenerProyectosDelDia,
  obtenerDistribucionEquiposMes,
  obtenerCalendarioActual
} from '../controllers/calendario.controller.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * Todas las rutas requieren autenticación
 */
router.use(verificarToken);

/**
 * GET /api/calendario/actual
 * Obtener calendario del mes actual
 * Acceso: Todos los usuarios autenticados
 */
router.get('/actual', obtenerCalendarioActual);

/**
 * GET /api/calendario/mes/:mes
 * Obtener calendario completo de un mes específico
 * Acceso: Todos los usuarios autenticados
 *
 * Ejemplo: /api/calendario/mes/noviembre
 */
router.get('/mes/:mes', obtenerCalendarioMes);

/**
 * GET /api/calendario/mes/:mes/dia/:dia
 * Obtener proyectos de un día específico
 * Acceso: Todos los usuarios autenticados
 *
 * Ejemplo: /api/calendario/mes/noviembre/dia/15
 */
router.get('/mes/:mes/dia/:dia', obtenerProyectosDelDia);

/**
 * GET /api/calendario/mes/:mes/equipos
 * Obtener distribución de equipos del mes
 * Acceso: Todos los usuarios autenticados
 *
 * Ejemplo: /api/calendario/mes/noviembre/equipos
 */
router.get('/mes/:mes/equipos', obtenerDistribucionEquiposMes);

export default router;
