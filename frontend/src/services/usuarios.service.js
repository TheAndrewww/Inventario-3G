import api from './api';

const usuariosService = {
  // Obtener todos los usuarios
  obtenerTodos: async () => {
    const response = await api.get('/usuarios');
    return response.data;
  },

  // Obtener usuario por ID
  obtenerPorId: async (id) => {
    const response = await api.get(`/usuarios/${id}`);
    return response.data;
  },

  // Obtener solo encargados
  obtenerEncargados: async () => {
    const response = await api.get('/usuarios/encargados');
    return response.data;
  },

  // Mantener compatibilidad (deprecado)
  obtenerSupervisores: async () => {
    const response = await api.get('/usuarios/encargados');
    return response.data;
  },

  // Crear usuario
  crear: async (usuarioData) => {
    const response = await api.post('/usuarios', usuarioData);
    return response.data;
  },

  // Actualizar usuario
  actualizar: async (id, usuarioData) => {
    const response = await api.put(`/usuarios/${id}`, usuarioData);
    return response.data;
  },

  // Eliminar usuario (soft delete)
  eliminar: async (id) => {
    const response = await api.delete(`/usuarios/${id}`);
    return response.data;
  },

  // Reactivar usuario desactivado
  reactivar: async (id) => {
    const response = await api.post(`/usuarios/${id}/reactivar`);
    return response.data;
  },

  // Eliminar usuario permanentemente (hard delete)
  eliminarPermanente: async (id) => {
    const response = await api.delete(`/usuarios/${id}/permanente`);
    return response.data;
  }
};

export default usuariosService;
