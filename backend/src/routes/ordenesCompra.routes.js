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
  mostrarFormularioRechazo,
  rechazarPorEmail,
  eliminarOrden,
  reabrirOrden,
  obtenerArticulosPendientesPorProveedor
} from '../controllers/ordenesCompra.controller.js';
import {
  analizarFactura,
  aprenderCruceFactura,
  cerrarConteo,
  listarConteosAbiertos
} from '../controllers/recepcionFactura.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';
import { testEmail } from '../services/email.service.js';
import multer from 'multer';

const router = express.Router();

// Fotos de factura: se procesan en memoria y no se guardan en disco
const uploadFactura = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }, // 12MB: fotos de celular sin comprimir
  fileFilter: (req, file, cb) => {
    const permitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
    if (permitidos.includes(file.mimetype)) cb(null, true);
    else cb(new Error('La factura debe ser una foto (JPG, PNG, WEBP)'), false);
  }
});

// Rutas públicas para aprobar/rechazar por email (usan token propio en query string/body)
router.get('/ordenes-compra/aprobar-email', aprobarPorEmail);
router.get('/ordenes-compra/rechazar-email', mostrarFormularioRechazo);
router.post('/ordenes-compra/rechazar-email', rechazarPorEmail);

// Ruta de prueba para verificar configuración de email
router.get('/ordenes-compra/test-email', testEmail);

// Todas las rutas a partir de aquí requieren autenticación
router.use(verificarToken);

// Rutas de órdenes de compra
router.get('/ordenes-compra/estadisticas', obtenerEstadisticas);
router.get('/ordenes-compra/articulos-pendientes/:proveedor_id', obtenerArticulosPendientesPorProveedor);
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

// Recepción a partir de la foto de la factura del proveedor
router.post(
  '/ordenes-compra/:id/analizar-factura',
  verificarRol('compras', 'almacen', 'administrador'),
  uploadFactura.array('facturas', 5),
  analizarFactura
);
router.post(
  '/ordenes-compra/:id/aprender-cruce',
  verificarRol('compras', 'almacen', 'administrador'),
  aprenderCruceFactura
);

// Ventana de conteo (reclamo) de 7 días
router.get('/ordenes-compra-conteos-abiertos', listarConteosAbiertos);
router.post(
  '/ordenes-compra/:id/conteo',
  verificarRol('compras', 'almacen', 'administrador'),
  cerrarConteo
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
