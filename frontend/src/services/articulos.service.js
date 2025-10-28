import api from './api';

const articulosService = {
  /**
   * Obtener todos los artículos con filtros opcionales
   * @param {Object} params - Parámetros de búsqueda
   * @returns {Promise}
   */
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/articulos', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Obtener un artículo por ID
   * @param {number} id
   * @returns {Promise}
   */
  getById: async (id) => {
    try {
      const response = await api.get(`/articulos/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Buscar artículo por código QR
   * @param {string} codigoQR
   * @returns {Promise}
   */
  getByQR: async (codigoQR) => {
    try {
      const response = await api.get(`/articulos/qr/${encodeURIComponent(codigoQR)}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Crear nuevo artículo (genera QR automáticamente)
   * @param {Object} articuloData
   * @returns {Promise}
   */
  create: async (articuloData) => {
    try {
      const response = await api.post('/articulos', articuloData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Actualizar artículo existente
   * @param {number} id
   * @param {Object} articuloData
   * @returns {Promise}
   */
  update: async (id, articuloData) => {
    try {
      const response = await api.put(`/articulos/${id}`, articuloData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Eliminar (desactivar) artículo
   * @param {number} id
   * @returns {Promise}
   */
  delete: async (id) => {
    try {
      const response = await api.delete(`/articulos/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Regenerar código QR de un artículo
   * @param {number} id
   * @returns {Promise}
   */
  regenerarQR: async (id) => {
    try {
      const response = await api.post(`/articulos/${id}/regenerar-qr`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Buscar artículos con filtros
   * @param {Object} filtros
   * @returns {Promise}
   */
  search: async (filtros) => {
    try {
      const params = {};

      if (filtros.search) params.search = filtros.search;
      if (filtros.categoria_id) params.categoria_id = filtros.categoria_id;
      if (filtros.ubicacion_id) params.ubicacion_id = filtros.ubicacion_id;
      if (filtros.stock_bajo) params.stock_bajo = filtros.stock_bajo;
      if (filtros.activo !== undefined) params.activo = filtros.activo;
      if (filtros.page) params.page = filtros.page;
      if (filtros.limit) params.limit = filtros.limit;

      const response = await api.get('/articulos', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
};

export default articulosService;
