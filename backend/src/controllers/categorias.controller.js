import { Categoria } from '../models/index.js';

/**
 * GET /api/categorias
 * Obtener todas las categorías
 */
export const getCategorias = async (req, res) => {
    try {
        const categorias = await Categoria.findAll({
            order: [['nombre', 'ASC']]
        });

        res.status(200).json({
            success: true,
            data: {
                categorias
            }
        });

    } catch (error) {
        console.error('Error en getCategorias:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener categorías',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    getCategorias
};
