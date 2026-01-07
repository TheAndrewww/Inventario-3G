import { Equipo, Usuario, Ubicacion } from '../models/index.js';

// Obtener todos los equipos
export const obtenerEquipos = async (req, res) => {
    try {
        const equipos = await Equipo.findAll({
            include: [
                {
                    model: Usuario,
                    as: 'encargado',
                    attributes: ['id', 'nombre', 'email', 'puesto']
                },
                {
                    model: Ubicacion,
                    as: 'almacenBase',
                    attributes: ['id', 'codigo', 'almacen', 'descripcion'],
                    required: false
                }
            ],
            order: [['nombre', 'ASC']]
        });

        res.status(200).json({
            success: true,
            data: { equipos }
        });
    } catch (error) {
        console.error('Error al obtener equipos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener equipos'
        });
    }
};

// Obtener un equipo por ID
export const obtenerEquipoPorId = async (req, res) => {
    try {
        const { id } = req.params;

        const equipo = await Equipo.findByPk(id, {
            include: [
                {
                    model: Usuario,
                    as: 'encargado',
                    attributes: ['id', 'nombre', 'email', 'puesto']
                },
                {
                    model: Ubicacion,
                    as: 'almacenBase',
                    attributes: ['id', 'codigo', 'almacen', 'descripcion'],
                    required: false
                }
            ]
        });

        if (!equipo) {
            return res.status(404).json({
                success: false,
                message: 'Equipo no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            data: { equipo }
        });
    } catch (error) {
        console.error('Error al obtener equipo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener equipo'
        });
    }
};

// Crear un equipo
export const crearEquipo = async (req, res) => {
    try {
        const { nombre, descripcion, encargado_id, matricula, tipo_camioneta, almacen_base_id } = req.body;

        // Validaciones
        if (!nombre || !encargado_id) {
            return res.status(400).json({
                success: false,
                message: 'El nombre y encargado_id son requeridos'
            });
        }

        // Verificar que el encargado existe y tiene rol de encargado
        const encargado = await Usuario.findByPk(encargado_id);
        if (!encargado) {
            return res.status(404).json({
                success: false,
                message: 'Encargado no encontrado'
            });
        }

        if (encargado.rol !== 'encargado' && encargado.rol !== 'administrador') {
            return res.status(400).json({
                success: false,
                message: 'El usuario debe tener rol de encargado o administrador'
            });
        }

        // Verificar que el encargado no esté ya asignado a otro equipo activo
        const equipoExistente = await Equipo.findOne({
            where: {
                encargado_id,
                activo: true
            }
        });

        if (equipoExistente) {
            return res.status(400).json({
                success: false,
                message: `Este encargado ya está asignado al equipo "${equipoExistente.nombre}"`
            });
        }

        const equipo = await Equipo.create({
            nombre,
            descripcion,
            encargado_id,
            matricula,
            tipo_camioneta: tipo_camioneta || 'general',
            almacen_base_id
        });

        const equipoCompleto = await Equipo.findByPk(equipo.id, {
            include: [
                {
                    model: Usuario,
                    as: 'encargado',
                    attributes: ['id', 'nombre', 'email', 'puesto']
                },
                {
                    model: Ubicacion,
                    as: 'almacenBase',
                    attributes: ['id', 'codigo', 'almacen', 'descripcion'],
                    required: false
                }
            ]
        });

        res.status(201).json({
            success: true,
            message: 'Equipo creado exitosamente',
            data: { equipo: equipoCompleto }
        });
    } catch (error) {
        console.error('Error al crear equipo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear equipo'
        });
    }
};

// Actualizar un equipo
export const actualizarEquipo = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, encargado_id, activo, matricula, tipo_camioneta, almacen_base_id } = req.body;

        const equipo = await Equipo.findByPk(id);
        if (!equipo) {
            return res.status(404).json({
                success: false,
                message: 'Equipo no encontrado'
            });
        }

        // Si se va a cambiar el encargado, validar
        if (encargado_id && encargado_id !== equipo.encargado_id) {
            const encargado = await Usuario.findByPk(encargado_id);
            if (!encargado) {
                return res.status(404).json({
                    success: false,
                    message: 'Encargado no encontrado'
                });
            }

            if (encargado.rol !== 'encargado' && encargado.rol !== 'administrador') {
                return res.status(400).json({
                    success: false,
                    message: 'El usuario debe tener rol de encargado o administrador'
                });
            }

            // Verificar que el encargado no esté ya asignado a otro equipo activo
            const equipoExistente = await Equipo.findOne({
                where: {
                    encargado_id,
                    activo: true
                }
            });

            if (equipoExistente && equipoExistente.id !== parseInt(id)) {
                return res.status(400).json({
                    success: false,
                    message: `Este encargado ya está asignado al equipo "${equipoExistente.nombre}"`
                });
            }
        }

        await equipo.update({
            nombre: nombre || equipo.nombre,
            descripcion: descripcion !== undefined ? descripcion : equipo.descripcion,
            encargado_id: encargado_id || equipo.encargado_id,
            activo: activo !== undefined ? activo : equipo.activo,
            matricula: matricula !== undefined ? matricula : equipo.matricula,
            tipo_camioneta: tipo_camioneta || equipo.tipo_camioneta,
            almacen_base_id: almacen_base_id !== undefined ? almacen_base_id : equipo.almacen_base_id
        });

        const equipoActualizado = await Equipo.findByPk(id, {
            include: [
                {
                    model: Usuario,
                    as: 'encargado',
                    attributes: ['id', 'nombre', 'email', 'puesto']
                },
                {
                    model: Ubicacion,
                    as: 'almacenBase',
                    attributes: ['id', 'codigo', 'almacen', 'descripcion'],
                    required: false
                }
            ]
        });

        res.status(200).json({
            success: true,
            message: 'Equipo actualizado exitosamente',
            data: { equipo: equipoActualizado }
        });
    } catch (error) {
        console.error('Error al actualizar equipo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar equipo'
        });
    }
};

// Eliminar (desactivar) un equipo
export const eliminarEquipo = async (req, res) => {
    try {
        const { id } = req.params;

        const equipo = await Equipo.findByPk(id);
        if (!equipo) {
            return res.status(404).json({
                success: false,
                message: 'Equipo no encontrado'
            });
        }

        // Desactivar en lugar de eliminar
        await equipo.update({ activo: false });

        res.status(200).json({
            success: true,
            message: 'Equipo desactivado exitosamente'
        });
    } catch (error) {
        console.error('Error al eliminar equipo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar equipo'
        });
    }
};

// Obtener equipos de un supervisor específico
export const obtenerEquiposPorSupervisor = async (req, res) => {
    try {
        const { supervisorId } = req.params;

        const equipos = await Equipo.findAll({
            where: {
                supervisor_id: supervisorId,
                activo: true
            },
            include: [
                {
                    model: Usuario,
                    as: 'supervisor',
                    attributes: ['id', 'nombre', 'email', 'puesto']
                }
            ],
            order: [['nombre', 'ASC']]
        });

        res.status(200).json({
            success: true,
            data: { equipos }
        });
    } catch (error) {
        console.error('Error al obtener equipos por supervisor:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener equipos'
        });
    }
};
