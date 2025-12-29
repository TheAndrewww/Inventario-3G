import api from './api';

const herramientasRentaService = {
    // ========== TIPOS DE HERRAMIENTA ==========

    /**
     * Obtener todos los tipos de herramienta
     */
    obtenerTipos: async (params = {}) => {
        try {
            const response = await api.get('/herramientas-renta/tipos', { params });
            return response.data.data;
        } catch (error) {
            console.error('Error al obtener tipos de herramienta:', error);
            throw error.response?.data || error;
        }
    },

    /**
     * Obtener un tipo por ID con sus unidades
     */
    obtenerTipoPorId: async (id) => {
        try {
            const response = await api.get(`/herramientas-renta/tipos/${id}`);
            return response.data.data;
        } catch (error) {
            console.error(`Error al obtener tipo ${id}:`, error);
            throw error.response?.data || error;
        }
    },

    /**
     * Crear un nuevo tipo de herramienta con N unidades
     */
    crearTipo: async (data) => {
        try {
            const response = await api.post('/herramientas-renta/tipos', data);
            return response.data.data;
        } catch (error) {
            console.error('Error al crear tipo de herramienta:', error);
            throw error.response?.data || error;
        }
    },

    // ========== UNIDADES ==========

    /**
     * Obtener todas las unidades de un tipo específico
     */
    obtenerUnidadesPorTipo: async (tipoId) => {
        try {
            const response = await api.get(`/herramientas-renta/unidades/${tipoId}`);
            return response.data.data;
        } catch (error) {
            console.error(`Error al obtener unidades del tipo ${tipoId}:`, error);
            throw error.response?.data || error;
        }
    },

    /**
     * Obtener todas las unidades de un artículo específico (para inventario)
     */
    obtenerUnidadesPorArticulo: async (articuloId) => {
        try {
            const response = await api.get(`/herramientas-renta/unidades-por-articulo/${articuloId}`);
            return response.data.data;
        } catch (error) {
            console.error(`Error al obtener unidades del artículo ${articuloId}:`, error);
            throw error.response?.data || error;
        }
    },

    /**
     * Obtener historial de asignaciones de una unidad
     */
    obtenerHistorialUnidad: async (unidadId) => {
        try {
            const response = await api.get(`/herramientas-renta/historial/${unidadId}`);
            return response.data.data;
        } catch (error) {
            console.error(`Error al obtener historial de unidad ${unidadId}:`, error);
            throw error.response?.data || error;
        }
    },

    // ========== ASIGNACIÓN Y DEVOLUCIÓN ==========

    /**
     * Asignar una herramienta a un usuario o equipo
     */
    asignarHerramienta: async (data) => {
        try {
            const response = await api.post('/herramientas-renta/asignar', data);
            return response.data.data;
        } catch (error) {
            console.error('Error al asignar herramienta:', error);
            throw error.response?.data || error;
        }
    },

    /**
     * Devolver una herramienta (marcarla como disponible)
     */
    devolverHerramienta: async (unidadId, observaciones = '') => {
        try {
            const response = await api.post(`/herramientas-renta/devolver/${unidadId}`, {
                observaciones
            });
            return response.data.data;
        } catch (error) {
            console.error(`Error al devolver herramienta ${unidadId}:`, error);
            throw error.response?.data || error;
        }
    },

    /**
     * Cambiar el estado de una unidad de herramienta
     */
    cambiarEstadoUnidad: async (unidadId, estado, motivo = '') => {
        try {
            const response = await api.put(`/herramientas-renta/unidades/${unidadId}/cambiar-estado`, {
                estado,
                motivo
            });
            return response.data.data;
        } catch (error) {
            console.error(`Error al cambiar estado de unidad ${unidadId}:`, error);
            throw error.response?.data || error;
        }
    },

    // ========== CONSULTAS ==========

    /**
     * Obtener todas las herramientas asignadas a un usuario
     */
    obtenerHerramientasPorUsuario: async (usuarioId) => {
        try {
            const response = await api.get(`/herramientas-renta/por-usuario/${usuarioId}`);
            return response.data.data;
        } catch (error) {
            console.error(`Error al obtener herramientas del usuario ${usuarioId}:`, error);
            throw error.response?.data || error;
        }
    },

    /**
     * Obtener todas las herramientas asignadas a un equipo
     */
    obtenerHerramientasPorEquipo: async (equipoId) => {
        try {
            const response = await api.get(`/herramientas-renta/por-equipo/${equipoId}`);
            return response.data.data;
        } catch (error) {
            console.error(`Error al obtener herramientas del equipo ${equipoId}:`, error);
            throw error.response?.data || error;
        }
    },

    // ========== CÓDIGOS DE BARRAS ==========

    /**
     * Generar código EAN-13 para una unidad específica
     */
    generarCodigoEAN13: async (unidadId) => {
        try {
            const response = await api.post(`/herramientas-renta/unidades/${unidadId}/generar-ean13`);
            return response.data;
        } catch (error) {
            console.error(`Error al generar código EAN-13 para unidad ${unidadId}:`, error);
            throw error.response?.data || error;
        }
    },

    /**
     * Generar códigos EAN-13 masivamente para un tipo
     */
    generarCodigosMasivos: async (tipoId) => {
        try {
            const response = await api.post(`/herramientas-renta/tipos/${tipoId}/generar-codigos-masivo`);
            return response.data;
        } catch (error) {
            console.error(`Error al generar códigos masivos para tipo ${tipoId}:`, error);
            throw error.response?.data || error;
        }
    },

    /**
     * Obtener URL de la imagen del código de barras
     */
    getURLCodigoBarras: (unidadId) => {
        return `${api.defaults.baseURL}/herramientas-renta/unidades/${unidadId}/barcode`;
    },

    /**
     * Obtener URL de la imagen SVG del código de barras
     */
    getURLCodigoBarrasSVG: (unidadId) => {
        return `${api.defaults.baseURL}/herramientas-renta/unidades/${unidadId}/barcode-svg`;
    },

    // ========== MIGRACIÓN ==========

    /**
     * Ejecutar migración manual de artículos pendientes
     * Crea tipos de herramienta y unidades para artículos con es_herramienta=true
     * que aún no han sido migrados
     */
    ejecutarMigracionManual: async () => {
        try {
            const response = await api.post('/herramientas-renta/migrar-pendientes');
            return response.data;
        } catch (error) {
            console.error('Error al ejecutar migración manual:', error);
            throw error.response?.data || error;
        }
    }
};

export default herramientasRentaService;
