/**
 * Controlador Mi Equipo
 * Dashboard personal para cada usuario
 */

import { UnidadHerramientaRenta, TipoHerramientaRenta, Camioneta, Usuario, Ubicacion } from '../models/index.js';
import { Op } from 'sequelize';

/**
 * GET /api/mi-equipo
 * Obtiene el dashboard personal del usuario autenticado.
 * El administrador puede pasar ?usuario_id=N para ver el equipo de otro usuario.
 */
export const obtenerMiEquipo = async (req, res) => {
    try {
        const requesterId = req.usuario.id;
        const requesterRol = req.usuario.rol;

        // Admin puede inspeccionar el equipo de otro usuario vía ?usuario_id
        let usuarioId = requesterId;
        let usuarioNombre = req.usuario.nombre;
        let usuarioRol = requesterRol;
        const usuarioIdQuery = req.query.usuario_id ? parseInt(req.query.usuario_id, 10) : null;
        if (usuarioIdQuery && usuarioIdQuery !== requesterId) {
            if (requesterRol !== 'administrador') {
                return res.status(403).json({ success: false, message: 'Solo el administrador puede ver el equipo de otros usuarios' });
            }
            const objetivo = await Usuario.findByPk(usuarioIdQuery, { attributes: ['id', 'nombre', 'rol', 'activo'] });
            if (!objetivo || objetivo.activo === false) {
                return res.status(404).json({ success: false, message: 'Usuario objetivo no encontrado' });
            }
            usuarioId = objetivo.id;
            usuarioNombre = objetivo.nombre;
            usuarioRol = objetivo.rol;
        }

        // 1. Obtener herramientas asignadas al usuario
        let herramientasAsignadas = [];
        try {
            herramientasAsignadas = await UnidadHerramientaRenta.findAll({
                where: {
                    usuario_asignado_id: usuarioId,
                    activo: true
                },
                include: [
                    {
                        model: TipoHerramientaRenta,
                        as: 'tipoHerramienta',
                        attributes: ['id', 'nombre', 'prefijo_codigo', 'imagen_url']
                    }
                ],
                order: [['fecha_asignacion', 'DESC']]
            });

            // Filtrar solo las asignadas (compatibilidad con ambos campos)
            herramientasAsignadas = herramientasAsignadas.filter(h =>
                h.estatus === 'asignado' || h.estado === 'asignada'
            );
        } catch (herramientasError) {
            console.error('Error al obtener herramientas:', herramientasError.message);
            // Continuar con array vacío
        }

        // 2. Obtener camionetas donde el usuario es encargado
        let camionetasACargo = [];
        try {
            camionetasACargo = await Camioneta.findAll({
                where: {
                    encargado_id: usuarioId,
                    activo: true
                },
                include: [
                    {
                        model: Usuario,
                        as: 'encargado',
                        attributes: ['id', 'nombre', 'email'],
                        required: false
                    },
                    {
                        model: Ubicacion,
                        as: 'almacenBase',
                        attributes: ['id', 'almacen', 'descripcion'],
                        required: false
                    }
                ]
            });
        } catch (camionetasError) {
            console.error('Error al obtener camionetas:', camionetasError.message);
            // Continuar con array vacío
        }

        // 3. Para cada camioneta, calcular estado del stock (simplificado)
        const camionetasConStock = camionetasACargo.map(camioneta => {
            return {
                ...camioneta.toJSON(),
                inventarioActual: 0,
                stockMinimoConfigurado: 0,
                alertas: [],
                stockCompleto: true
            };
        });

        // 4. Calcular estadísticas
        const stats = {
            totalHerramientas: herramientasAsignadas.length,
            totalCamionetas: camionetasConStock.length,
            alertasStock: 0,
            herramientasPorCondicion: {
                bueno: herramientasAsignadas.filter(h => (h.condicion || 'bueno') === 'bueno').length,
                regular: herramientasAsignadas.filter(h => h.condicion === 'regular').length,
                malo: herramientasAsignadas.filter(h => h.condicion === 'malo').length
            }
        };

        res.json({
            success: true,
            data: {
                usuario: {
                    id: usuarioId,
                    nombre: usuarioNombre,
                    rol: usuarioRol
                },
                stats,
                herramientas: herramientasAsignadas,
                camionetas: camionetasConStock
            }
        });

    } catch (error) {
        console.error('Error al obtener mi equipo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener información personal',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * GET /api/mi-equipo/usuarios-con-equipo
 * Lista de usuarios con herramientas o camionetas asignadas. Solo admin.
 * Útil para que el admin pueda seleccionar de quién ver el equipo.
 */
export const listarUsuariosConEquipo = async (req, res) => {
    try {
        if (req.usuario.rol !== 'administrador') {
            return res.status(403).json({ success: false, message: 'Solo administrador' });
        }

        // Usuarios con herramientas asignadas
        const conHerramientas = await UnidadHerramientaRenta.findAll({
            where: { activo: true, usuario_asignado_id: { [Op.ne]: null } },
            attributes: ['usuario_asignado_id'],
            group: ['usuario_asignado_id']
        }).catch(() => []);

        // Usuarios encargados de camionetas
        const conCamionetas = await Camioneta.findAll({
            where: { activo: true, encargado_id: { [Op.ne]: null } },
            attributes: ['encargado_id'],
            group: ['encargado_id']
        }).catch(() => []);

        const idsSet = new Set();
        conHerramientas.forEach(u => u.usuario_asignado_id && idsSet.add(u.usuario_asignado_id));
        conCamionetas.forEach(c => c.encargado_id && idsSet.add(c.encargado_id));

        if (idsSet.size === 0) {
            return res.json({ success: true, data: { usuarios: [] } });
        }

        const usuarios = await Usuario.findAll({
            where: { id: { [Op.in]: [...idsSet] }, activo: true },
            attributes: ['id', 'nombre', 'email', 'rol'],
            order: [['nombre', 'ASC']]
        });

        res.json({ success: true, data: { usuarios } });
    } catch (error) {
        console.error('Error al listar usuarios con equipo:', error);
        res.status(500).json({ success: false, message: 'Error al listar usuarios' });
    }
};

/**
 * GET /api/mi-equipo/historial
 * Obtiene el historial de asignaciones del usuario
 */
export const obtenerMiHistorial = async (req, res) => {
    try {
        const usuarioId = req.usuario.id;
        const { limite = 20 } = req.query;

        // Importar modelo de historial
        const { HistorialAsignacionHerramienta } = await import('../models/index.js');

        const historial = await HistorialAsignacionHerramienta.findAll({
            where: { usuario_id: usuarioId },
            include: [
                {
                    model: UnidadHerramientaRenta,
                    as: 'unidadHerramienta',
                    include: [
                        {
                            model: TipoHerramientaRenta,
                            as: 'tipoHerramienta',
                            attributes: ['nombre', 'prefijo_codigo']
                        }
                    ]
                }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limite)
        });

        res.json({
            success: true,
            data: { historial }
        });

    } catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener historial'
        });
    }
};
