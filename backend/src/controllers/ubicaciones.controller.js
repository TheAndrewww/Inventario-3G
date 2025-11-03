import { Ubicacion } from '../models/index.js';

/**
 * GET /api/ubicaciones
 * Obtener todas las ubicaciones
 */
export const getUbicaciones = async (req, res) => {
    try {
        const ubicaciones = await Ubicacion.findAll({
            order: [['codigo', 'ASC']]
        });

        res.status(200).json({
            success: true,
            data: {
                ubicaciones
            }
        });

    } catch (error) {
        console.error('Error en getUbicaciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener ubicaciones',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    getUbicaciones
};
