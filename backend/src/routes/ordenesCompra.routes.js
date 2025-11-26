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
  obtenerHistorialTrazabilidad,
  anularOrdenCompra,
  cancelarSolicitudCompra,
  crearSolicitudCompraManual
} from '../controllers/ordenesCompra.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';

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
router.put(
  '/ordenes-compra/:id/anular',
  verificarRol('compras', 'almacen', 'administrador'),
  anularOrdenCompra
);

// Rutas de solicitudes de compra
router.get('/solicitudes-compra', listarSolicitudesCompra);
router.post(
  '/solicitudes-compra',
  verificarRol('compras', 'almacen', 'administrador', 'diseñador'),
  crearSolicitudCompraManual
);
router.put(
  '/solicitudes-compra/:id/cancelar',
  verificarRol('compras', 'almacen', 'administrador', 'diseñador'),
  cancelarSolicitudCompra
);

export default router;
