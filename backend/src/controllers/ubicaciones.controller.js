import { Ubicacion, Articulo } from '../models/index.js';

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

/**
 * POST /api/ubicaciones
 * Crear una nueva ubicación
 */
export const crearUbicacion = async (req, res) => {
    try {
        const { codigo, almacen, pasillo, estante, nivel, descripcion } = req.body;

        // Validar campos requeridos
        if (!codigo || !codigo.trim()) {
            return res.status(400).json({
                success: false,
                message: 'El código de la ubicación es obligatorio'
            });
        }

        // Verificar si ya existe una ubicación con ese código
        const ubicacionExistente = await Ubicacion.findOne({
            where: { codigo: codigo.trim() }
        });

        if (ubicacionExistente) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe una ubicación con ese código'
            });
        }

        // Crear la ubicación
        const nuevaUbicacion = await Ubicacion.create({
            codigo: codigo.trim(),
            almacen: almacen && almacen.trim() ? almacen.trim() : 'Principal', // Usar valor por defecto si está vacío
            pasillo: pasillo ? pasillo.trim() : null,
            estante: estante ? estante.trim() : null,
            nivel: nivel || null,
            descripcion: descripcion ? descripcion.trim() : null
        });

        res.status(201).json({
            success: true,
            message: 'Ubicación creada exitosamente',
            data: { ubicacion: nuevaUbicacion }
        });

    } catch (error) {
        console.error('Error en crearUbicacion:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear ubicación',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * PUT /api/ubicaciones/:id
 * Actualizar una ubicación
 */
export const actualizarUbicacion = async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo, almacen, pasillo, estante, nivel, descripcion } = req.body;

        // Buscar la ubicación
        const ubicacion = await Ubicacion.findByPk(id);
        if (!ubicacion) {
            return res.status(404).json({
                success: false,
                message: 'Ubicación no encontrada'
            });
        }

        // Validar código si se proporciona
        if (codigo !== undefined) {
            if (!codigo.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'El código de la ubicación no puede estar vacío'
                });
            }

            // Verificar si ya existe otra ubicación con ese código
            const ubicacionExistente = await Ubicacion.findOne({
                where: { codigo: codigo.trim() }
            });

            if (ubicacionExistente && ubicacionExistente.id !== parseInt(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe otra ubicación con ese código'
                });
            }
        }

        // Actualizar la ubicación
        await ubicacion.update({
            codigo: codigo ? codigo.trim() : ubicacion.codigo,
            almacen: almacen !== undefined ? (almacen ? almacen.trim() : null) : ubicacion.almacen,
            pasillo: pasillo !== undefined ? (pasillo ? pasillo.trim() : null) : ubicacion.pasillo,
            estante: estante !== undefined ? (estante ? estante.trim() : null) : ubicacion.estante,
            nivel: nivel !== undefined ? nivel : ubicacion.nivel,
            descripcion: descripcion !== undefined ? (descripcion ? descripcion.trim() : null) : ubicacion.descripcion
        });

        res.status(200).json({
            success: true,
            message: 'Ubicación actualizada exitosamente',
            data: { ubicacion }
        });

    } catch (error) {
        console.error('Error en actualizarUbicacion:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar ubicación',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * DELETE /api/ubicaciones/:id
 * Eliminar una ubicación
 * Query param: force=true para forzar eliminación desvinculando artículos
 */
export const eliminarUbicacion = async (req, res) => {
    try {
        const { id } = req.params;
        const { force } = req.query;

        // Buscar la ubicación
        const ubicacion = await Ubicacion.findByPk(id);
        if (!ubicacion) {
            return res.status(404).json({
                success: false,
                message: 'Ubicación no encontrada'
            });
        }

        // Contar artículos asociados
        const articulosAsociados = await Articulo.count({
            where: { ubicacion_id: id }
        });

        // Si hay artículos y no se fuerza la eliminación, retornar advertencia
        if (articulosAsociados > 0 && force !== 'true') {
            return res.status(400).json({
                success: false,
                requiresConfirmation: true,
                articlesCount: articulosAsociados,
                message: `Esta ubicación tiene ${articulosAsociados} artículo(s) asociado(s). Si la eliminas, estos artículos quedarán sin ubicación.`
            });
        }

        // Si se fuerza la eliminación o no hay artículos, proceder
        if (articulosAsociados > 0 && force === 'true') {
            // Desvincular artículos (poner ubicacion_id en NULL o una ubicación por defecto)
            let ubicacionSinAsignar = await Ubicacion.findOne({
                where: { codigo: 'SIN-ASIGNAR' }
            });

            if (!ubicacionSinAsignar) {
                ubicacionSinAsignar = await Ubicacion.create({
                    codigo: 'SIN-ASIGNAR',
                    almacen: 'General',
                    descripcion: 'Artículos sin ubicación asignada'
                });
            }

            // Actualizar todos los artículos a la ubicación "Sin Asignar"
            await Articulo.update(
                { ubicacion_id: ubicacionSinAsignar.id },
                { where: { ubicacion_id: id } }
            );
        }

        // Eliminar la ubicación
        await ubicacion.destroy();

        res.status(200).json({
            success: true,
            message: `Ubicación eliminada exitosamente${articulosAsociados > 0 ? `. ${articulosAsociados} artículo(s) movido(s) a "Sin Asignar"` : ''}`
        });

    } catch (error) {
        console.error('Error en eliminarUbicacion:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar ubicación',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    getUbicaciones,
    crearUbicacion,
    actualizarUbicacion,
    eliminarUbicacion
};
