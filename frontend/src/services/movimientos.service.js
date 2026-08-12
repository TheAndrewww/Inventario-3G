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

  // Entrada/salida rápida hacia camioneta o área (sin ticket ni aprobación)
  async registrarRapido(data) {
    try {
      const response = await api.post('/movimientos/rapido', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al registrar el movimiento' };
    }
  },

  // Corte por destino de los movimientos rápidos
  async getConsolidado(params = {}) {
    try {
      const response = await api.get('/movimientos/consolidado', { params });
      return response.data.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al obtener el consolidado' };
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
