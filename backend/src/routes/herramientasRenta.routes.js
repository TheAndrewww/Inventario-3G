import express from 'express';
import {
    obtenerTipos,
    obtenerTipoPorId,
    crearTipo,
    obtenerUnidadesPorTipo,
    obtenerUnidadesPorArticulo,
    obtenerHistorialUnidad,
    asignarHerramienta,
    devolverHerramienta,
    obtenerHerramientasPorUsuario,
    obtenerHerramientasPorEquipo,
    generarCodigoEAN13Unidad,
    generarCodigosMasivos,
    obtenerCodigoBarras,
    obtenerCodigoBarrasSVG
} from '../controllers/herramientasRenta.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * Todas las rutas requieren autenticación
 */
router.use(verificarToken);

// ========== RUTAS DE TIPOS DE HERRAMIENTA ==========

/**
 * GET /api/herramientas-renta/tipos
 * Obtener todos los tipos de herramienta de renta
 * Acceso: Todos los usuarios autenticados
 */
router.get('/tipos', obtenerTipos);

/**
 * GET /api/herramientas-renta/tipos/:id
 * Obtener un tipo por ID con sus unidades
 * Acceso: Todos los usuarios autenticados
 */
router.get('/tipos/:id', obtenerTipoPorId);

/**
 * POST /api/herramientas-renta/tipos
 * Crear un nuevo tipo de herramienta + N unidades automáticamente
 * Acceso: Solo administrador y almacenista
 *
 * Body: {
 *   nombre: string,
 *   descripcion?: string,
 *   categoria_id: number,
 *   ubicacion_id: number,
 *   proveedor_id?: number,
 *   precio_unitario: number,
 *   cantidad_unidades: number,
 *   imagen_url?: string,
 *   prefijo_codigo?: string (opcional, se genera automáticamente)
 * }
 */
router.post('/tipos', verificarRol('administrador', 'almacenista'), crearTipo);

// ========== RUTAS DE UNIDADES ==========

/**
 * GET /api/herramientas-renta/unidades/:tipoId
 * Obtener todas las unidades de un tipo específico
 * Acceso: Todos los usuarios autenticados
 */
router.get('/unidades/:tipoId', obtenerUnidadesPorTipo);

/**
 * GET /api/herramientas-renta/unidades-por-articulo/:articuloId
 * Obtener todas las unidades de un artículo específico (para inventario)
 * Acceso: Todos los usuarios autenticados
 */
router.get('/unidades-por-articulo/:articuloId', obtenerUnidadesPorArticulo);

/**
 * GET /api/herramientas-renta/historial/:unidadId
 * Obtener historial completo de asignaciones de una unidad
 * Acceso: Todos los usuarios autenticados
 */
router.get('/historial/:unidadId', obtenerHistorialUnidad);

// ========== RUTAS DE ASIGNACIÓN ==========

/**
 * POST /api/herramientas-renta/asignar
 * Asignar una herramienta a un usuario o equipo
 * Acceso: Administrador, almacenista, encargado
 *
 * Body: {
 *   unidad_id: number,
 *   usuario_id?: number,
 *   equipo_id?: number,
 *   observaciones?: string
 * }
 */
router.post('/asignar', verificarRol('administrador', 'almacenista', 'encargado'), asignarHerramienta);

/**
 * POST /api/herramientas-renta/devolver/:unidadId
 * Devolver una herramienta (marcarla como disponible)
 * Acceso: Administrador, almacenista, encargado
 *
 * Body: {
 *   observaciones?: string
 * }
 */
router.post('/devolver/:unidadId', verificarRol('administrador', 'almacenista', 'encargado'), devolverHerramienta);

// ========== RUTAS DE CONSULTA ==========

/**
 * GET /api/herramientas-renta/por-usuario/:usuarioId
 * Obtener todas las herramientas asignadas a un usuario
 * Acceso: Todos los usuarios autenticados
 */
router.get('/por-usuario/:usuarioId', obtenerHerramientasPorUsuario);

/**
 * GET /api/herramientas-renta/por-equipo/:equipoId
 * Obtener todas las herramientas asignadas a un equipo
 * Acceso: Todos los usuarios autenticados
 */
router.get('/por-equipo/:equipoId', obtenerHerramientasPorEquipo);

// ========== RUTAS DE CÓDIGOS DE BARRAS ==========

/**
 * POST /api/herramientas-renta/unidades/:unidadId/generar-ean13
 * Generar código EAN-13 para una unidad específica
 * Acceso: Administrador, almacenista
 */
router.post('/unidades/:unidadId/generar-ean13', verificarRol('administrador', 'almacenista'), generarCodigoEAN13Unidad);

/**
 * POST /api/herramientas-renta/tipos/:tipoId/generar-codigos-masivo
 * Generar códigos EAN-13 para todas las unidades de un tipo
 * Acceso: Administrador, almacenista
 */
router.post('/tipos/:tipoId/generar-codigos-masivo', verificarRol('administrador', 'almacenista'), generarCodigosMasivos);

/**
 * GET /api/herramientas-renta/unidades/:unidadId/barcode
 * Obtener imagen PNG del código de barras de una unidad
 * Acceso: Todos los usuarios autenticados
 */
router.get('/unidades/:unidadId/barcode', obtenerCodigoBarras);

/**
 * GET /api/herramientas-renta/unidades/:unidadId/barcode-svg
 * Obtener imagen SVG del código de barras de una unidad
 * Acceso: Todos los usuarios autenticados
 */
router.get('/unidades/:unidadId/barcode-svg', obtenerCodigoBarrasSVG);

export default router;
