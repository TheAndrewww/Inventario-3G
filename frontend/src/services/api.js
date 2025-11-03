import axios from 'axios';

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
    // Asegurar que la respuesta se interprete correctamente como UTF-8
    if (response.data && typeof response.data === 'object') {
      response.data = JSON.parse(JSON.stringify(response.data));
    }
    return response;
  },
  (error) => {
    // Solo registrar el error, no redirigir automáticamente
    // React Router y el AuthContext manejarán la navegación
    if (error.response?.status === 401) {
      console.log('Error 401: Token inválido o expirado');
    }
    return Promise.reject(error);
  }
);

export default api;
