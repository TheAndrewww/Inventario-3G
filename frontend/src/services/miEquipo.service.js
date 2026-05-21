/**
 * Servicio Mi Equipo - Dashboard personal
 */

import api from './api';

const miEquipoService = {
    /**
     * Obtener dashboard personal del usuario.
     * Si se pasa usuarioId, el admin puede ver el equipo de ese usuario.
     */
    obtenerMiEquipo: async (usuarioId = null) => {
        try {
            const params = usuarioId ? { usuario_id: usuarioId } : {};
            const response = await api.get('/mi-equipo', { params });
            return response.data.data;
        } catch (error) {
            console.error('Error al obtener mi equipo:', error);
            throw error.response?.data || error;
        }
    },

    /**
     * Lista usuarios con equipo asignado (solo admin).
     */
    listarUsuariosConEquipo: async () => {
        try {
            const response = await api.get('/mi-equipo/usuarios-con-equipo');
            return response.data.data.usuarios || [];
        } catch (error) {
            console.error('Error al listar usuarios con equipo:', error);
            return [];
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
