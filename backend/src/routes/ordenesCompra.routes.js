import express from 'express';
import {
  crearOrdenCompra,
  listarOrdenesCompra,
  obtenerOrdenCompra,
  listarSolicitudesCompra,
  enviarOrdenCompra,
  actualizarEstadoOrden,
  crearOrdenDesdeSolicitudes,
  obtenerEstadisticas,
  obtenerHistorialTrazabilidad
} from '../controllers/ordenesCompra.controller.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verificarToken);

// Rutas de órdenes de compra
router.get('/ordenes-compra/estadisticas', obtenerEstadisticas);
router.post('/ordenes-compra', crearOrdenCompra);
router.post('/ordenes-compra/desde-solicitudes', crearOrdenDesdeSolicitudes);
router.get('/ordenes-compra', listarOrdenesCompra);
router.get('/ordenes-compra/:id', obtenerOrdenCompra);
router.get('/ordenes-compra/:id/historial', obtenerHistorialTrazabilidad);
router.put('/ordenes-compra/:id/enviar', enviarOrdenCompra);
router.put('/ordenes-compra/:id/estado', actualizarEstadoOrden);

// Rutas de solicitudes de compra
router.get('/solicitudes-compra', listarSolicitudesCompra);

export default router;
