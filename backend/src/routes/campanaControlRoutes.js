import express from 'express';
import {
    getAllData,
    updateCell,
    getTotals,
    deleteCell
} from '../controllers/campanaControlController.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';

const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(verificarToken);

// GET /api/campana-control - Obtener todos los datos (lectura abierta a compras también)
router.get('/', getAllData);

// GET /api/campana-control/totals - Obtener totales
router.get('/totals', getTotals);

// PUT /api/campana-control/:quarter/:area/:week - Actualizar celda (compras NO puede escribir)
router.put('/:quarter/:area/:week', verificarRol('administrador', 'diseñador', 'encargado'), updateCell);

// DELETE /api/campana-control/:quarter/:area/:week - Eliminar celda (compras NO puede borrar)
router.delete('/:quarter/:area/:week', verificarRol('administrador', 'diseñador', 'encargado'), deleteCell);

export default router;
