import express from 'express';
import {
    obtenerCamionetas,
    obtenerCamionetaPorId,
    crearCamioneta,
    actualizarCamioneta,
    eliminarCamioneta,
    obtenerCamionetasPorEncargado,
    obtenerStockMinimo,
    configurarStockMinimo,
    eliminarStockMinimo,
    obtenerInventarioCamioneta,
    obtenerResumenInventario
} from '../controllers/camionetas.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verificarToken);

// GET /api/camionetas - Obtener todas las camionetas
router.get('/', obtenerCamionetas);

// GET /api/camionetas/encargado/:encargadoId - Obtener camionetas de un encargado
router.get('/encargado/:encargadoId', obtenerCamionetasPorEncargado);

// GET /api/camionetas/:id - Obtener una camioneta por ID
router.get('/:id', obtenerCamionetaPorId);

// POST /api/camionetas - Crear una nueva camioneta (solo admin y encargado)
router.post('/', verificarRol('administrador', 'encargado'), crearCamioneta);

// PUT /api/camionetas/:id - Actualizar una camioneta (solo admin y encargado)
router.put('/:id', verificarRol('administrador', 'encargado'), actualizarCamioneta);

// DELETE /api/camionetas/:id - Eliminar (desactivar) una camioneta (solo admin)
router.delete('/:id', verificarRol('administrador'), eliminarCamioneta);

// ============================================
// RUTAS DE STOCK MÍNIMO
// ============================================

// GET /api/camionetas/:id/stock-minimo - Obtener configuración de stock mínimo
router.get('/:id/stock-minimo', obtenerStockMinimo);

// POST /api/camionetas/:id/stock-minimo - Configurar stock mínimo (solo admin y encargado)
router.post('/:id/stock-minimo', verificarRol('administrador', 'encargado'), configurarStockMinimo);

// DELETE /api/camionetas/:id/stock-minimo/:stockId - Eliminar configuración de stock mínimo (solo admin y encargado)
router.delete('/:id/stock-minimo/:stockId', verificarRol('administrador', 'encargado'), eliminarStockMinimo);

// GET /api/camionetas/:id/inventario - Obtener inventario actual de la camioneta
router.get('/:id/inventario', obtenerInventarioCamioneta);

// GET /api/camionetas/:id/resumen-inventario - Obtener resumen comparando inventario actual vs stock mínimo
router.get('/:id/resumen-inventario', obtenerResumenInventario);

export default router;
