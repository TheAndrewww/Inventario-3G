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
  crearOrdenDesdeSolicitudes: async (solicitudes_ids, proveedor_id, observaciones) => {
    const response = await api.post('/ordenes-compra/desde-solicitudes', {
      solicitudes_ids,
      proveedor_id,
      observaciones
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
  }
};

export default ordenesCompraService;
