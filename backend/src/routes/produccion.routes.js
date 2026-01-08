import { Router } from 'express';
import {
    obtenerDashboard,
    obtenerPorArea,
    completarEtapa,
    validarCodigoArea,
    crearProyecto,
    actualizarProyecto,
    eliminarProyecto,
    obtenerEstadisticas
} from '../controllers/produccion.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';

const router = Router();

// ========== RUTAS PÚBLICAS (para terminales) ==========

/**
 * POST /api/produccion/validar-codigo
 * Validar código de área para acceso de terminales
 * Acceso: Público
 */
router.post('/validar-codigo', validarCodigoArea);

/**
 * GET /api/produccion/terminal/:area
 * Obtener proyectos para terminal de área específica
 * Acceso: Público (validado por código)
 */
router.get('/terminal/:area', obtenerPorArea);

/**
 * POST /api/produccion/terminal/:id/completar
 * Completar etapa desde terminal (sin auth)
 * Acceso: Público (validado por código)
 */
router.post('/terminal/:id/completar', completarEtapa);

// ========== RUTAS PROTEGIDAS ==========

// Requiere autenticación para todas las siguientes rutas
router.use(verificarToken);

/**
 * GET /api/produccion/dashboard
 * Obtener dashboard completo
 * Acceso: Usuarios autenticados
 */
router.get('/dashboard', obtenerDashboard);

/**
 * GET /api/produccion/estadisticas
 * Obtener estadísticas generales
 * Acceso: Usuarios autenticados
 */
router.get('/estadisticas', obtenerEstadisticas);

/**
 * GET /api/produccion/area/:area
 * Obtener proyectos de un área (autenticado)
 * Acceso: Usuarios autenticados
 */
router.get('/area/:area', obtenerPorArea);

/**
 * POST /api/produccion/:id/completar-etapa
 * Completar etapa actual (con usuario registrado)
 * Acceso: Usuarios autenticados
 */
router.post('/:id/completar-etapa', completarEtapa);

/**
 * POST /api/produccion
 * Crear nuevo proyecto
 * Acceso: Administrador, Almacenista
 */
router.post('/', verificarRol('administrador', 'almacenista'), crearProyecto);

/**
 * PUT /api/produccion/:id
 * Actualizar proyecto
 * Acceso: Administrador, Almacenista
 */
router.put('/:id', verificarRol('administrador', 'almacenista'), actualizarProyecto);

/**
 * DELETE /api/produccion/:id
 * Eliminar proyecto (soft delete)
 * Acceso: Solo Administrador
 */
router.delete('/:id', verificarRol('administrador'), eliminarProyecto);

export default router;
