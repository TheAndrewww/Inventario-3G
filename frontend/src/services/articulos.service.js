import api from './api';

const articulosService = {
  // Obtener todos los artículos
  async getAll() {
    try {
      const response = await api.get('/articulos');
      // El backend devuelve: { success, data: { articulos, total, ... } }
      return response.data.data?.articulos || response.data.data || [];
    } catch (error) {
      throw error.response?.data || { message: 'Error al obtener artículos' };
    }
  },

  // Obtener un artículo por ID
  async getById(id) {
    try {
      const response = await api.get(`/articulos/${id}`);
      return response.data.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al obtener artículo' };
    }
  },

  // Buscar artículo por código EAN-13
  async getByEAN13(codigoEAN13) {
    try {
      const response = await api.get(`/articulos/ean13/${codigoEAN13}`);
      // El backend devuelve: { success, data: { articulo: {...} } }
      return response.data.data?.articulo || response.data.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al buscar por código EAN-13' };
    }
  },

  // Crear artículo
  async create(data) {
    try {
      const response = await api.post('/articulos', data);
      return response.data.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al crear artículo' };
    }
  },

  // Actualizar artículo
  async update(id, data) {
    try {
      const response = await api.put(`/articulos/${id}`, data);
      return response.data.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al actualizar artículo' };
    }
  },

  // Eliminar artículo
  async delete(id) {
    try {
      const response = await api.delete(`/articulos/${id}`);
      return response.data.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al eliminar artículo' };
    }
  },

  // Buscar artículos
  async search(query) {
    try {
      const response = await api.get('/articulos/search', { params: { q: query } });
      return response.data.data?.articulos || response.data.data || [];
    } catch (error) {
      throw error.response?.data || { message: 'Error al buscar artículos' };
    }
  },

  // Subir imagen de artículo
  async uploadImagen(id, file) {
    try {
      const formData = new FormData();
      formData.append('imagen', file);

      const response = await api.post(`/articulos/${id}/imagen`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al subir imagen' };
    }
  },

  // Eliminar imagen de artículo
  async deleteImagen(id) {
    try {
      const response = await api.delete(`/articulos/${id}/imagen`);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al eliminar imagen' };
    }
  },

  // Buscar artículos con filtros
  async buscar(params = {}) {
    try {
      const response = await api.get('/articulos', { params });
      return response.data.data?.articulos || response.data.data || [];
    } catch (error) {
      throw error.response?.data || { message: 'Error al buscar artículos' };
    }
  }
};

export default articulosService;
