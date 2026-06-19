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

// Listar — admin ve todas, compras las de reactivación, almacen solo las suyas
router.get(
  '/',
  verificarToken,
  verificarRol('almacen', 'encargado', 'administrador', 'compras'),
  listarSolicitudes
);

// Contador para badge
router.get(
  '/contador',
  verificarToken,
  verificarRol('almacen', 'encargado', 'administrador', 'compras'),
  contarPendientes
);

// Aprobar — admin (todas) y compras (solo reactivaciones, validado en el controlador)
router.patch(
  '/:id/aprobar',
  verificarToken,
  verificarRol('administrador', 'compras'),
  aprobarSolicitud
);

// Rechazar — admin (todas) y compras (solo reactivaciones, validado en el controlador)
router.patch(
  '/:id/rechazar',
  verificarToken,
  verificarRol('administrador', 'compras'),
  rechazarSolicitud
);

export default router;
