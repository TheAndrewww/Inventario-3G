import express from 'express';
import {
  crearOrdenCompra,
  listarOrdenesCompra,
  obtenerOrdenCompra,
  listarSolicitudesCompra,
  enviarOrdenCompra,
  actualizarEstadoOrden,
  actualizarOrdenCompra,
  crearOrdenDesdeSolicitudes,
  obtenerEstadisticas,
  obtenerHistorialTrazabilidad,
  anularOrdenCompra,
  cancelarSolicitudCompra,
  crearSolicitudCompraManual,
  recibirMercancia,
  obtenerHistorialRecepciones,
  obtenerProgresoRecepcion,
  completarOrdenManualmente,
  generarSolicitudesStockBajo,
  aprobarOrden,
  rechazarOrden,
  aprobarPorEmail,
  eliminarOrden,
  reabrirOrden
} from '../controllers/ordenesCompra.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';
import { testEmail } from '../services/email.service.js';

const router = express.Router();

// Ruta pública para aprobar por email (usa token propio en query string)
router.get('/ordenes-compra/aprobar-email', aprobarPorEmail);

// Ruta de prueba para verificar configuración de email
router.get('/ordenes-compra/test-email', testEmail);

// Todas las rutas a partir de aquí requieren autenticación
router.use(verificarToken);

// Rutas de órdenes de compra
router.get('/ordenes-compra/estadisticas', obtenerEstadisticas);
router.post('/ordenes-compra', crearOrdenCompra);
router.post('/ordenes-compra/desde-solicitudes', crearOrdenDesdeSolicitudes);
router.get('/ordenes-compra', listarOrdenesCompra);
router.get('/ordenes-compra/:id', obtenerOrdenCompra);
router.get('/ordenes-compra/:id/historial', obtenerHistorialTrazabilidad);
router.put(
  '/ordenes-compra/:id',
  verificarRol('compras', 'almacen', 'administrador'),
  actualizarOrdenCompra
);
router.put('/ordenes-compra/:id/enviar', enviarOrdenCompra);
router.put('/ordenes-compra/:id/estado', actualizarEstadoOrden);
router.put(
  '/ordenes-compra/:id/anular',
  verificarRol('compras', 'almacen', 'administrador'),
  anularOrdenCompra
);
router.put(
  '/ordenes-compra/:id/aprobar',
  verificarRol('administrador'),
  aprobarOrden
);
router.put(
  '/ordenes-compra/:id/rechazar',
  verificarRol('administrador'),
  rechazarOrden
);
router.put(
  '/ordenes-compra/:id/reabrir',
  verificarRol('compras', 'administrador'),
  reabrirOrden
);
router.delete(
  '/ordenes-compra/:id',
  verificarRol('compras', 'almacen', 'administrador'),
  eliminarOrden
);

// Rutas de recepción de mercancía
router.post(
  '/ordenes-compra/:id/recibir',
  verificarRol('compras', 'almacen', 'administrador'),
  recibirMercancia
);
router.get('/ordenes-compra/:id/recepciones', obtenerHistorialRecepciones);
router.get('/ordenes-compra/:id/progreso', obtenerProgresoRecepcion);
router.put(
  '/ordenes-compra/:id/completar',
  verificarRol('compras', 'almacen', 'administrador'),
  completarOrdenManualmente
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
router.post(
  '/solicitudes-compra/generar-stock-bajo',
  verificarRol('compras', 'almacen', 'administrador'),
  generarSolicitudesStockBajo
);

export default router;
