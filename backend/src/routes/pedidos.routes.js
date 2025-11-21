import express from 'express';
import {
  crearPedido,
  listarPedidos,
  obtenerPedido,
  marcarArticuloDispersado,
  listarPedidosPendientes,
  cancelarPedido,
  anularPedido,
  actualizarCantidadArticulo,
  agregarArticuloAPedido,
  eliminarArticuloDePedido,
  aprobarPedido,
  rechazarPedido,
  listarPedidosPendientesAprobacion,
  marcarPedidoListo,
  listarPedidosListosParaRecibir,
  recibirPedido,
  rechazarPedidoListoParaEntrega,
  listarSupervisores
} from '../controllers/pedidos.controller.js';
import {
  verificarToken,
  verificarRol,
  accesoDiseño,
  accesoInventario
} from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   POST /api/pedidos
 * @desc    Crear un nuevo pedido de materiales
 * @access  Diseñador, Administrador (proyecto), Almacén (equipo)
 */
router.post(
  '/',
  verificarToken,
  verificarRol('diseñador', 'administrador', 'almacen'),
  crearPedido
);

/**
 * @route   GET /api/pedidos
 * @desc    Listar todos los pedidos (con filtros)
 * @access  Diseñador, Almacén, Supervisor, Administrador
 */
router.get(
  '/',
  verificarToken,
  verificarRol('diseñador', 'almacen', 'supervisor', 'administrador'),
  listarPedidos
);

/**
 * @route   GET /api/pedidos/pendientes
 * @desc    Listar solo pedidos pendientes
 * @access  Almacén, Supervisor, Administrador
 */
router.get(
  '/pendientes',
  verificarToken,
  accesoInventario, // almacen, supervisor, admin
  listarPedidosPendientes
);

/**
 * @route   GET /api/pedidos/supervisores
 * @desc    Obtener lista de supervisores disponibles
 * @access  Almacén, Supervisor, Administrador
 */
router.get(
  '/supervisores',
  verificarToken,
  accesoInventario,
  listarSupervisores
);

/**
 * @route   GET /api/pedidos/:id
 * @desc    Obtener un pedido específico
 * @access  Diseñador, Almacén, Supervisor, Administrador
 */
router.get(
  '/:id',
  verificarToken,
  verificarRol('diseñador', 'almacen', 'supervisor', 'administrador'),
  obtenerPedido
);

/**
 * @route   PUT /api/pedidos/:pedido_id/detalles/:detalle_id/dispersar
 * @desc    Marcar/desmarcar artículo como dispersado (checklist)
 * @access  Almacén, Supervisor, Administrador
 */
router.put(
  '/:pedido_id/detalles/:detalle_id/dispersar',
  verificarToken,
  accesoInventario, // almacen, supervisor, admin
  marcarArticuloDispersado
);

/**
 * @route   PUT /api/pedidos/:id/cancelar
 * @desc    Cancelar un pedido (SIN revertir stock)
 * @access  Creador del pedido, Supervisor, Administrador
 */
router.put(
  '/:id/cancelar',
  verificarToken,
  verificarRol('diseñador', 'supervisor', 'administrador'),
  cancelarPedido
);

/**
 * @route   PUT /api/pedidos/:id/anular
 * @desc    Anular un pedido completamente (CON reversión de stock y solicitudes)
 * @access  Supervisor, Administrador
 */
router.put(
  '/:id/anular',
  verificarToken,
  verificarRol('supervisor', 'administrador'),
  anularPedido
);

/**
 * @route   PUT /api/pedidos/:pedido_id/detalles/:detalle_id/cantidad
 * @desc    Actualizar cantidad de un artículo en el pedido
 * @access  Almacén, Supervisor, Administrador
 */
router.put(
  '/:pedido_id/detalles/:detalle_id/cantidad',
  verificarToken,
  accesoInventario,
  actualizarCantidadArticulo
);

/**
 * @route   POST /api/pedidos/:pedido_id/articulos
 * @desc    Agregar un artículo a un pedido existente
 * @access  Almacén, Supervisor, Administrador
 */
router.post(
  '/:pedido_id/articulos',
  verificarToken,
  accesoInventario,
  agregarArticuloAPedido
);

/**
 * @route   DELETE /api/pedidos/:pedido_id/detalles/:detalle_id
 * @desc    Eliminar un artículo de un pedido pendiente
 * @access  Almacén, Supervisor, Administrador
 */
router.delete(
  '/:pedido_id/detalles/:detalle_id',
  verificarToken,
  accesoInventario,
  eliminarArticuloDePedido
);

/**
 * @route   GET /api/pedidos/aprobacion/pendientes
 * @desc    Listar pedidos pendientes de aprobación (para supervisores)
 * @access  Supervisor, Administrador
 */
router.get(
  '/aprobacion/pendientes',
  verificarToken,
  verificarRol('supervisor', 'administrador'),
  listarPedidosPendientesAprobacion
);

/**
 * @route   PUT /api/pedidos/:pedido_id/aprobar
 * @desc    Aprobar un pedido de equipo
 * @access  Supervisor del equipo, Administrador
 */
router.put(
  '/:pedido_id/aprobar',
  verificarToken,
  verificarRol('supervisor', 'administrador'),
  aprobarPedido
);

/**
 * @route   PUT /api/pedidos/:pedido_id/rechazar
 * @desc    Rechazar un pedido de equipo
 * @access  Supervisor del equipo, Administrador
 */
router.put(
  '/:pedido_id/rechazar',
  verificarToken,
  verificarRol('supervisor', 'administrador'),
  rechazarPedido
);

/**
 * @route   PUT /api/pedidos/:pedido_id/marcar-listo
 * @desc    Marcar pedido como listo para entrega (100% dispersado) y asignar supervisor
 * @access  Almacén, Supervisor, Administrador
 */
router.put(
  '/:pedido_id/marcar-listo',
  verificarToken,
  accesoInventario,
  marcarPedidoListo
);

/**
 * @route   GET /api/pedidos/recepcion/pendientes
 * @desc    Listar pedidos listos para recibir (asignados al supervisor)
 * @access  Supervisor, Administrador
 */
router.get(
  '/recepcion/pendientes',
  verificarToken,
  verificarRol('supervisor', 'administrador'),
  listarPedidosListosParaRecibir
);

/**
 * @route   PUT /api/pedidos/:pedido_id/recibir
 * @desc    Recibir y aprobar un pedido listo para entrega
 * @access  Supervisor asignado, Administrador
 */
router.put(
  '/:pedido_id/recibir',
  verificarToken,
  verificarRol('supervisor', 'administrador'),
  recibirPedido
);

/**
 * @route   PUT /api/pedidos/:pedido_id/rechazar-entrega
 * @desc    Rechazar un pedido listo para entrega (vuelve a pendientes)
 * @access  Supervisor asignado, Administrador
 */
router.put(
  '/:pedido_id/rechazar-entrega',
  verificarToken,
  verificarRol('supervisor', 'administrador'),
  rechazarPedidoListoParaEntrega
);

export default router;
