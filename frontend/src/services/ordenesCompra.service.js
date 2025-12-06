import api from './api';

const ordenesCompraService = {
  // Crear una nueva orden de compra
  crearOrden: async (ordenData) => {
    const response = await api.post('/ordenes-compra', ordenData);
    return response.data;
  },

  // Listar todas las órdenes de compra
  listarOrdenes: async (filtros = {}) => {
    const params = new URLSearchParams(filtros).toString();
    const response = await api.get(`/ordenes-compra?${params}`);
    return response.data;
  },

  // Obtener una orden de compra por ID
  obtenerOrden: async (id) => {
    const response = await api.get(`/ordenes-compra/${id}`);
    return response.data;
  },

  // Actualizar orden de compra (solo en estado borrador)
  actualizarOrden: async (id, ordenData) => {
    const response = await api.put(`/ordenes-compra/${id}`, ordenData);
    return response.data;
  },

  // Enviar orden al proveedor
  enviarOrden: async (id) => {
    const response = await api.put(`/ordenes-compra/${id}/enviar`);
    return response.data;
  },

  // Actualizar estado de la orden
  actualizarEstado: async (id, estado) => {
    const response = await api.put(`/ordenes-compra/${id}/estado`, { estado });
    return response.data;
  },

  // Listar solicitudes de compra
  listarSolicitudes: async (filtros = {}) => {
    const params = new URLSearchParams(filtros).toString();
    const response = await api.get(`/solicitudes-compra?${params}`);
    return response.data;
  },

  // Crear orden de compra desde solicitudes pendientes
  crearOrdenDesdeSolicitudes: async (solicitudes_ids, proveedor_id, observaciones, cantidades_custom = null, fecha_llegada_estimada = null) => {
    const response = await api.post('/ordenes-compra/desde-solicitudes', {
      solicitudes_ids,
      proveedor_id,
      observaciones,
      cantidades_custom,
      fecha_llegada_estimada
    });
    return response.data;
  },

  // Obtener estadísticas de órdenes de compra
  obtenerEstadisticas: async () => {
    const response = await api.get('/ordenes-compra/estadisticas');
    return response.data;
  },

  // Obtener historial de trazabilidad de una orden
  obtenerHistorial: async (id) => {
    const response = await api.get(`/ordenes-compra/${id}/historial`);
    return response.data;
  },

  // Anular orden de compra (CON reversión completa de stock y solicitudes)
  anular: async (id, motivo) => {
    const response = await api.put(`/ordenes-compra/${id}/anular`, { motivo });
    return response.data;
  },

  // Cancelar solicitud de compra
  cancelarSolicitud: async (id, motivo) => {
    const response = await api.put(`/solicitudes-compra/${id}/cancelar`, { motivo });
    return response.data;
  },

  // Crear solicitud de compra manual
  crearSolicitudManual: async (articulo_id, cantidad_solicitada, prioridad = 'media', motivo = '') => {
    const response = await api.post('/solicitudes-compra', {
      articulo_id,
      cantidad_solicitada,
      prioridad,
      motivo
    });
    return response.data;
  },

  // ============================================
  // NUEVOS MÉTODOS: RECEPCIÓN DE MERCANCÍA
  // ============================================

  // Recibir mercancía de una orden de compra (parcial o total)
  recibirMercancia: async (id, data) => {
    const response = await api.post(`/ordenes-compra/${id}/recibir`, data);
    return response.data;
  },

  // Obtener historial de recepciones de una orden
  obtenerHistorialRecepciones: async (id) => {
    const response = await api.get(`/ordenes-compra/${id}/recepciones`);
    return response.data;
  },

  // Obtener progreso de recepción por artículo
  obtenerProgresoRecepcion: async (id) => {
    const response = await api.get(`/ordenes-compra/${id}/progreso`);
    return response.data;
  },

  // Completar orden manualmente (cuando el proveedor no enviará el resto)
  completarManualmente: async (id, motivo) => {
    const response = await api.put(`/ordenes-compra/${id}/completar`, { motivo });
    return response.data;
  }
};

export default ordenesCompraService;
