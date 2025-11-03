import api from './api';

const notificacionesService = {
  // Obtener notificaciones del usuario
  obtenerNotificaciones: async (soloNoLeidas = false) => {
    const params = soloNoLeidas ? '?solo_no_leidas=true' : '';
    const response = await api.get(`/notificaciones${params}`);
    return response.data;
  },

  // Contar notificaciones no leídas
  contarNoLeidas: async () => {
    const response = await api.get('/notificaciones/count');
    return response.data;
  },

  // Marcar una notificación como leída
  marcarComoLeida: async (id) => {
    const response = await api.put(`/notificaciones/${id}/leer`);
    return response.data;
  },

  // Marcar todas las notificaciones como leídas
  marcarTodasComoLeidas: async () => {
    const response = await api.put('/notificaciones/leer-todas');
    return response.data;
  },

  // Eliminar una notificación
  eliminarNotificacion: async (id) => {
    const response = await api.delete(`/notificaciones/${id}`);
    return response.data;
  }
};

export default notificacionesService;
