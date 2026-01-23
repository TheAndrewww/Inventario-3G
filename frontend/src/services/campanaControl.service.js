import api from './api';

const BASE_URL = '/campana-control';

export const campanaControlService = {
    // Obtener todos los datos
    getAllData: async (year = 2026) => {
        const response = await api.get(`${BASE_URL}?year=${year}`);
        return response.data;
    },

    // Obtener totales
    getTotals: async (year = 2026) => {
        const response = await api.get(`${BASE_URL}/totals?year=${year}`);
        return response.data;
    },

    // Actualizar una celda
    updateCell: async (quarter, area, week, data, year = 2026) => {
        const response = await api.put(`${BASE_URL}/${quarter}/${area}/${week}`, {
            ...data,
            year
        });
        return response.data;
    },

    // Eliminar una celda
    deleteCell: async (quarter, area, week, year = 2026) => {
        const response = await api.delete(`${BASE_URL}/${quarter}/${area}/${week}?year=${year}`);
        return response.data;
    }
};

export default campanaControlService;
