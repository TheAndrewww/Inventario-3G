import { sequelize } from '../config/database.js';
import { Movimiento, DetalleMovimiento, Articulo, Usuario, Categoria, Ubicacion } from '../models/index.js';
import { generarTicketID } from '../utils/ticket-generator.js';

/**
 * GET /api/movimientos
 * Obtener historial de movimientos con filtros
 */
export const getMovimientos = async (req, res) => {
    try {
        const {
            tipo,
            usuario_id,
            fecha_desde,
            fecha_hasta,
            estado,
            page = 1,
            limit = 50,
            order_by = 'fecha_hora',
            order_dir = 'DESC'
        } = req.query;

        // Construir filtros
        const where = {};

        if (tipo) {
            where.tipo = tipo;
        }

        if (usuario_id) {
            where.usuario_id = usuario_id;
        }

        if (estado) {
            where.estado = estado;
        }

        if (fecha_desde || fecha_hasta) {
            where.fecha_hora = {};
            if (fecha_desde) {
                where.fecha_hora.$gte = new Date(fecha_desde);
            }
            if (fecha_hasta) {
                where.fecha_hora.$lte = new Date(fecha_hasta);
            }
        }

        // Calcular offset para paginación
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Consultar movimientos
        const { count, rows: movimientos } = await Movimiento.findAndCountAll({
            where,
            include: [
                {
                    model: Usuario,
                    as: 'usuario',
                    attributes: ['id', 'nombre', 'email', 'rol']
                },
                {
                    model: Usuario,
                    as: 'supervisor',
                    attributes: ['id', 'nombre', 'email', 'rol']
                },
                {
                    model: DetalleMovimiento,
                    as: 'detalles',
                    include: [
                        {
                            model: Articulo,
                            as: 'articulo',
                            attributes: ['id', 'nombre', 'unidad'],
                            include: [
                                {
                                    model: Categoria,
                                    as: 'categoria',
                                    attributes: ['nombre', 'color']
                                }
                            ]
                        }
                    ]
                }
            ],
            order: [[order_by, order_dir.toUpperCase()]],
            limit: parseInt(limit),
            offset
        });

        res.status(200).json({
            success: true,
            data: {
                movimientos,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / parseInt(limit))
                }
            }
        });

    } catch (error) {
        console.error('Error en getMovimientos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener movimientos',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * GET /api/movimientos/:id
 * Obtener detalle de un movimiento específico
 */
export const getMovimientoById = async (req, res) => {
    try {
        const { id } = req.params;

        const movimiento = await Movimiento.findByPk(id, {
            include: [
                {
                    model: Usuario,
                    as: 'usuario',
                    attributes: ['id', 'nombre', 'email', 'rol', 'puesto']
                },
                {
                    model: Usuario,
                    as: 'supervisor',
                    attributes: ['id', 'nombre', 'email', 'rol', 'puesto']
                },
                {
                    model: DetalleMovimiento,
                    as: 'detalles',
                    include: [
                        {
                            model: Articulo,
                            as: 'articulo',
                            attributes: ['id', 'nombre', 'descripcion', 'unidad', 'costo_unitario'],
                            include: [
                                {
                                    model: Categoria,
                                    as: 'categoria',
                                    attributes: ['nombre', 'color', 'icono']
                                },
                                {
                                    model: Ubicacion,
                                    as: 'ubicacion',
                                    attributes: ['codigo', 'almacen']
                                }
                            ]
                        }
                    ]
                }
            ]
        });

        if (!movimiento) {
            return res.status(404).json({
                success: false,
                message: 'Movimiento no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            data: { movimiento }
        });

    } catch (error) {
        console.error('Error en getMovimientoById:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener movimiento',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * POST /api/movimientos
 * Crear un nuevo movimiento (retiro, devolución, ajuste)
 */
export const createMovimiento = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const {
            tipo,
            articulos,
            observaciones,
            supervisor_id,
            proyecto
        } = req.body;

        const usuario_id = req.usuario.id;

        // Validar campos requeridos
        if (!tipo || !articulos || !Array.isArray(articulos) || articulos.length === 0) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Campos requeridos: tipo, articulos (array no vacío)'
            });
        }

        // Validar tipo de movimiento
        const tiposPermitidos = ['retiro', 'devolucion', 'ajuste', 'entrada'];
        if (!tiposPermitidos.includes(tipo)) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Tipo inválido. Tipos permitidos: ${tiposPermitidos.join(', ')}`
            });
        }

        // Generar ticket ID único
        const ticketId = generarTicketID();

        // Crear movimiento
        const movimiento = await Movimiento.create({
            ticket_id: ticketId,
            tipo,
            fecha_hora: new Date(),
            usuario_id,
            supervisor_id: supervisor_id || null,
            proyecto: proyecto || null,
            estado: supervisor_id ? 'pendiente' : 'completado', // Si hay supervisor, queda pendiente
            observaciones
        }, { transaction });

        // Procesar cada artículo
        for (const item of articulos) {
            const { articulo_id, cantidad, observaciones: observacionesDetalle } = item;

            if (!articulo_id || !cantidad || cantidad <= 0) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Cada artículo debe tener articulo_id y cantidad válida'
                });
            }

            // Buscar artículo
            const articulo = await Articulo.findByPk(articulo_id, { transaction });

            if (!articulo) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: `Artículo con ID ${articulo_id} no encontrado`
                });
            }

            // Validar stock disponible para retiros
            if (tipo === 'retiro' && articulo.stock_actual < cantidad) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Stock insuficiente para ${articulo.nombre}. Disponible: ${articulo.stock_actual}, Solicitado: ${cantidad}`
                });
            }

            // Crear detalle del movimiento
            await DetalleMovimiento.create({
                movimiento_id: movimiento.id,
                articulo_id,
                cantidad,
                costo_unitario: articulo.costo_unitario,
                observaciones: observacionesDetalle
            }, { transaction });

            // Actualizar stock solo si el estado es 'completado'
            if (movimiento.estado === 'completado') {
                let nuevoStock = articulo.stock_actual;

                switch (tipo) {
                    case 'retiro':
                    case 'ajuste':
                        nuevoStock -= cantidad;
                        break;
                    case 'devolucion':
                    case 'entrada':
                        nuevoStock += cantidad;
                        break;
                }

                // Actualizar stock del artículo
                await articulo.update({ stock_actual: nuevoStock }, { transaction });
            }
        }

        // Commit de la transacción
        await transaction.commit();

        // Obtener movimiento completo con relaciones
        const movimientoCompleto = await Movimiento.findByPk(movimiento.id, {
            include: [
                {
                    model: Usuario,
                    as: 'usuario',
                    attributes: ['id', 'nombre', 'email', 'rol']
                },
                {
                    model: Usuario,
                    as: 'supervisor',
                    attributes: ['id', 'nombre', 'email', 'rol']
                },
                {
                    model: DetalleMovimiento,
                    as: 'detalles',
                    include: [
                        {
                            model: Articulo,
                            as: 'articulo',
                            attributes: ['id', 'nombre', 'unidad', 'stock_actual']
                        }
                    ]
                }
            ]
        });

        res.status(201).json({
            success: true,
            message: 'Movimiento creado exitosamente',
            data: { movimiento: movimientoCompleto }
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Error en createMovimiento:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear movimiento',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * PUT /api/movimientos/:id
 * Actualizar estado de un movimiento (aprobar/rechazar)
 */
export const updateMovimiento = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { id } = req.params;
        const { estado, observaciones } = req.body;
        const supervisor_id = req.usuario.id;

        // Validar estado
        const estadosPermitidos = ['aprobado', 'completado', 'cancelado'];
        if (!estadosPermitidos.includes(estado)) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Estado inválido. Estados permitidos: ${estadosPermitidos.join(', ')}`
            });
        }

        // Buscar movimiento
        const movimiento = await Movimiento.findByPk(id, {
            include: [
                {
                    model: DetalleMovimiento,
                    as: 'detalles',
                    include: [{ model: Articulo, as: 'articulo' }]
                }
            ],
            transaction
        });

        if (!movimiento) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: 'Movimiento no encontrado'
            });
        }

        // Si se está completando/aprobando, actualizar stock
        if (estado === 'completado' || estado === 'aprobado') {
            for (const detalle of movimiento.detalles) {
                const articulo = detalle.articulo;
                let nuevoStock = articulo.stock_actual;

                switch (movimiento.tipo) {
                    case 'retiro':
                    case 'ajuste':
                        nuevoStock -= detalle.cantidad;
                        break;
                    case 'devolucion':
                    case 'entrada':
                        nuevoStock += detalle.cantidad;
                        break;
                }

                // Validar que no quede stock negativo
                if (nuevoStock < 0) {
                    await transaction.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `Stock insuficiente para ${articulo.nombre}`
                    });
                }

                await articulo.update({ stock_actual: nuevoStock }, { transaction });
            }
        }

        // Actualizar movimiento
        await movimiento.update({
            estado,
            supervisor_id,
            observaciones: observaciones || movimiento.observaciones
        }, { transaction });

        await transaction.commit();

        // Obtener movimiento actualizado
        const movimientoActualizado = await Movimiento.findByPk(id, {
            include: [
                {
                    model: Usuario,
                    as: 'usuario',
                    attributes: ['id', 'nombre', 'email']
                },
                {
                    model: Usuario,
                    as: 'supervisor',
                    attributes: ['id', 'nombre', 'email']
                },
                {
                    model: DetalleMovimiento,
                    as: 'detalles',
                    include: [
                        {
                            model: Articulo,
                            as: 'articulo',
                            attributes: ['id', 'nombre', 'unidad', 'stock_actual']
                        }
                    ]
                }
            ]
        });

        res.status(200).json({
            success: true,
            message: 'Movimiento actualizado exitosamente',
            data: { movimiento: movimientoActualizado }
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Error en updateMovimiento:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar movimiento',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * GET /api/movimientos/usuario/:usuario_id
 * Obtener movimientos de un usuario específico
 */
export const getMovimientosByUsuario = async (req, res) => {
    try {
        const { usuario_id } = req.params;
        const { limit = 20 } = req.query;

        const movimientos = await Movimiento.findAll({
            where: { usuario_id },
            include: [
                {
                    model: Usuario,
                    as: 'usuario',
                    attributes: ['id', 'nombre']
                },
                {
                    model: DetalleMovimiento,
                    as: 'detalles',
                    include: [
                        {
                            model: Articulo,
                            as: 'articulo',
                            attributes: ['id', 'nombre', 'unidad']
                        }
                    ]
                }
            ],
            order: [['fecha_hora', 'DESC']],
            limit: parseInt(limit)
        });

        res.status(200).json({
            success: true,
            data: { movimientos }
        });

    } catch (error) {
        console.error('Error en getMovimientosByUsuario:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener movimientos del usuario',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    getMovimientos,
    getMovimientoById,
    createMovimiento,
    updateMovimiento,
    getMovimientosByUsuario
};
