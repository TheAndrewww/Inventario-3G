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
// A4 · PLA-04: las 4 llamadas de la terminal mandan el código validado del área en la cabecera X-Codigo-Area
// (misma petición de siempre más la cabecera; sin código no se agrega nada).
const conCodigo = (codigo) => (codigo ? { headers: { 'X-Codigo-Area': codigo } } : undefined);
// Si la pantalla se publica antes que el servidor, el servidor viejo no acepta la cabecera y el navegador corta la
// consulta sin respuesta: solo en las consultas (GET) se vuelve a pedir una vez sin la cabecera. Cerrar etapas nunca
// se repite solo.
const consultarTerminal = async (url, codigo) => {
    try {
        return await api.get(url, conCodigo(codigo));
    } catch (error) {
        if (codigo && !error.response) return api.get(url);
        throw error;
    }
};

export const obtenerProyectosArea = async (area, codigo) => {
    const response = await consultarTerminal(`/produccion/terminal/${area}`, codigo);
    return response.data;
};

export const validarCodigoArea = async (codigo) => {
    const response = await api.post('/produccion/validar-codigo', { codigo });
    return response.data;
};

export const completarEtapaTerminal = async (proyectoId, codigo) => {
    const response = await api.post(`/produccion/terminal/${proyectoId}/completar`, undefined, conCodigo(codigo));
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

export const completarSubEtapaTerminal = async (proyectoId, subEtapa, codigo) => {
    const response = await api.post(`/produccion/terminal/${proyectoId}/completar-subetapa`, { subEtapa }, conCodigo(codigo));
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
export const obtenerArchivosDriveTerminal = async (proyectoId, codigo) => {
    const response = await consultarTerminal(`/produccion/terminal/${proyectoId}/archivos`, codigo);
    return response.data;
};

/**
 * Contenido de la carpeta de PRODUCCION del proyecto (planos de manufactura y
 * herrería, tickets de almacén), sin el pedido, los importes ni los formatos
 * de cierre. Es lo que se ve al dar click a un proyecto en el dashboard.
 */
export const obtenerCarpetaProduccion = async (proyectoId) => {
    const response = await api.get(`/produccion/${proyectoId}/carpeta`);
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

export const toggleEtapa = async (proyectoId, etapa, completado) => {
    const response = await api.post(`/produccion/${proyectoId}/toggle-etapa`, { etapa, completado });
    return response.data;
};

export default {
    obtenerCarpetaProduccion,
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
    obtenerDashboardPublico,
    toggleEtapa
};
