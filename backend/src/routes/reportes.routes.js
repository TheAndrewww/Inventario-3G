import express from 'express';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';
import { reporteInventarioConsumibles, aplicarSugerencias } from '../controllers/reportes.controller.js';

const router = express.Router();

router.use(verificarToken);

// Solo administrador puede ver reportes y aplicar ajustes
router.get('/inventario-consumibles', verificarRol('administrador'), reporteInventarioConsumibles);
router.post('/aplicar-sugerencias', verificarRol('administrador'), aplicarSugerencias);

export default router;
