import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Crear instancia de axios
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json; charset=utf-8',
  },
  responseType: 'json',
  responseEncoding: 'utf8',
});

// Interceptor para agregar el token a cada petición
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de respuesta y decodificación UTF-8
api.interceptors.response.use(
  (response) => {
    // No tocar las respuestas de tipo blob (para descargas de archivos)
    if (response.data instanceof Blob) {
      return response;
    }

    // Asegurar que la respuesta se interprete correctamente como UTF-8
    if (response.data && typeof response.data === 'object') {
      response.data = JSON.parse(JSON.stringify(response.data));
    }
    return response;
  },
  (error) => {
    // Manejar errores de autenticación (token expirado o inválido)
    if (error.response?.status === 401) {
      console.log('Error 401: Token inválido o expirado - Cerrando sesión');

      // Limpiar el localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Emitir evento personalizado para que AuthContext actualice su estado
      window.dispatchEvent(new Event('auth:logout'));

      // Mostrar notificación al usuario
      toast.error('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.', {
        duration: 4000,
      });

      // Redirigir al login si no estamos ya ahí
      if (!window.location.pathname.includes('/login')) {
        // Usar setTimeout para que el toast se muestre antes de redirigir
        setTimeout(() => {
          window.location.href = '/login';
        }, 500);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
