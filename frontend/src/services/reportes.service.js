import api from './api';

const reportesService = {
    /**
     * Reporte de inventario consumibles con sugerencias de ajuste.
     * @param {number} dias - Días del periodo de análisis (default 90)
     */
    inventarioConsumibles: async (dias = 90) => {
        const res = await api.get('/reportes/inventario-consumibles', { params: { dias } });
        return res.data.data;
    },

    /**
     * Aplica ajustes de stock_minimo / stock_maximo a múltiples artículos.
     * @param {Array<{id: number, stock_minimo?: number, stock_maximo?: number}>} ajustes
     */
    aplicarSugerencias: async (ajustes) => {
        const res = await api.post('/reportes/aplicar-sugerencias', { ajustes });
        return res.data;
    },

    /**
     * Artículos bajo mínimo de TODOS los almacenes (solo administrador).
     */
    stockBajo: async () => {
        const res = await api.get('/reportes/stock-bajo');
        return res.data.data;
    }
};

export default reportesService;
