import { Categoria, Articulo, Almacen, AlmacenCategoria, TipoHerramientaRenta } from '../models/index.js';

/**
 * GET /api/categorias
 * Obtener todas las categorías
 * Query params: almacen_id (opcional) - filtrar por almacén
 */
export const getCategorias = async (req, res) => {
    try {
        const { almacen_id } = req.query;

        let categorias;
        if (almacen_id) {
            // Filtro directo por almacen_id (aislamiento por almacén)
            categorias = await Categoria.findAll({
                where: { almacen_id },
                order: [['nombre', 'ASC']]
            });
        } else {
            categorias = await Categoria.findAll({
                order: [['nombre', 'ASC']]
            });
        }

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
        const { nombre, descripcion, almacen_id } = req.body;

        // Validar campos requeridos
        if (!nombre || !nombre.trim()) {
            return res.status(400).json({
                success: false,
                message: 'El nombre de la categoría es obligatorio'
            });
        }
        if (!almacen_id) {
            return res.status(400).json({
                success: false,
                message: 'Debes seleccionar un almacén antes de crear la categoría'
            });
        }

        // Verificar si ya existe una categoría con ese nombre EN ESE ALMACÉN
        const categoriaExistente = await Categoria.findOne({
            where: { nombre: nombre.trim(), almacen_id }
        });

        if (categoriaExistente) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe una categoría con ese nombre en este almacén'
            });
        }

        // Crear la categoría
        const nuevaCategoria = await Categoria.create({
            nombre: nombre.trim(),
            descripcion: descripcion ? descripcion.trim() : 'Sin descripción',
            almacen_id
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

            // Verificar si ya existe otra categoría con ese nombre en el mismo almacén
            const categoriaExistente = await Categoria.findOne({
                where: { nombre: nombre.trim(), almacen_id: categoria.almacen_id }
            });

            if (categoriaExistente && categoriaExistente.id !== parseInt(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe otra categoría con ese nombre en este almacén'
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

        // Contar referencias en todas las tablas relacionadas
        const articulosAsociados = await Articulo.count({
            where: { categoria_id: id }
        });
        let tiposHerramientaAsociados = 0;
        try {
            tiposHerramientaAsociados = await TipoHerramientaRenta.count({
                where: { categoria_id: id }
            });
        } catch (e) {
            // tabla puede no existir en bases legacy — ignorar conteo
        }

        const totalReferencias = articulosAsociados + tiposHerramientaAsociados;

        // Si hay referencias y no se fuerza la eliminación, retornar advertencia
        if (totalReferencias > 0 && force !== 'true') {
            const partes = [];
            if (articulosAsociados > 0) partes.push(`${articulosAsociados} artículo(s)`);
            if (tiposHerramientaAsociados > 0) partes.push(`${tiposHerramientaAsociados} tipo(s) de herramienta de renta`);
            return res.status(400).json({
                success: false,
                requiresConfirmation: true,
                articlesCount: articulosAsociados,
                rentalToolsCount: tiposHerramientaAsociados,
                message: `Esta categoría tiene ${partes.join(' y ')} asociado(s). Si la eliminas, se moverán a "Sin Categoría".`
            });
        }

        // Si se fuerza la eliminación o no hay referencias, proceder
        if (totalReferencias > 0 && force === 'true') {
            // Crear/obtener categoría "Sin Categoría"
            let categoriaSinAsignar = await Categoria.findOne({
                where: { nombre: 'Sin Categoría' }
            });

            if (!categoriaSinAsignar) {
                categoriaSinAsignar = await Categoria.create({
                    nombre: 'Sin Categoría',
                    descripcion: 'Artículos sin categoría asignada'
                });
            }

            // Reasignar artículos a "Sin Categoría"
            if (articulosAsociados > 0) {
                await Articulo.update(
                    { categoria_id: categoriaSinAsignar.id },
                    { where: { categoria_id: id } }
                );
            }

            // Reasignar tipos de herramienta de renta a "Sin Categoría"
            if (tiposHerramientaAsociados > 0) {
                await TipoHerramientaRenta.update(
                    { categoria_id: categoriaSinAsignar.id },
                    { where: { categoria_id: id } }
                );
            }
        }

        // Limpiar vínculos en tabla pivote almacen-categoría (no requiere force)
        try {
            await AlmacenCategoria.destroy({ where: { categoria_id: id } });
        } catch (e) {
            console.log('⚠️ No se pudo limpiar almacen_categorias:', e.message?.substring(0, 80));
        }

        // Eliminar la categoría
        await categoria.destroy();

        const mensajesMovimiento = [];
        if (articulosAsociados > 0) mensajesMovimiento.push(`${articulosAsociados} artículo(s)`);
        if (tiposHerramientaAsociados > 0) mensajesMovimiento.push(`${tiposHerramientaAsociados} tipo(s) de herramienta de renta`);
        const sufijo = mensajesMovimiento.length > 0
            ? `. ${mensajesMovimiento.join(' y ')} movido(s) a "Sin Categoría"`
            : '';

        res.status(200).json({
            success: true,
            message: `Categoría eliminada exitosamente${sufijo}`
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
