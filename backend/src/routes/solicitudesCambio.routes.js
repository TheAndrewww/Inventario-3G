import express from 'express';
import {
  crearSolicitud,
  listarSolicitudes,
  contarPendientes,
  aprobarSolicitud,
  rechazarSolicitud
} from '../controllers/solicitudesCambio.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';

const router = express.Router();

// Crear solicitud — almacen, encargado o admin
router.post(
  '/',
  verificarToken,
  verificarRol('almacen', 'encargado', 'administrador'),
  crearSolicitud
);

// Listar — admin ve todas, almacen solo las suyas
router.get(
  '/',
  verificarToken,
  verificarRol('almacen', 'encargado', 'administrador'),
  listarSolicitudes
);

// Contador para badge
router.get(
  '/contador',
  verificarToken,
  verificarRol('almacen', 'encargado', 'administrador'),
  contarPendientes
);

// Aprobar — solo admin
router.patch(
  '/:id/aprobar',
  verificarToken,
  verificarRol('administrador'),
  aprobarSolicitud
);

// Rechazar — solo admin
router.patch(
  '/:id/rechazar',
  verificarToken,
  verificarRol('administrador'),
  rechazarSolicitud
);

export default router;
