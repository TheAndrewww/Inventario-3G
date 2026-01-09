import api from './api';

/**
 * Servicio para el módulo de Producción
 */

// Dashboard
export const obtenerDashboard = async () => {
    const response = await api.get('/produccion/dashboard');
    return response.data;
};

export const obtenerEstadisticas = async () => {
    const response = await api.get('/produccion/estadisticas');
    return response.data;
};

// Áreas / Terminales
export const obtenerProyectosArea = async (area) => {
    const response = await api.get(`/produccion/terminal/${area}`);
    return response.data;
};

export const validarCodigoArea = async (codigo) => {
    const response = await api.post('/produccion/validar-codigo', { codigo });
    return response.data;
};

export const completarEtapaTerminal = async (proyectoId) => {
    const response = await api.post(`/produccion/terminal/${proyectoId}/completar`);
    return response.data;
};

// CRUD Proyectos
export const crearProyecto = async (datos) => {
    const response = await api.post('/produccion', datos);
    return response.data;
};

export const actualizarProyecto = async (id, datos) => {
    const response = await api.put(`/produccion/${id}`, datos);
    return response.data;
};

export const eliminarProyecto = async (id) => {
    const response = await api.delete(`/produccion/${id}`);
    return response.data;
};

export const completarEtapa = async (proyectoId, observaciones = '') => {
    const response = await api.post(`/produccion/${proyectoId}/completar-etapa`, { observaciones });
    return response.data;
};

// Sincronización con Google Sheets
export const sincronizarConSheets = async (mes = null) => {
    const response = await api.post('/produccion/sincronizar', { mes });
    return response.data;
};

export const obtenerMesesDisponibles = async () => {
    const response = await api.get('/produccion/meses-disponibles');
    return response.data;
};

export const previewProyectosSheets = async (mes) => {
    const response = await api.get(`/produccion/preview-sheets/${mes}`);
    return response.data;
};

export default {
    obtenerDashboard,
    obtenerEstadisticas,
    obtenerProyectosArea,
    validarCodigoArea,
    completarEtapaTerminal,
    crearProyecto,
    actualizarProyecto,
    eliminarProyecto,
    completarEtapa,
    sincronizarConSheets,
    obtenerMesesDisponibles,
    previewProyectosSheets
};
