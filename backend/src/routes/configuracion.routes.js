import express from 'express';
import {
  obtenerConfiguracion,
  actualizarAjusteDirecto
} from '../controllers/configuracion.controller.js';
import { verificarToken, esAdministrador } from '../middleware/auth.middleware.js';

const router = express.Router();

// Leer configuración — cualquier usuario autenticado
router.get('/', verificarToken, obtenerConfiguracion);

// Activar/desactivar ajuste directo de almacén — solo administrador
router.put('/ajuste-directo', verificarToken, esAdministrador, actualizarAjusteDirecto);

export default router;
