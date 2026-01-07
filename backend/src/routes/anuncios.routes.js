import express from 'express';
import {
  obtenerAnunciosActivos,
  obtenerAnunciosHoy,
  generarAnuncioManual,
  generarAnunciosDesdeCalendario,
  incrementarVista,
  desactivarAnuncio,
  obtenerEstadisticas
} from '../controllers/anuncios.controller.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// ============================================
// RUTAS PÚBLICAS (sin autenticación)
// ============================================

/**
 * GET /api/anuncios/publico/activos
 * Obtener anuncios activos (últimos 7 días)
 * Acceso: Público (para pantallas)
 *
 * Query params:
 *   - dias: número de días hacia atrás (default: 7)
 */
router.get('/publico/activos', obtenerAnunciosActivos);

/**
 * GET /api/anuncios/publico/hoy
 * Obtener anuncios del día actual
 * Acceso: Público (para pantallas)
 */
router.get('/publico/hoy', obtenerAnunciosHoy);

/**
 * POST /api/anuncios/publico/:id/vista
 * Incrementar contador de vistas (para analytics)
 * Acceso: Público
 */
router.post('/publico/:id/vista', incrementarVista);

// ============================================
// RUTAS PRIVADAS (requieren autenticación)
// ============================================

/**
 * Middleware: Todas las rutas debajo requieren autenticación
 */
router.use(verificarToken);

/**
 * GET /api/anuncios/stats
 * Obtener estadísticas de anuncios
 * Acceso: Usuarios autenticados
 */
router.get('/stats', obtenerEstadisticas);

/**
 * POST /api/anuncios/generar
 * Generar un anuncio manualmente
 * Acceso: Administrador, Diseñador
 *
 * Body:
 *   - frase: string (requerido)
 *   - fecha: date (opcional)
 *   - mascotBase64: string (opcional)
 *   - proyectoNombre: string (opcional)
 *   - equipo: string (opcional)
 */
router.post('/generar', generarAnuncioManual);

/**
 * POST /api/anuncios/generar-desde-calendario
 * Generar anuncios automáticamente desde el calendario del día
 * Acceso: Administrador
 */
router.post('/generar-desde-calendario', generarAnunciosDesdeCalendario);

/**
 * PUT /api/anuncios/:id/desactivar
 * Desactivar un anuncio
 * Acceso: Administrador
 */
router.put('/:id/desactivar', desactivarAnuncio);

export default router;
