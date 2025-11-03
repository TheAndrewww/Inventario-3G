import api from './api';

const authService = {
  // Login
  async login(email, password) {
    try {
      const response = await api.post('/auth/login', { email, password });

      // El backend devuelve: { success, data: { usuario, token } }
      const { data } = response.data;

      if (data && data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.usuario));

        return {
          token: data.token,
          usuario: data.usuario
        };
      }

      throw new Error('No se recibió token del servidor');
    } catch (error) {
      throw error.response?.data || { message: 'Error al iniciar sesión' };
    }
  },

  // Logout
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  // Verificar token
  async verifyToken() {
    try {
      const response = await api.get('/auth/verify');
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Token inválido' };
    }
  },

  // Obtener usuario actual
  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (error) {
        return null;
      }
    }
    return null;
  },

  // Verificar si está autenticado
  isAuthenticated() {
    return !!localStorage.getItem('token');
  },
};

export default authService;
