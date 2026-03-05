import api from './api';

const BASE_URL = '/conteos-ciclicos';

const conteosCiclicosService = {
    // Obtener conteo del día (auto-crea si no existe)
    getHoy: async () => {
        const response = await api.get(`${BASE_URL}/hoy`);
        return response.data;
    },

    // Obtener artículos pendientes del día
    getPendientes: async (conteoId, search = '') => {
        const params = search ? `?search=${encodeURIComponent(search)}` : '';
        const response = await api.get(`${BASE_URL}/${conteoId}/pendientes${params}`);
        return response.data;
    },

    // Registrar conteo de un artículo
    registrarConteo: async (conteoId, data) => {
        const response = await api.post(`${BASE_URL}/${conteoId}/contar`, data);
        return response.data;
    },

    // Adelantar conteo: generar nuevo conteo extra
    adelantarConteo: async () => {
        const response = await api.post(`${BASE_URL}/adelantar`);
        return response.data;
    },

    // Obtener reportes (historial)
    getReportes: async (params = {}) => {
        const query = new URLSearchParams();
        if (params.desde) query.set('desde', params.desde);
        if (params.hasta) query.set('hasta', params.hasta);
        if (params.page) query.set('page', params.page);
        const queryStr = query.toString() ? `?${query.toString()}` : '';
        const response = await api.get(`${BASE_URL}/reportes${queryStr}`);
        return response.data;
    },

    // Obtener resumen de un día
    getResumen: async (conteoId) => {
        const response = await api.get(`${BASE_URL}/${conteoId}/resumen`);
        return response.data;
    },

    // Obtener IDs de artículos en el conteo activo de hoy
    getArticulosEnConteoActivo: async () => {
        const response = await api.get(`${BASE_URL}/articulos-activos`);
        return response.data;
    }
};

export default conteosCiclicosService;
