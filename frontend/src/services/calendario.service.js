import api from './api';
import publicApi from './publicApi';

/**
 * Obtener calendario del mes actual (requiere autenticación)
 */
export const obtenerCalendarioActual = async () => {
  try {
    const response = await api.get('/calendario/actual');
    return response.data;
  } catch (error) {
    console.error('Error al obtener calendario actual:', error);
    throw error;
  }
};

/**
 * Obtener calendario de un mes específico (requiere autenticación)
 * @param {string} mes - Nombre del mes en mayúsculas (ej: "NOVIEMBRE")
 */
export const obtenerCalendarioMes = async (mes) => {
  try {
    const response = await api.get(`/calendario/mes/${mes}`);
    return response.data;
  } catch (error) {
    console.error(`Error al obtener calendario del mes ${mes}:`, error);
    throw error;
  }
};

/**
 * Obtener proyectos de un día específico (requiere autenticación)
 * @param {string} mes - Nombre del mes en mayúsculas
 * @param {number} dia - Número del día
 */
export const obtenerProyectosDia = async (mes, dia) => {
  try {
    const response = await api.get(`/calendario/mes/${mes}/dia/${dia}`);
    return response.data;
  } catch (error) {
    console.error(`Error al obtener proyectos del día ${dia}:`, error);
    throw error;
  }
};

/**
 * Obtener distribución de equipos del mes (requiere autenticación)
 * @param {string} mes - Nombre del mes en mayúsculas
 */
export const obtenerDistribucionEquipos = async (mes) => {
  try {
    const response = await api.get(`/calendario/mes/${mes}/equipos`);
    return response.data;
  } catch (error) {
    console.error('Error al obtener distribución de equipos:', error);
    throw error;
  }
};

// ============================================
// VERSIONES PÚBLICAS (sin autenticación)
// ============================================

/**
 * Obtener calendario del mes actual (público, sin autenticación)
 */
export const obtenerCalendarioActualPublico = async () => {
  try {
    const response = await publicApi.get('/calendario/publico/actual');
    return response.data;
  } catch (error) {
    console.error('Error al obtener calendario actual público:', error);
    throw error;
  }
};

/**
 * Obtener calendario de un mes específico (público, sin autenticación)
 * @param {string} mes - Nombre del mes en mayúsculas (ej: "NOVIEMBRE")
 */
export const obtenerCalendarioMesPublico = async (mes) => {
  try {
    const response = await publicApi.get(`/calendario/publico/mes/${mes}`);
    return response.data;
  } catch (error) {
    console.error(`Error al obtener calendario público del mes ${mes}:`, error);
    throw error;
  }
};

/**
 * Obtener distribución de equipos del mes (público, sin autenticación)
 * @param {string} mes - Nombre del mes en mayúsculas
 */
export const obtenerDistribucionEquiposPublico = async (mes) => {
  try {
    const response = await publicApi.get(`/calendario/publico/mes/${mes}/equipos`);
    return response.data;
  } catch (error) {
    console.error('Error al obtener distribución pública de equipos:', error);
    throw error;
  }
};

export default {
  // Funciones privadas (requieren autenticación)
  obtenerCalendarioActual,
  obtenerCalendarioMes,
  obtenerProyectosDia,
  obtenerDistribucionEquipos,

  // Funciones públicas (sin autenticación)
  obtenerCalendarioActualPublico,
  obtenerCalendarioMesPublico,
  obtenerDistribucionEquiposPublico,
};
