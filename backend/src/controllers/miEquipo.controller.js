/**
 * Controlador Mi Equipo
 * Dashboard personal para cada usuario
 */

import { UnidadHerramientaRenta, TipoHerramientaRenta, Camioneta, StockMinimoCamioneta, Usuario, Ubicacion } from '../models/index.js';
import { Op, Sequelize } from 'sequelize';

/**
 * GET /api/mi-equipo
 * Obtiene el dashboard personal del usuario autenticado
 * - Herramientas asignadas
 * - Camionetas a cargo (si es encargado)
 * - Alertas de stock mínimo
 */
export const obtenerMiEquipo = async (req, res) => {
    try {
        const usuarioId = req.usuario.id;
        const usuarioRol = req.usuario.rol;

        // 1. Obtener herramientas asignadas al usuario
        const herramientasAsignadas = await UnidadHerramientaRenta.findAll({
            where: {
                usuario_asignado_id: usuarioId,
                activo: true,
                [Op.or]: [
                    { estatus: 'asignado' },
                    { estado: 'asignada' } // Compatibilidad
                ]
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

        // 2. Obtener camionetas donde el usuario es encargado
        const camionetasACargo = await Camioneta.findAll({
            where: {
                encargado_id: usuarioId,
                activo: true
            },
            include: [
                {
                    model: Usuario,
                    as: 'encargado',
                    attributes: ['id', 'nombre', 'email']
                },
                {
                    model: Ubicacion,
                    as: 'almacenBase',
                    attributes: ['id', 'almacen', 'descripcion']
                }
            ]
        });

        // 3. Para cada camioneta, calcular estado del stock
        const camionetasConStock = await Promise.all(camionetasACargo.map(async (camioneta) => {
            // Obtener stock mínimo configurado
            const stockMinimo = await StockMinimoCamioneta.findAll({
                where: { camioneta_id: camioneta.id },
                include: [
                    {
                        model: TipoHerramientaRenta,
                        as: 'tipoHerramienta',
                        attributes: ['id', 'nombre', 'prefijo_codigo']
                    }
                ]
            });

            // Obtener inventario actual de la camioneta
            const inventarioActual = await UnidadHerramientaRenta.findAll({
                where: {
                    camioneta_id: camioneta.id,
                    activo: true,
                    ubicacion_actual: 'camioneta'
                },
                include: [
                    {
                        model: TipoHerramientaRenta,
                        as: 'tipoHerramienta',
                        attributes: ['id', 'nombre']
                    }
                ]
            });

            // Contar unidades por tipo
            const conteoActual = {};
            inventarioActual.forEach(unidad => {
                const tipoId = unidad.tipo_herramienta_id;
                conteoActual[tipoId] = (conteoActual[tipoId] || 0) + 1;
            });

            // Calcular faltantes
            const alertas = [];
            stockMinimo.forEach(config => {
                const tipoId = config.tipo_herramienta_id;
                const cantidadActual = conteoActual[tipoId] || 0;
                const cantidadMinima = config.cantidad_minima;

                if (cantidadActual < cantidadMinima) {
                    alertas.push({
                        tipo: config.tipoHerramienta?.nombre || 'Herramienta',
                        faltantes: cantidadMinima - cantidadActual,
                        actual: cantidadActual,
                        minimo: cantidadMinima
                    });
                }
            });

            return {
                ...camioneta.toJSON(),
                inventarioActual: inventarioActual.length,
                stockMinimoConfigurado: stockMinimo.length,
                alertas,
                stockCompleto: alertas.length === 0
            };
        }));

        // 4. Calcular estadísticas
        const stats = {
            totalHerramientas: herramientasAsignadas.length,
            totalCamionetas: camionetasConStock.length,
            alertasStock: camionetasConStock.reduce((acc, c) => acc + c.alertas.length, 0),
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
                    nombre: req.usuario.nombre,
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
