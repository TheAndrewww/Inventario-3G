import api from './api';

const categoriasService = {
  // Obtener todas las categorías
  async getAll() {
    try {
      const response = await api.get('/categorias');
      return response.data.data?.categorias || response.data.data || [];
    } catch (error) {
      throw error.response?.data || { message: 'Error al obtener categorías' };
    }
  }
};

export default categoriasService;
