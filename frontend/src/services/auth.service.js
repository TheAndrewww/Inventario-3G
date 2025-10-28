import api from './api';

const authService = {
  /**
   * Iniciar sesión
   * @param {string} email
   * @param {string} password
   * @returns {Promise} Datos del usuario y token
   */
  login: async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });

      if (response.data.success) {
        const { token, usuario } = response.data.data;

        // Guardar en localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(usuario));

        return response.data.data;
      }

      throw new Error(response.data.message || 'Error al iniciar sesión');
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Cerrar sesión
   */
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  /**
   * Verificar si el token es válido
   * @returns {Promise} Datos del usuario
   */
  verify: async () => {
    try {
      const response = await api.get('/auth/verify');

      if (response.data.success) {
        return response.data.data.usuario;
      }

      throw new Error('Token inválido');
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Obtener usuario actual
   * @returns {Promise} Datos del usuario
   */
  getMe: async () => {
    try {
      const response = await api.get('/auth/me');

      if (response.data.success) {
        return response.data.data.usuario;
      }

      throw new Error('Error al obtener usuario');
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Cambiar contraseña
   * @param {string} passwordActual
   * @param {string} passwordNuevo
   * @returns {Promise}
   */
  cambiarPassword: async (passwordActual, passwordNuevo) => {
    try {
      const response = await api.put('/auth/cambiar-password', {
        passwordActual,
        passwordNuevo,
      });

      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Registrar nuevo usuario (solo admin)
   * @param {Object} userData
   * @returns {Promise}
   */
  register: async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Obtener token del localStorage
   * @returns {string|null}
   */
  getToken: () => {
    return localStorage.getItem('token');
  },

  /**
   * Obtener usuario del localStorage
   * @returns {Object|null}
   */
  getUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  /**
   * Verificar si el usuario está autenticado
   * @returns {boolean}
   */
  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },
};

export default authService;
