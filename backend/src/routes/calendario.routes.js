import express from 'express';
import {
  obtenerCalendarioMes,
  obtenerProyectosDelDia,
  obtenerDistribucionEquiposMes,
  obtenerCalendarioActual
} from '../controllers/calendario.controller.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// ============================================
// RUTAS PÚBLICAS (sin autenticación)
// ============================================

/**
 * GET /api/calendario/publico/actual
 * Obtener calendario del mes actual (público)
 * Acceso: Público (sin autenticación)
 */
router.get('/publico/actual', obtenerCalendarioActual);

/**
 * GET /api/calendario/publico/mes/:mes
 * Obtener calendario completo de un mes específico (público)
 * Acceso: Público (sin autenticación)
 *
 * Ejemplo: /api/calendario/publico/mes/NOVIEMBRE
 */
router.get('/publico/mes/:mes', obtenerCalendarioMes);

/**
 * GET /api/calendario/publico/mes/:mes/equipos
 * Obtener distribución de equipos del mes (público)
 * Acceso: Público (sin autenticación)
 *
 * Ejemplo: /api/calendario/publico/mes/NOVIEMBRE/equipos
 */
router.get('/publico/mes/:mes/equipos', obtenerDistribucionEquiposMes);

// ============================================
// RUTAS PRIVADAS (requieren autenticación)
// ============================================

/**
 * Middleware: Todas las rutas debajo requieren autenticación
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
 * Ejemplo: /api/calendario/mes/NOVIEMBRE
 */
router.get('/mes/:mes', obtenerCalendarioMes);

/**
 * GET /api/calendario/mes/:mes/dia/:dia
 * Obtener proyectos de un día específico
 * Acceso: Todos los usuarios autenticados
 *
 * Ejemplo: /api/calendario/mes/NOVIEMBRE/dia/15
 */
router.get('/mes/:mes/dia/:dia', obtenerProyectosDelDia);

/**
 * GET /api/calendario/mes/:mes/equipos
 * Obtener distribución de equipos del mes
 * Acceso: Todos los usuarios autenticados
 *
 * Ejemplo: /api/calendario/mes/NOVIEMBRE/equipos
 */
router.get('/mes/:mes/equipos', obtenerDistribucionEquiposMes);

export default router;
