import axios from './axios';

/**
 * Servicio para el módulo de Producción
 */

// Dashboard
export const obtenerDashboard = async () => {
    const response = await axios.get('/produccion/dashboard');
    return response.data;
};

export const obtenerEstadisticas = async () => {
    const response = await axios.get('/produccion/estadisticas');
    return response.data;
};

// Áreas / Terminales
export const obtenerProyectosArea = async (area) => {
    const response = await axios.get(`/produccion/terminal/${area}`);
    return response.data;
};

export const validarCodigoArea = async (codigo) => {
    const response = await axios.post('/produccion/validar-codigo', { codigo });
    return response.data;
};

export const completarEtapaTerminal = async (proyectoId) => {
    const response = await axios.post(`/produccion/terminal/${proyectoId}/completar`);
    return response.data;
};

// CRUD Proyectos
export const crearProyecto = async (datos) => {
    const response = await axios.post('/produccion', datos);
    return response.data;
};

export const actualizarProyecto = async (id, datos) => {
    const response = await axios.put(`/produccion/${id}`, datos);
    return response.data;
};

export const eliminarProyecto = async (id) => {
    const response = await axios.delete(`/produccion/${id}`);
    return response.data;
};

export const completarEtapa = async (proyectoId, observaciones = '') => {
    const response = await axios.post(`/produccion/${proyectoId}/completar-etapa`, { observaciones });
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
    completarEtapa
};
