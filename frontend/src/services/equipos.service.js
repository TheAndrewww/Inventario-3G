import api from './api';

const equiposService = {
  // Obtener todos los equipos
  obtenerTodos: async () => {
    const response = await api.get('/equipos');
    return response.data;
  },

  // Obtener equipo por ID
  obtenerPorId: async (id) => {
    const response = await api.get(`/equipos/${id}`);
    return response.data;
  },

  // Obtener equipos por encargado
  obtenerPorSupervisor: async (encargadoId) => {
    const response = await api.get(`/equipos/encargado/${encargadoId}`);
    return response.data;
  },

  // Crear equipo
  crear: async (equipoData) => {
    const response = await api.post('/equipos', equipoData);
    return response.data;
  },

  // Actualizar equipo
  actualizar: async (id, equipoData) => {
    const response = await api.put(`/equipos/${id}`, equipoData);
    return response.data;
  },

  // Eliminar equipo
  eliminar: async (id) => {
    const response = await api.delete(`/equipos/${id}`);
    return response.data;
  }
};

export default equiposService;
