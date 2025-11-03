import api from './api';

const movimientosService = {
  // Crear movimiento genérico
  async create(data) {
    try {
      const response = await api.post('/movimientos', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al crear movimiento' };
    }
  },

  // Crear retiro (pedido)
  async crearRetiro(data) {
    try {
      const response = await api.post('/movimientos', {
        tipo: 'retiro',
        ...data
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al crear retiro' };
    }
  },

  // Obtener historial de movimientos
  async getHistorial(params = {}) {
    try {
      const response = await api.get('/movimientos', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al obtener historial' };
    }
  },

  // Obtener detalle de un movimiento
  async getById(id) {
    try {
      const response = await api.get(`/movimientos/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al obtener movimiento' };
    }
  },

  // Actualizar estado de un movimiento
  async updateEstado(id, estado) {
    try {
      const response = await api.put(`/movimientos/${id}`, { estado });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al actualizar estado' };
    }
  },
};

export default movimientosService;
