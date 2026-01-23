import express from 'express';
import {
    getAllData,
    updateCell,
    getTotals,
    deleteCell
} from '../controllers/campanaControlController.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(verificarToken);

// GET /api/campana-control - Obtener todos los datos
router.get('/', getAllData);

// GET /api/campana-control/totals - Obtener totales
router.get('/totals', getTotals);

// PUT /api/campana-control/:quarter/:area/:week - Actualizar celda
router.put('/:quarter/:area/:week', updateCell);

// DELETE /api/campana-control/:quarter/:area/:week - Eliminar celda
router.delete('/:quarter/:area/:week', deleteCell);

export default router;
