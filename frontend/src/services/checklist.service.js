import api from './api';

const checklistService = {
  // ─── Ítems de checklist (catálogo global) ───

  importarItems: async (items) => {
    const response = await api.post('/checklist/importar', { items });
    return response.data;
  },

  listarItems: async () => {
    const response = await api.get('/checklist/items');
    return response.data;
  },

  editarItem: async (id, data) => {
    const response = await api.put(`/checklist/items/${id}`, data);
    return response.data;
  },

  eliminarItem: async (id) => {
    const response = await api.delete(`/checklist/items/${id}`);
    return response.data;
  },

  // ─── Enlazar artículos ───

  enlazarArticulos: async (itemId, articuloIds) => {
    const response = await api.post(`/checklist/items/${itemId}/articulos`, { articulo_ids: articuloIds });
    return response.data;
  },

  sugerirArticulos: async (itemId) => {
    const response = await api.get(`/checklist/items/${itemId}/sugerencias`);
    return response.data;
  },

  buscarArticulos: async (query) => {
    const response = await api.get(`/checklist/buscar-articulos?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  // ─── Checklist por equipo ───

  obtenerChecklistEquipo: async (equipoId) => {
    const response = await api.get(`/checklist/equipo/${equipoId}`);
    return response.data;
  },

  asignarItemsAEquipo: async (equipoId, items) => {
    const response = await api.post(`/checklist/equipo/${equipoId}/asignar`, { items });
    return response.data;
  },

  quitarItemDeEquipo: async (equipoId, itemId) => {
    const response = await api.delete(`/checklist/equipo/${equipoId}/items/${itemId}`);
    return response.data;
  }
};

export default checklistService;
