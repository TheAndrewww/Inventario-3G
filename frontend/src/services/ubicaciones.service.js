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
  },

  // Actualizar ubicación
  async update(id, ubicacionData) {
    try {
      const response = await api.put(`/ubicaciones/${id}`, ubicacionData);
      return response.data.data?.ubicacion || response.data.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al actualizar ubicación' };
    }
  },

  // Eliminar ubicación
  async delete(id, force = false) {
    try {
      const url = force ? `/ubicaciones/${id}?force=true` : `/ubicaciones/${id}`;
      const response = await api.delete(url);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al eliminar ubicación' };
    }
  }
};

export default ubicacionesService;
