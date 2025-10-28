import api from './api';

const movimientosService = {
  /**
   * Obtener historial de movimientos con filtros
   * @param {Object} params - Parámetros de búsqueda
   * @returns {Promise}
   */
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/movimientos', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Obtener un movimiento por ID
   * @param {number} id
   * @returns {Promise}
   */
  getById: async (id) => {
    try {
      const response = await api.get(`/movimientos/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Crear un nuevo movimiento (retiro/devolución/ajuste)
   * @param {Object} movimientoData
   * @returns {Promise}
   */
  create: async (movimientoData) => {
    try {
      const response = await api.post('/movimientos', movimientoData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Actualizar estado de un movimiento (aprobar/rechazar)
   * @param {number} id
   * @param {Object} data
   * @returns {Promise}
   */
  update: async (id, data) => {
    try {
      const response = await api.put(`/movimientos/${id}`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Crear un retiro (tipo específico de movimiento)
   * @param {Array} articulos - Array de {articulo_id, cantidad, observaciones}
   * @param {Object} options - Opciones adicionales
   * @returns {Promise}
   */
  crearRetiro: async (articulos, options = {}) => {
    try {
      const movimientoData = {
        tipo: 'retiro',
        articulos,
        observaciones: options.observaciones || '',
        proyecto: options.proyecto || null,
        supervisor_id: options.supervisor_id || null,
      };

      const response = await api.post('/movimientos', movimientoData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Crear una devolución
   * @param {Array} articulos
   * @param {Object} options
   * @returns {Promise}
   */
  crearDevolucion: async (articulos, options = {}) => {
    try {
      const movimientoData = {
        tipo: 'devolucion',
        articulos,
        observaciones: options.observaciones || '',
        proyecto: options.proyecto || null,
      };

      const response = await api.post('/movimientos', movimientoData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Obtener movimientos de un usuario específico
   * @param {number} usuario_id
   * @param {number} limit
   * @returns {Promise}
   */
  getByUsuario: async (usuario_id, limit = 20) => {
    try {
      const response = await api.get(`/movimientos/usuario/${usuario_id}`, {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Buscar movimientos con filtros
   * @param {Object} filtros
   * @returns {Promise}
   */
  search: async (filtros) => {
    try {
      const params = {};

      if (filtros.tipo) params.tipo = filtros.tipo;
      if (filtros.usuario_id) params.usuario_id = filtros.usuario_id;
      if (filtros.fecha_desde) params.fecha_desde = filtros.fecha_desde;
      if (filtros.fecha_hasta) params.fecha_hasta = filtros.fecha_hasta;
      if (filtros.estado) params.estado = filtros.estado;
      if (filtros.page) params.page = filtros.page;
      if (filtros.limit) params.limit = filtros.limit;

      const response = await api.get('/movimientos', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
};

export default movimientosService;
