import api from './api';

const seccionesService = {
  async getAll(almacenId = null) {
    try {
      const params = almacenId ? `?almacen_id=${almacenId}` : '';
      const response = await api.get(`/secciones${params}`);
      return response.data.data?.secciones || response.data.data || [];
    } catch (error) {
      throw error.response?.data || { message: 'Error al obtener secciones' };
    }
  },

  async create(seccionData) {
    try {
      const response = await api.post('/secciones', seccionData);
      return response.data.data?.seccion || response.data.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al crear sección' };
    }
  },

  async update(id, seccionData) {
    try {
      const response = await api.put(`/secciones/${id}`, seccionData);
      return response.data.data?.seccion || response.data.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al actualizar sección' };
    }
  },

  async delete(id, force = false) {
    try {
      const url = force ? `/secciones/${id}?force=true` : `/secciones/${id}`;
      const response = await api.delete(url);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al eliminar sección' };
    }
  }
};

export default seccionesService;
