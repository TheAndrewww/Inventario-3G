import api from './api';

const proveedoresService = {
  /**
   * Listar todos los proveedores
   */
  listar: async (params = {}) => {
    const response = await api.get('/proveedores', { params });
    return response.data;
  },

  /**
   * Obtener un proveedor por ID
   */
  obtenerPorId: async (id) => {
    const response = await api.get(`/proveedores/${id}`);
    return response.data;
  },

  /**
   * Crear un nuevo proveedor
   */
  crear: async (data) => {
    const response = await api.post('/proveedores', data);
    return response.data;
  },

  /**
   * Actualizar un proveedor
   */
  actualizar: async (id, data) => {
    const response = await api.put(`/proveedores/${id}`, data);
    return response.data;
  },

  /**
   * Eliminar (desactivar) un proveedor
   */
  eliminar: async (id) => {
    const response = await api.delete(`/proveedores/${id}`);
    return response.data;
  },

  /**
   * B3 · PLA-20: fichas maestras y crédito de CTAS CRÉDITO (solo los pide Diseño 3G)
   */
  fichas: async () => {
    const response = await api.get('/proveedores/fichas');
    return response.data;
  },

  /**
   * B3 · PLA-20: reporte de proveedores sin RFC (solo lee)
   */
  reporteSinRfc: async () => {
    const response = await api.get('/proveedores/reporte-sin-rfc');
    return response.data;
  },

  /**
   * B3 · PLA-20: guardar la ficha maestra de un proveedor
   */
  guardarFicha: async (id, ficha) => {
    const response = await api.put(`/proveedores/${id}/ficha`, ficha);
    return response.data;
  },

  /**
   * Obtener artículos de un proveedor
   */
  obtenerArticulos: async (id, activo = true) => {
    const response = await api.get(`/proveedores/${id}/articulos`, {
      params: { activo }
    });
    return response.data;
  },

  /**
   * Buscar proveedores
   */
  buscar: async (busqueda, params = {}) => {
    const response = await api.get('/proveedores', {
      params: { busqueda, ...params }
    });
    return response.data;
  }
};

export default proveedoresService;
