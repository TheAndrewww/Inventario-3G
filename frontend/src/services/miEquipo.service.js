/**
 * Servicio Mi Equipo - Dashboard personal
 */

import api from './api';

const miEquipoService = {
    /**
     * Obtener dashboard personal del usuario
     */
    obtenerMiEquipo: async () => {
        try {
            const response = await api.get('/mi-equipo');
            return response.data.data;
        } catch (error) {
            console.error('Error al obtener mi equipo:', error);
            throw error.response?.data || error;
        }
    },

    /**
     * Obtener historial de asignaciones del usuario
     */
    obtenerMiHistorial: async (limite = 20) => {
        try {
            const response = await api.get('/mi-equipo/historial', {
                params: { limite }
            });
            return response.data.data;
        } catch (error) {
            console.error('Error al obtener historial:', error);
            throw error.response?.data || error;
        }
    }
};

export default miEquipoService;
