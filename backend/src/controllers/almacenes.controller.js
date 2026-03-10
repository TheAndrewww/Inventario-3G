import { Almacen, AlmacenCategoria, Categoria, Ubicacion, Articulo } from '../models/index.js';

/**
 * GET /api/almacenes
 * Obtener todos los almacenes con conteo de ubicaciones y categorías
 */
export const getAlmacenes = async (req, res) => {
    try {
        const almacenes = await Almacen.findAll({
            where: { activo: true },
            include: [
                {
                    model: Categoria,
                    as: 'categorias',
                    attributes: ['id', 'nombre', 'color', 'icono'],
                    through: { attributes: [] }
                }
            ],
            order: [['nombre', 'ASC']]
        });

        // Agregar conteo de ubicaciones y artículos para cada almacén
        const almacenesConConteo = await Promise.all(almacenes.map(async (almacen) => {
            const ubicacionesCount = await Ubicacion.count({
                where: { almacen_id: almacen.id, activo: true }
            });

            const ubicacionIds = (await Ubicacion.findAll({
                where: { almacen_id: almacen.id, activo: true },
                attributes: ['id']
            })).map(u => u.id);

            const articulosCount = ubicacionIds.length > 0
                ? await Articulo.count({
                    where: { ubicacion_id: ubicacionIds, activo: true }
                })
                : 0;

            return {
                ...almacen.toJSON(),
                ubicaciones_count: ubicacionesCount,
                articulos_count: articulosCount
            };
        }));

        res.status(200).json({
            success: true,
            data: { almacenes: almacenesConConteo }
        });

    } catch (error) {
        console.error('Error en getAlmacenes:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener almacenes',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * GET /api/almacenes/:id
 * Obtener un almacén por ID con sus categorías y ubicaciones
 */
export const getAlmacenById = async (req, res) => {
    try {
        const { id } = req.params;
        const almacen = await Almacen.findByPk(id, {
            include: [
                {
                    model: Categoria,
                    as: 'categorias',
                    attributes: ['id', 'nombre', 'color', 'icono'],
                    through: { attributes: [] }
                }
            ]
        });

        if (!almacen) {
            return res.status(404).json({
                success: false,
                message: 'Almacén no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            data: { almacen }
        });

    } catch (error) {
        console.error('Error en getAlmacenById:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener almacén',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * POST /api/almacenes
 * Crear un nuevo almacén
 */
export const crearAlmacen = async (req, res) => {
    try {
        const { nombre, descripcion } = req.body;

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({
                success: false,
                message: 'El nombre del almacén es obligatorio'
            });
        }

        // Verificar si ya existe
        const existente = await Almacen.findOne({
            where: { nombre: nombre.trim() }
        });

        if (existente) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe un almacén con ese nombre'
            });
        }

        const nuevoAlmacen = await Almacen.create({
            nombre: nombre.trim(),
            descripcion: descripcion ? descripcion.trim() : null
        });

        res.status(201).json({
            success: true,
            message: 'Almacén creado exitosamente',
            data: { almacen: nuevoAlmacen }
        });

    } catch (error) {
        console.error('Error en crearAlmacen:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear almacén',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * PUT /api/almacenes/:id
 * Actualizar un almacén
 */
export const actualizarAlmacen = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, activo } = req.body;

        const almacen = await Almacen.findByPk(id);
        if (!almacen) {
            return res.status(404).json({
                success: false,
                message: 'Almacén no encontrado'
            });
        }

        if (nombre !== undefined) {
            if (!nombre.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'El nombre del almacén no puede estar vacío'
                });
            }

            const existente = await Almacen.findOne({
                where: { nombre: nombre.trim() }
            });

            if (existente && existente.id !== parseInt(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe otro almacén con ese nombre'
                });
            }
        }

        // También actualizar el campo legacy en las ubicaciones si se renombra
        const nombreAnterior = almacen.nombre;
        await almacen.update({
            nombre: nombre ? nombre.trim() : almacen.nombre,
            descripcion: descripcion !== undefined ? (descripcion ? descripcion.trim() : null) : almacen.descripcion,
            activo: activo !== undefined ? activo : almacen.activo
        });

        // Sincronizar campo legacy en ubicaciones
        if (nombre && nombre.trim() !== nombreAnterior) {
            await Ubicacion.update(
                { almacen: nombre.trim() },
                { where: { almacen_id: id } }
            );
        }

        res.status(200).json({
            success: true,
            message: 'Almacén actualizado exitosamente',
            data: { almacen }
        });

    } catch (error) {
        console.error('Error en actualizarAlmacen:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar almacén',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * DELETE /api/almacenes/:id
 * Eliminar un almacén
 */
export const eliminarAlmacen = async (req, res) => {
    try {
        const { id } = req.params;
        const { force } = req.query;

        const almacen = await Almacen.findByPk(id);
        if (!almacen) {
            return res.status(404).json({
                success: false,
                message: 'Almacén no encontrado'
            });
        }

        const ubicacionesCount = await Ubicacion.count({
            where: { almacen_id: id, activo: true }
        });

        if (ubicacionesCount > 0 && force !== 'true') {
            return res.status(400).json({
                success: false,
                requiresConfirmation: true,
                ubicacionesCount,
                message: `Este almacén tiene ${ubicacionesCount} ubicación(es). Si lo eliminas, las ubicaciones quedarán sin almacén.`
            });
        }

        if (ubicacionesCount > 0 && force === 'true') {
            await Ubicacion.update(
                { almacen_id: null, almacen: null },
                { where: { almacen_id: id } }
            );
        }

        // Eliminar relaciones con categorías
        await AlmacenCategoria.destroy({ where: { almacen_id: id } });

        await almacen.destroy();

        res.status(200).json({
            success: true,
            message: `Almacén eliminado exitosamente${ubicacionesCount > 0 ? `. ${ubicacionesCount} ubicación(es) desvinculadas.` : ''}`
        });

    } catch (error) {
        console.error('Error en eliminarAlmacen:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar almacén',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * GET /api/almacenes/:id/categorias
 * Obtener categorías de un almacén específico
 */
export const getCategoriasAlmacen = async (req, res) => {
    try {
        const { id } = req.params;

        const almacen = await Almacen.findByPk(id);
        if (!almacen) {
            return res.status(404).json({
                success: false,
                message: 'Almacén no encontrado'
            });
        }

        const categorias = await Categoria.findAll({
            include: [{
                model: Almacen,
                as: 'almacenes',
                where: { id },
                attributes: [],
                through: { attributes: [] }
            }],
            order: [['nombre', 'ASC']]
        });

        res.status(200).json({
            success: true,
            data: { categorias }
        });

    } catch (error) {
        console.error('Error en getCategoriasAlmacen:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener categorías del almacén',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * POST /api/almacenes/:id/categorias
 * Asignar una categoría a un almacén
 */
export const asignarCategoriaAlmacen = async (req, res) => {
    try {
        const { id } = req.params;
        const { categoria_id } = req.body;

        if (!categoria_id) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere categoria_id'
            });
        }

        const almacen = await Almacen.findByPk(id);
        if (!almacen) {
            return res.status(404).json({
                success: false,
                message: 'Almacén no encontrado'
            });
        }

        const categoria = await Categoria.findByPk(categoria_id);
        if (!categoria) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada'
            });
        }

        // Verificar si ya existe la relación
        const existe = await AlmacenCategoria.findOne({
            where: { almacen_id: id, categoria_id }
        });

        if (existe) {
            return res.status(400).json({
                success: false,
                message: 'Esta categoría ya está asignada a este almacén'
            });
        }

        await AlmacenCategoria.create({
            almacen_id: parseInt(id),
            categoria_id: parseInt(categoria_id)
        });

        res.status(201).json({
            success: true,
            message: `Categoría "${categoria.nombre}" asignada al almacén "${almacen.nombre}"`
        });

    } catch (error) {
        console.error('Error en asignarCategoriaAlmacen:', error);
        res.status(500).json({
            success: false,
            message: 'Error al asignar categoría al almacén',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * DELETE /api/almacenes/:id/categorias/:categoriaId
 * Desasignar una categoría de un almacén
 */
export const desasignarCategoriaAlmacen = async (req, res) => {
    try {
        const { id, categoriaId } = req.params;

        const deleted = await AlmacenCategoria.destroy({
            where: { almacen_id: id, categoria_id: categoriaId }
        });

        if (deleted === 0) {
            return res.status(404).json({
                success: false,
                message: 'Relación no encontrada'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Categoría desasignada del almacén exitosamente'
        });

    } catch (error) {
        console.error('Error en desasignarCategoriaAlmacen:', error);
        res.status(500).json({
            success: false,
            message: 'Error al desasignar categoría del almacén',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    getAlmacenes,
    getAlmacenById,
    crearAlmacen,
    actualizarAlmacen,
    eliminarAlmacen,
    getCategoriasAlmacen,
    asignarCategoriaAlmacen,
    desasignarCategoriaAlmacen
};
