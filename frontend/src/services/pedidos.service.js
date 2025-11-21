import api from './api';

const pedidosService = {
  /**
   * Crear un nuevo pedido
   */
  crear: async (data) => {
    const response = await api.post('/pedidos', data);
    return response.data;
  },

  /**
   * Listar todos los pedidos
   */
  listar: async (params = {}) => {
    const response = await api.get('/pedidos', { params });
    return response.data;
  },

  /**
   * Listar pedidos pendientes
   */
  listarPendientes: async () => {
    const response = await api.get('/pedidos/pendientes');
    return response.data;
  },

  /**
   * Obtener un pedido por ID
   */
  obtenerPorId: async (id) => {
    const response = await api.get(`/pedidos/${id}`);
    return response.data;
  },

  /**
   * Marcar artículo como dispersado
   */
  marcarDispersado: async (pedidoId, detalleId, dispersado) => {
    const response = await api.put(
      `/pedidos/${pedidoId}/detalles/${detalleId}/dispersar`,
      { dispersado }
    );
    return response.data;
  },

  /**
   * Cancelar pedido (SIN revertir stock)
   */
  cancelar: async (id, motivo) => {
    const response = await api.put(`/pedidos/${id}/cancelar`, { motivo });
    return response.data;
  },

  /**
   * Anular pedido (CON reversión completa de stock y solicitudes)
   * Solo para supervisores y administradores
   */
  anular: async (id, motivo) => {
    const response = await api.put(`/pedidos/${id}/anular`, { motivo });
    return response.data;
  },

  /**
   * Actualizar cantidad de un artículo en el pedido
   */
  actualizarCantidad: async (pedidoId, detalleId, cantidad) => {
    const response = await api.put(
      `/pedidos/${pedidoId}/detalles/${detalleId}/cantidad`,
      { cantidad }
    );
    return response.data;
  },

  /**
   * Agregar artículo a un pedido existente
   */
  agregarArticulo: async (pedidoId, articulo) => {
    const response = await api.post(`/pedidos/${pedidoId}/articulos`, articulo);
    return response.data;
  },

  /**
   * Eliminar artículo de un pedido pendiente
   */
  eliminarArticulo: async (pedidoId, detalleId) => {
    const response = await api.delete(`/pedidos/${pedidoId}/detalles/${detalleId}`);
    return response.data;
  },

  /**
   * Listar pedidos pendientes de aprobación (para encargados)
   */
  listarPendientesAprobacion: async () => {
    const response = await api.get('/pedidos/aprobacion/pendientes');
    return response.data;
  },

  /**
   * Aprobar pedido de equipo
   */
  aprobar: async (pedidoId) => {
    const response = await api.put(`/pedidos/${pedidoId}/aprobar`);
    return response.data;
  },

  /**
   * Rechazar pedido de equipo
   */
  rechazar: async (pedidoId, motivo_rechazo) => {
    const response = await api.put(`/pedidos/${pedidoId}/rechazar`, { motivo_rechazo });
    return response.data;
  },

  /**
   * Marcar pedido como listo para entrega y asignar encargado
   */
  marcarListo: async (pedidoId, encargadoId) => {
    const response = await api.put(`/pedidos/${pedidoId}/marcar-listo`, { encargado_id: encargadoId });
    return response.data;
  },

  /**
   * Listar pedidos listos para recibir (encargados)
   */
  listarPendientesRecepcion: async () => {
    const response = await api.get('/pedidos/recepcion/pendientes');
    return response.data;
  },

  /**
   * Recibir y aprobar pedido
   */
  recibir: async (pedidoId) => {
    const response = await api.put(`/pedidos/${pedidoId}/recibir`);
    return response.data;
  },

  /**
   * Rechazar entrega de pedido (vuelve a pendientes)
   */
  rechazarEntrega: async (pedidoId, motivo_rechazo) => {
    const response = await api.put(`/pedidos/${pedidoId}/rechazar-entrega`, { motivo_rechazo });
    return response.data;
  },

  /**
   * Listar encargados disponibles
   */
  listarSupervisores: async () => {
    const response = await api.get('/pedidos/encargados');
    return response.data;
  }
};

export default pedidosService;
