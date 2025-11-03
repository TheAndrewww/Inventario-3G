import api from './api';

const ubicacionesService = {
  // Obtener todas las ubicaciones
  async getAll() {
    try {
      const response = await api.get('/ubicaciones');
      return response.data.data?.ubicaciones || response.data.data || [];
    } catch (error) {
      throw error.response?.data || { message: 'Error al obtener ubicaciones' };
    }
  },

  // Crear nueva ubicación
  async create(ubicacionData) {
    try {
      const response = await api.post('/ubicaciones', ubicacionData);
      return response.data.data?.ubicacion || response.data.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al crear ubicación' };
    }
  }
};

export default ubicacionesService;
