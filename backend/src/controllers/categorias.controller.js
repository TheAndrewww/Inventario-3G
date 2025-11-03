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

/**
 * POST /api/categorias
 * Crear una nueva categoría
 */
export const crearCategoria = async (req, res) => {
    try {
        const { nombre, descripcion } = req.body;

        // Validar campos requeridos
        if (!nombre || !nombre.trim()) {
            return res.status(400).json({
                success: false,
                message: 'El nombre de la categoría es obligatorio'
            });
        }

        // Verificar si ya existe una categoría con ese nombre
        const categoriaExistente = await Categoria.findOne({
            where: { nombre: nombre.trim() }
        });

        if (categoriaExistente) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe una categoría con ese nombre'
            });
        }

        // Crear la categoría
        const nuevaCategoria = await Categoria.create({
            nombre: nombre.trim(),
            descripcion: descripcion ? descripcion.trim() : 'Sin descripción'
        });

        res.status(201).json({
            success: true,
            message: 'Categoría creada exitosamente',
            data: nuevaCategoria
        });

    } catch (error) {
        console.error('Error en crearCategoria:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear categoría',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    getCategorias,
    crearCategoria
};
