import api from './api';

const camionetasService = {
  // Obtener todas las camionetas
  obtenerTodos: async () => {
    const response = await api.get('/camionetas');
    return response.data;
  },

  // Obtener camioneta por ID
  obtenerPorId: async (id) => {
    const response = await api.get(`/camionetas/${id}`);
    return response.data;
  },

  // Obtener camionetas por encargado
  obtenerPorEncargado: async (encargadoId) => {
    const response = await api.get(`/camionetas/encargado/${encargadoId}`);
    return response.data;
  },

  // Crear camioneta
  crear: async (camionetaData) => {
    const response = await api.post('/camionetas', camionetaData);
    return response.data;
  },

  // Actualizar camioneta
  actualizar: async (id, camionetaData) => {
    const response = await api.put(`/camionetas/${id}`, camionetaData);
    return response.data;
  },

  // Eliminar camioneta
  eliminar: async (id) => {
    const response = await api.delete(`/camionetas/${id}`);
    return response.data;
  },

  // ============================================
  // GESTIÓN DE STOCK MÍNIMO
  // ============================================

  // Obtener stock mínimo de una camioneta
  obtenerStockMinimo: async (camionetaId) => {
    const response = await api.get(`/camionetas/${camionetaId}/stock-minimo`);
    return response.data;
  },

  // Configurar stock mínimo de una camioneta
  configurarStockMinimo: async (camionetaId, stockData) => {
    const response = await api.post(`/camionetas/${camionetaId}/stock-minimo`, stockData);
    return response.data;
  },

  // Eliminar configuración de stock mínimo
  eliminarStockMinimo: async (camionetaId, stockId) => {
    const response = await api.delete(`/camionetas/${camionetaId}/stock-minimo/${stockId}`);
    return response.data;
  },

  // Obtener inventario actual de la camioneta
  obtenerInventario: async (camionetaId) => {
    const response = await api.get(`/camionetas/${camionetaId}/inventario`);
    return response.data;
  },

  // Obtener resumen de inventario (inventario actual vs stock mínimo)
  obtenerResumenInventario: async (camionetaId) => {
    const response = await api.get(`/camionetas/${camionetaId}/resumen-inventario`);
    return response.data;
  }
};

export default camionetasService;
