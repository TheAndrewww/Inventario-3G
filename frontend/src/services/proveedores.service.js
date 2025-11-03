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
