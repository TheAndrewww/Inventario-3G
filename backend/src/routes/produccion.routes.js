import { Router } from 'express';
import {
    obtenerDashboard,
    obtenerPorArea,
    completarEtapa,
    completarSubEtapa,
    validarCodigoArea,
    crearProyecto,
    actualizarProyecto,
    togglePausa,
    eliminarProyecto,
    obtenerEstadisticas,
    sincronizarConSheets,
    obtenerMesesDisponibles,
    previewProyectosSheets,
    obtenerArchivosDrive,
    sincronizarProyectoDrive,
    sincronizarTodosDrive
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

/**
 * POST /api/produccion/terminal/:id/completar-subetapa
 * Completar sub-etapa de producción (manufactura o herrería) desde terminal
 * Acceso: Público (validado por código)
 */
router.post('/terminal/:id/completar-subetapa', completarSubEtapa);

/**
 * GET /api/produccion/terminal/:id/archivos
 * Obtener archivos de Drive para terminal
 * Acceso: Público
 */
router.get('/terminal/:id/archivos', obtenerArchivosDrive);

/**
 * GET /api/produccion/dashboard-publico
 * Obtener dashboard para TV (sin auth)
 * Acceso: Público
 */
router.get('/dashboard-publico', obtenerDashboard);

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
 * GET /api/produccion/meses-disponibles
 * Obtener lista de meses disponibles en el spreadsheet
 * Acceso: Usuarios autenticados
 */
router.get('/meses-disponibles', obtenerMesesDisponibles);

/**
 * GET /api/produccion/preview-sheets/:mes
 * Vista previa de proyectos del spreadsheet
 * Acceso: Usuarios autenticados
 */
router.get('/preview-sheets/:mes', previewProyectosSheets);

/**
 * POST /api/produccion/sincronizar
 * Sincronizar proyectos desde Google Sheets
 * Acceso: Administrador
 */
router.post('/sincronizar', verificarRol('administrador'), sincronizarConSheets);

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
 * POST /api/produccion/:id/completar-subetapa
 * Completar sub-etapa de producción (manufactura o herrería)
 * Acceso: Usuarios autenticados
 */
router.post('/:id/completar-subetapa', completarSubEtapa);

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
 * POST /api/produccion/:id/toggle-pausa
 * Pausar o reanudar proyecto
 * Acceso: Administrador
 */
router.post('/:id/toggle-pausa', verificarRol('administrador'), togglePausa);

/**
 * DELETE /api/produccion/:id
 * Eliminar proyecto (soft delete)
 * Acceso: Solo Administrador
 */
router.delete('/:id', verificarRol('administrador'), eliminarProyecto);

// ========== RUTAS DE GOOGLE DRIVE ==========

/**
 * GET /api/produccion/:id/archivos
 * Obtener archivos de Drive de un proyecto
 * Acceso: Usuarios autenticados
 */
router.get('/:id/archivos', obtenerArchivosDrive);

/**
 * POST /api/produccion/:id/sincronizar-drive
 * Forzar sincronización con Drive de un proyecto
 * Acceso: Administrador, Almacenista
 */
router.post('/:id/sincronizar-drive', verificarRol('administrador', 'almacenista'), sincronizarProyectoDrive);

/**
 * POST /api/produccion/sincronizar-drive
 * Sincronizar todos los proyectos activos con Drive
 * Acceso: Solo Administrador
 */
router.post('/sincronizar-drive', verificarRol('administrador'), sincronizarTodosDrive);

export default router;

