import { Equipo, Usuario } from '../models/index.js';

// Obtener todos los equipos
export const obtenerEquipos = async (req, res) => {
    try {
        const equipos = await Equipo.findAll({
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
                    as: 'supervisor',
                    attributes: ['id', 'nombre', 'email', 'puesto']
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
        const { nombre, descripcion, supervisor_id } = req.body;

        // Validaciones
        if (!nombre || !supervisor_id) {
            return res.status(400).json({
                success: false,
                message: 'El nombre y supervisor_id son requeridos'
            });
        }

        // Verificar que el encargado existe y tiene rol de encargado
        const encargado = await Usuario.findByPk(supervisor_id);
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

        const equipo = await Equipo.create({
            nombre,
            descripcion,
            supervisor_id
        });

        const equipoCompleto = await Equipo.findByPk(equipo.id, {
            include: [
                {
                    model: Usuario,
                    as: 'supervisor',
                    attributes: ['id', 'nombre', 'email', 'puesto']
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
        const { nombre, descripcion, supervisor_id, activo } = req.body;

        const equipo = await Equipo.findByPk(id);
        if (!equipo) {
            return res.status(404).json({
                success: false,
                message: 'Equipo no encontrado'
            });
        }

        // Si se va a cambiar el encargado, validar
        if (supervisor_id && supervisor_id !== equipo.supervisor_id) {
            const encargado = await Usuario.findByPk(supervisor_id);
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
        }

        await equipo.update({
            nombre: nombre || equipo.nombre,
            descripcion: descripcion !== undefined ? descripcion : equipo.descripcion,
            supervisor_id: supervisor_id || equipo.supervisor_id,
            activo: activo !== undefined ? activo : equipo.activo
        });

        const equipoActualizado = await Equipo.findByPk(id, {
            include: [
                {
                    model: Usuario,
                    as: 'supervisor',
                    attributes: ['id', 'nombre', 'email', 'puesto']
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
