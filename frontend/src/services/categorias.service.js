import api from './api';

const categoriasService = {
  // Obtener todas las categorías (opcionalmente filtradas por almacén)
  async getAll(almacenId = null) {
    try {
      const params = almacenId ? `?almacen_id=${almacenId}` : '';
      const response = await api.get(`/categorias${params}`);
      return response.data.data?.categorias || response.data.data || [];
    } catch (error) {
      throw error.response?.data || { message: 'Error al obtener categorías' };
    }
  },

  // Crear nueva categoría
  async create(categoriaData) {
    try {
      const response = await api.post('/categorias', categoriaData);
      return response.data.data?.categoria || response.data.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al crear categoría' };
    }
  },

  // Actualizar categoría
  async update(id, categoriaData) {
    try {
      const response = await api.put(`/categorias/${id}`, categoriaData);
      return response.data.data?.categoria || response.data.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al actualizar categoría' };
    }
  },

  // Eliminar categoría
  async delete(id, force = false) {
    try {
      const url = force ? `/categorias/${id}?force=true` : `/categorias/${id}`;
      const response = await api.delete(url);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al eliminar categoría' };
    }
  }
};

export default categoriasService;
