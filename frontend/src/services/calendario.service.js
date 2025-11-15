import api from './api';

/**
 * Obtener calendario del mes actual
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
 * Obtener calendario de un mes específico
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
 * Obtener proyectos de un día específico
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
 * Obtener distribución de equipos del mes
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

export default {
  obtenerCalendarioActual,
  obtenerCalendarioMes,
  obtenerProyectosDia,
  obtenerDistribucionEquipos
};
