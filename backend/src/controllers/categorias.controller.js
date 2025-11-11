import { Categoria, Articulo } from '../models/index.js';

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

/**
 * PUT /api/categorias/:id
 * Actualizar una categoría
 */
export const actualizarCategoria = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion } = req.body;

        // Buscar la categoría
        const categoria = await Categoria.findByPk(id);
        if (!categoria) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada'
            });
        }

        // Validar nombre si se proporciona
        if (nombre !== undefined) {
            if (!nombre.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'El nombre de la categoría no puede estar vacío'
                });
            }

            // Verificar si ya existe otra categoría con ese nombre
            const categoriaExistente = await Categoria.findOne({
                where: { nombre: nombre.trim() }
            });

            if (categoriaExistente && categoriaExistente.id !== parseInt(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe otra categoría con ese nombre'
                });
            }
        }

        // Actualizar la categoría
        await categoria.update({
            nombre: nombre ? nombre.trim() : categoria.nombre,
            descripcion: descripcion !== undefined ? descripcion.trim() : categoria.descripcion
        });

        res.status(200).json({
            success: true,
            message: 'Categoría actualizada exitosamente',
            data: { categoria }
        });

    } catch (error) {
        console.error('Error en actualizarCategoria:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar categoría',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * DELETE /api/categorias/:id
 * Eliminar una categoría
 * Query param: force=true para forzar eliminación desvinculando artículos
 */
export const eliminarCategoria = async (req, res) => {
    try {
        const { id } = req.params;
        const { force } = req.query;

        // Buscar la categoría
        const categoria = await Categoria.findByPk(id);
        if (!categoria) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada'
            });
        }

        // Contar artículos asociados
        const articulosAsociados = await Articulo.count({
            where: { categoria_id: id }
        });

        // Si hay artículos y no se fuerza la eliminación, retornar advertencia
        if (articulosAsociados > 0 && force !== 'true') {
            return res.status(400).json({
                success: false,
                requiresConfirmation: true,
                articlesCount: articulosAsociados,
                message: `Esta categoría tiene ${articulosAsociados} artículo(s) asociado(s). Si la eliminas, estos artículos quedarán sin categoría.`
            });
        }

        // Si se fuerza la eliminación o no hay artículos, proceder
        if (articulosAsociados > 0 && force === 'true') {
            // Desvincular artículos (poner categoria_id en NULL o una categoría por defecto)
            // Por seguridad, mejor crear una categoría "Sin Categoría" si no existe
            let categoriaSinAsignar = await Categoria.findOne({
                where: { nombre: 'Sin Categoría' }
            });

            if (!categoriaSinAsignar) {
                categoriaSinAsignar = await Categoria.create({
                    nombre: 'Sin Categoría',
                    descripcion: 'Artículos sin categoría asignada'
                });
            }

            // Actualizar todos los artículos a la categoría "Sin Categoría"
            await Articulo.update(
                { categoria_id: categoriaSinAsignar.id },
                { where: { categoria_id: id } }
            );
        }

        // Eliminar la categoría
        await categoria.destroy();

        res.status(200).json({
            success: true,
            message: `Categoría eliminada exitosamente${articulosAsociados > 0 ? `. ${articulosAsociados} artículo(s) movido(s) a "Sin Categoría"` : ''}`
        });

    } catch (error) {
        console.error('Error en eliminarCategoria:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar categoría',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    getCategorias,
    crearCategoria,
    actualizarCategoria,
    eliminarCategoria
};
