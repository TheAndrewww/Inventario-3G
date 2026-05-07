import { Ubicacion, Articulo, Almacen, TipoHerramientaRenta, Equipo, Camioneta, Movimiento } from '../models/index.js';

/**
 * GET /api/ubicaciones
 * Obtener todas las ubicaciones
 * Query params: almacen_id (opcional) - filtrar por almacén
 */
export const getUbicaciones = async (req, res) => {
    try {
        const { almacen_id } = req.query;

        const where = {};
        if (almacen_id) {
            where.almacen_id = almacen_id;
        }

        let ubicaciones;
        try {
            ubicaciones = await Ubicacion.findAll({
                where,
                include: [{
                    model: Almacen,
                    as: 'almacen_ref',
                    attributes: ['id', 'nombre'],
                    required: false
                }],
                order: [['codigo', 'ASC']]
            });
        } catch (includeError) {
            // Fallback: si la tabla almacenes no existe aún, consultar sin include
            console.log('⚠️ getUbicaciones fallback sin Almacen include:', includeError.message?.substring(0, 80));
            ubicaciones = await Ubicacion.findAll({
                where: {},
                order: [['codigo', 'ASC']]
            });
        }

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
        const { codigo, almacen, almacen_id, pasillo, estante, nivel, descripcion } = req.body;

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

        // Si hay almacen_id, obtener el nombre del almacén para el campo legacy
        let almacenNombre = almacen && almacen.trim() ? almacen.trim() : 'Principal';
        if (almacen_id) {
            const almacenObj = await Almacen.findByPk(almacen_id);
            if (almacenObj) {
                almacenNombre = almacenObj.nombre;
            }
        }

        // Crear la ubicación
        const nuevaUbicacion = await Ubicacion.create({
            codigo: codigo.trim(),
            almacen_id: almacen_id || null,
            almacen: almacenNombre,
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
        const { codigo, almacen, pasillo, estante, nivel, descripcion, activo } = req.body;

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
            descripcion: descripcion !== undefined ? (descripcion ? descripcion.trim() : null) : ubicacion.descripcion,
            activo: activo !== undefined ? activo : ubicacion.activo
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

        // Contar referencias en todas las tablas relacionadas
        const articulosAsociados = await Articulo.count({
            where: { ubicacion_id: id }
        });
        let tiposHerramientaAsociados = 0;
        let equiposAsociados = 0;
        let camionetasAsociadas = 0;
        let movimientosAsociados = 0;
        try { tiposHerramientaAsociados = await TipoHerramientaRenta.count({ where: { ubicacion_id: id } }); } catch (e) {}
        try { equiposAsociados = await Equipo.count({ where: { almacen_base_id: id } }); } catch (e) {}
        try { camionetasAsociadas = await Camioneta.count({ where: { almacen_base_id: id } }); } catch (e) {}
        try { movimientosAsociados = await Movimiento.count({ where: { ubicacion_destino_id: id } }); } catch (e) {}

        const totalReferencias = articulosAsociados + tiposHerramientaAsociados + equiposAsociados + camionetasAsociadas + movimientosAsociados;

        // Si hay referencias y no se fuerza la eliminación, retornar advertencia
        if (totalReferencias > 0 && force !== 'true') {
            const partes = [];
            if (articulosAsociados > 0) partes.push(`${articulosAsociados} artículo(s)`);
            if (tiposHerramientaAsociados > 0) partes.push(`${tiposHerramientaAsociados} tipo(s) de herramienta de renta`);
            if (equiposAsociados > 0) partes.push(`${equiposAsociados} equipo(s)`);
            if (camionetasAsociadas > 0) partes.push(`${camionetasAsociadas} camioneta(s)`);
            if (movimientosAsociados > 0) partes.push(`${movimientosAsociados} movimiento(s)`);
            return res.status(400).json({
                success: false,
                requiresConfirmation: true,
                articlesCount: articulosAsociados,
                rentalToolsCount: tiposHerramientaAsociados,
                equipmentCount: equiposAsociados,
                vehiclesCount: camionetasAsociadas,
                movementsCount: movimientosAsociados,
                message: `Esta ubicación tiene ${partes.join(', ')} asociado(s). Si la eliminas, las referencias se reasignarán o desvincularán.`
            });
        }

        // Si se fuerza la eliminación o no hay referencias, proceder
        if (totalReferencias > 0 && force === 'true') {
            // Crear/obtener ubicación "SIN-ASIGNAR" para reasignaciones obligatorias
            let ubicacionSinAsignar = await Ubicacion.findOne({
                where: { codigo: 'SIN-ASIGNAR' }
            });

            if (!ubicacionSinAsignar) {
                ubicacionSinAsignar = await Ubicacion.create({
                    codigo: 'SIN-ASIGNAR',
                    almacen: 'Principal',
                    descripcion: 'Artículos sin ubicación asignada'
                });
            }

            // Reasignar artículos a "SIN-ASIGNAR"
            if (articulosAsociados > 0) {
                await Articulo.update(
                    { ubicacion_id: ubicacionSinAsignar.id },
                    { where: { ubicacion_id: id } }
                );
            }

            // Reasignar tipos de herramienta de renta (campo NOT NULL)
            if (tiposHerramientaAsociados > 0) {
                await TipoHerramientaRenta.update(
                    { ubicacion_id: ubicacionSinAsignar.id },
                    { where: { ubicacion_id: id } }
                );
            }

            // Equipos, Camionetas y Movimientos: el FK permite NULL → desvincular
            if (equiposAsociados > 0) {
                try { await Equipo.update({ almacen_base_id: null }, { where: { almacen_base_id: id } }); } catch (e) {}
            }
            if (camionetasAsociadas > 0) {
                try { await Camioneta.update({ almacen_base_id: null }, { where: { almacen_base_id: id } }); } catch (e) {}
            }
            if (movimientosAsociados > 0) {
                try { await Movimiento.update({ ubicacion_destino_id: null }, { where: { ubicacion_destino_id: id } }); } catch (e) {}
            }
        }

        // Eliminar la ubicación
        await ubicacion.destroy();

        const mensajesMovimiento = [];
        if (articulosAsociados > 0) mensajesMovimiento.push(`${articulosAsociados} artículo(s)`);
        if (tiposHerramientaAsociados > 0) mensajesMovimiento.push(`${tiposHerramientaAsociados} tipo(s) de herramienta`);
        if (equiposAsociados > 0) mensajesMovimiento.push(`${equiposAsociados} equipo(s)`);
        if (camionetasAsociadas > 0) mensajesMovimiento.push(`${camionetasAsociadas} camioneta(s)`);
        if (movimientosAsociados > 0) mensajesMovimiento.push(`${movimientosAsociados} movimiento(s)`);
        const sufijo = mensajesMovimiento.length > 0
            ? `. Reasignaciones: ${mensajesMovimiento.join(', ')}`
            : '';

        res.status(200).json({
            success: true,
            message: `Ubicación eliminada exitosamente${sufijo}`
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
