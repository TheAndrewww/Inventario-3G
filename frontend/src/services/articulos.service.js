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

  // Eliminar artículo (soft delete - desactivar)
  async delete(id) {
    try {
      const response = await api.delete(`/articulos/${id}`);
      return response.data.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al eliminar artículo' };
    }
  },

  // Eliminar artículo permanentemente (hard delete)
  async deletePermanente(id) {
    try {
      const response = await api.delete(`/articulos/${id}/permanente`);
      return response.data.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al eliminar artículo permanentemente' };
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

      // Enviar flag de si es foto de cámara (para procesamiento con Nano Banana)
      formData.append('isFromCamera', file.isFromCamera || false);

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

  // Reprocesar imagen existente con Nano Banana (IA)
  async reprocessImagen(id) {
    try {
      const response = await api.post(`/articulos/${id}/imagen/reprocess`);
      return response.data.data;
    } catch (error) {
      throw error.response?.data || { message: 'Error al reprocesar imagen' };
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
  },

  // Generar PDF con múltiples etiquetas
  async generarEtiquetasLote(articulosIds) {
    try {
      const response = await api.post('/articulos/etiquetas/lote',
        { articulos_ids: articulosIds },
        {
          responseType: 'blob',
          headers: {
            'Accept': 'application/pdf'
          }
        }
      );

      console.log('Tipo de respuesta:', typeof response.data);
      console.log('Es Blob?', response.data instanceof Blob);
      console.log('Response data:', response.data);
      console.log('Content-Type:', response.headers['content-type']);

      // Verificar si es un Blob
      if (!(response.data instanceof Blob)) {
        console.error('response.data no es un Blob:', response.data);
        throw new Error('La respuesta no es un archivo PDF válido');
      }

      // Verificar si el blob contiene JSON de error (cuando el servidor devuelve error)
      if (response.data.type === 'application/json') {
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.message || 'Error al generar etiquetas');
      }

      // Crear link de descarga
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `etiquetas-${articulosIds.length}-articulos.pdf`);
      document.body.appendChild(link);
      link.click();

      // Limpiar
      setTimeout(() => {
        link.remove();
        window.URL.revokeObjectURL(url);
      }, 100);

      return { success: true };
    } catch (error) {
      console.error('Error al generar etiquetas:', error);

      // Si el error tiene un blob con JSON, intentar leerlo
      if (error.response?.data instanceof Blob && error.response.data.type === 'application/json') {
        try {
          const text = await error.response.data.text();
          const errorData = JSON.parse(text);
          throw { message: errorData.message || 'Error al generar etiquetas' };
        } catch (parseError) {
          throw { message: 'Error al generar etiquetas' };
        }
      }

      throw { message: error.message || 'Error al generar etiquetas' };
    }
  }
};

export default articulosService;
