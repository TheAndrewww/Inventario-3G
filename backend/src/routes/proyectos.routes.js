import express from 'express';
import {
  obtenerProyectos,
  obtenerProyectoPorId,
  crearProyecto,
  actualizarProyecto,
  eliminarProyecto,
  buscarProyectos,
  obtenerMovimientosProyecto,
  obtenerCostosProyecto
} from '../controllers/proyectos.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * Todas las rutas requieren autenticación
 */
router.use(verificarToken);

/**
 * GET /api/proyectos
 * Obtener todos los proyectos (con filtros opcionales)
 * Acceso: Todos los usuarios autenticados
 */
router.get('/', obtenerProyectos);

/**
 * GET /api/proyectos/buscar/:query
 * Buscar proyectos por nombre (autocomplete)
 * Acceso: Todos los usuarios autenticados
 */
router.get('/buscar/:query', buscarProyectos);

/**
 * GET /api/proyectos/:id
 * Obtener un proyecto específico por ID
 * Acceso: Todos los usuarios autenticados
 */
router.get('/:id', obtenerProyectoPorId);

/**
 * GET /api/proyectos/:id/movimientos
 * Obtener movimientos de un proyecto
 * Acceso: Todos los usuarios autenticados
 */
router.get('/:id/movimientos', obtenerMovimientosProyecto);

/**
 * GET /api/proyectos/:id/costos
 * Obtener costos de un proyecto
 * Acceso: Administrador, encargado, compras
 */
router.get(
  '/:id/costos',
  verificarRol('administrador', 'encargado', 'compras'),
  obtenerCostosProyecto
);

/**
 * POST /api/proyectos
 * Crear un nuevo proyecto
 * Acceso: Administrador, encargado
 */
router.post(
  '/',
  verificarRol('administrador', 'encargado'),
  crearProyecto
);

/**
 * PUT /api/proyectos/:id
 * Actualizar un proyecto existente
 * Acceso: Administrador, encargado
 */
router.put(
  '/:id',
  verificarRol('administrador', 'encargado'),
  actualizarProyecto
);

/**
 * DELETE /api/proyectos/:id
 * Eliminar (desactivar) un proyecto
 * Acceso: Solo administrador
 */
router.delete(
  '/:id',
  verificarRol('administrador'),
  eliminarProyecto
);

export default router;
