import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const anunciosAPI = axios.create({
  baseURL: `${API_URL}/anuncios`,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Obtener anuncios activos (últimos 7 días)
 * Endpoint público - no requiere autenticación
 */
export const obtenerAnunciosActivos = async (dias = 7) => {
  try {
    const response = await anunciosAPI.get('/publico/activos', {
      params: { dias }
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener anuncios activos:', error);
    throw error;
  }
};

/**
 * Obtener anuncios del día actual
 * Endpoint público - no requiere autenticación
 */
export const obtenerAnunciosHoy = async () => {
  try {
    const response = await anunciosAPI.get('/publico/hoy');
    return response.data;
  } catch (error) {
    console.error('Error al obtener anuncios de hoy:', error);
    throw error;
  }
};

/**
 * Incrementar contador de vistas de un anuncio
 */
export const incrementarVistaAnuncio = async (id) => {
  try {
    const response = await anunciosAPI.post(`/publico/${id}/vista`);
    return response.data;
  } catch (error) {
    console.error('Error al incrementar vista:', error);
    throw error;
  }
};

/**
 * Generar anuncio manualmente (requiere autenticación)
 */
export const generarAnuncioManual = async (data, token) => {
  try {
    const response = await anunciosAPI.post('/generar', data, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error al generar anuncio:', error);
    throw error;
  }
};

/**
 * Generar anuncios desde calendario (requiere autenticación)
 */
export const generarAnunciosDesdeCalendario = async (token) => {
  try {
    const response = await anunciosAPI.post('/generar-desde-calendario', {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error al generar anuncios desde calendario:', error);
    throw error;
  }
};

/**
 * Obtener estadísticas de anuncios (requiere autenticación)
 */
export const obtenerEstadisticas = async (token) => {
  try {
    const response = await anunciosAPI.get('/stats', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    throw error;
  }
};

/**
 * Desactivar anuncio (requiere autenticación)
 */
export const desactivarAnuncio = async (id, token) => {
  try {
    const response = await anunciosAPI.put(`/${id}/desactivar`, {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error al desactivar anuncio:', error);
    throw error;
  }
};

/**
 * Regenerar anuncio individual (requiere autenticación)
 * Genera una nueva imagen para el anuncio usando la misma frase
 */
export const regenerarAnuncio = async (id, token) => {
  try {
    const response = await anunciosAPI.post(`/${id}/regenerar`, {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error al regenerar anuncio:', error);
    throw error;
  }
};

export default {
  obtenerAnunciosActivos,
  obtenerAnunciosHoy,
  incrementarVistaAnuncio,
  generarAnuncioManual,
  generarAnunciosDesdeCalendario,
  obtenerEstadisticas,
  desactivarAnuncio,
  regenerarAnuncio
};

