import api from './api';

const almacenesService = {
    // Obtener todos los almacenes
    async getAll() {
        try {
            const response = await api.get('/almacenes');
            return response.data.data?.almacenes || response.data.data || [];
        } catch (error) {
            throw error.response?.data || { message: 'Error al obtener almacenes' };
        }
    },

    // Obtener un almacén por ID
    async getById(id) {
        try {
            const response = await api.get(`/almacenes/${id}`);
            return response.data.data?.almacen || response.data.data;
        } catch (error) {
            throw error.response?.data || { message: 'Error al obtener almacén' };
        }
    },

    // Crear nuevo almacén
    async create(almacenData) {
        try {
            const response = await api.post('/almacenes', almacenData);
            return response.data.data?.almacen || response.data.data;
        } catch (error) {
            throw error.response?.data || { message: 'Error al crear almacén' };
        }
    },

    // Actualizar almacén
    async update(id, almacenData) {
        try {
            const response = await api.put(`/almacenes/${id}`, almacenData);
            return response.data.data?.almacen || response.data.data;
        } catch (error) {
            throw error.response?.data || { message: 'Error al actualizar almacén' };
        }
    },

    // Eliminar almacén
    async delete(id, force = false) {
        try {
            const url = force ? `/almacenes/${id}?force=true` : `/almacenes/${id}`;
            const response = await api.delete(url);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Error al eliminar almacén' };
        }
    },

    // Obtener categorías de un almacén
    async getCategorias(almacenId) {
        try {
            const response = await api.get(`/almacenes/${almacenId}/categorias`);
            return response.data.data?.categorias || response.data.data || [];
        } catch (error) {
            throw error.response?.data || { message: 'Error al obtener categorías del almacén' };
        }
    },

    // Asignar categoría a un almacén
    async asignarCategoria(almacenId, categoriaId) {
        try {
            const response = await api.post(`/almacenes/${almacenId}/categorias`, {
                categoria_id: categoriaId
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Error al asignar categoría' };
        }
    },

    // Desasignar categoría de un almacén
    async desasignarCategoria(almacenId, categoriaId) {
        try {
            const response = await api.delete(`/almacenes/${almacenId}/categorias/${categoriaId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Error al desasignar categoría' };
        }
    }
};

export default almacenesService;
