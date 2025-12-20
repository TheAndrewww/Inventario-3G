import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Crear instancia de axios para endpoints públicos (sin autenticación)
const publicApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json; charset=utf-8',
  },
  responseType: 'json',
  responseEncoding: 'utf8',
});

// Interceptor para manejar respuestas y decodificación UTF-8
publicApi.interceptors.response.use(
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
    // Para endpoints públicos, solo rechazamos el error sin redirigir
    console.error('Error en petición pública:', error);
    return Promise.reject(error);
  }
);

export default publicApi;
