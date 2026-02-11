import api from './api';

/**
 * Servicio para el módulo de Producción
 */

// Dashboard
export const obtenerDashboard = async () => {
    const response = await api.get('/produccion/dashboard');
    return response.data;
};

/**
 * Obtener datos del dashboard (versión pública para TV)
 */
export const obtenerDashboardPublico = async () => {
    const response = await api.get('/produccion/dashboard-publico');
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

export const regresarEtapa = async (proyectoId) => {
    const response = await api.post(`/produccion/${proyectoId}/regresar-etapa`);
    return response.data;
};

// Sub-etapas de Producción (Manufactura y Herrería)
export const completarSubEtapa = async (proyectoId, subEtapa) => {
    const response = await api.post(`/produccion/${proyectoId}/completar-subetapa`, { subEtapa });
    return response.data;
};

export const togglePausa = async (proyectoId, motivo = '') => {
    const response = await api.post(`/produccion/${proyectoId}/toggle-pausa`, { motivo });
    return response.data;
};

export const completarSubEtapaTerminal = async (proyectoId, subEtapa) => {
    const response = await api.post(`/produccion/terminal/${proyectoId}/completar-subetapa`, { subEtapa });
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

// ===== Google Drive =====

/**
 * Obtener archivos de Drive de un proyecto (para usuarios autenticados)
 */
export const obtenerArchivosDrive = async (proyectoId) => {
    const response = await api.get(`/produccion/${proyectoId}/archivos`);
    return response.data;
};

/**
 * Obtener archivos de Drive de un proyecto (para terminales públicas)
 */
export const obtenerArchivosDriveTerminal = async (proyectoId) => {
    const response = await api.get(`/produccion/terminal/${proyectoId}/archivos`);
    return response.data;
};

/**
 * Forzar sincronización con Drive de un proyecto
 */
export const sincronizarProyectoDrive = async (proyectoId) => {
    const response = await api.post(`/produccion/${proyectoId}/sincronizar-drive`);
    return response.data;
};

/**
 * Sincronizar todos los proyectos con Drive
 */
export const sincronizarTodosDrive = async () => {
    const response = await api.post('/produccion/sincronizar-drive');
    return response.data;
};

export default {
    obtenerDashboard,
    obtenerEstadisticas,
    obtenerProyectosArea,
    validarCodigoArea,
    completarEtapaTerminal,
    completarSubEtapa,
    completarSubEtapaTerminal,
    togglePausa,
    crearProyecto,
    actualizarProyecto,
    eliminarProyecto,
    completarEtapa,
    regresarEtapa,
    sincronizarConSheets,
    obtenerMesesDisponibles,
    previewProyectosSheets,
    // Google Drive
    obtenerArchivosDrive,
    obtenerArchivosDriveTerminal,
    sincronizarProyectoDrive,
    sincronizarTodosDrive,
    obtenerDashboardPublico
};
