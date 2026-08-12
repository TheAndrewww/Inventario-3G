import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';
import { Movimiento, DetalleMovimiento, Articulo, Usuario, Categoria, Ubicacion, Camioneta } from '../models/index.js';
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
                            attributes: ['id', 'nombre', 'unidad', 'descripcion', 'imagen_url'],
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
                            attributes: ['id', 'nombre', 'descripcion', 'unidad', 'costo_unitario', 'imagen_url'],
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
        const tiposPermitidos = ['retiro', 'devolucion', 'ajuste_entrada', 'ajuste_salida', 'transferencia'];
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
                let nuevoStock = parseFloat(articulo.stock_actual);

                switch (tipo) {
                    case 'retiro':
                    case 'ajuste_salida':
                        nuevoStock -= parseFloat(cantidad);
                        break;
                    case 'devolucion':
                    case 'ajuste_entrada':
                        nuevoStock += parseFloat(cantidad);
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

/**
 * POST /api/movimientos/rapido
 * Entrada o salida rápida hacia una camioneta o un área de planta.
 * No genera ticket para firmar ni pasa por aprobación: es un solo movimiento
 * con todos los artículos capturados, para que almacén no registre 1 a 1.
 *
 * Body: { operacion: 'entrada'|'salida', destino_tipo: 'camioneta'|'area',
 *         camioneta_id?, destino_area?, articulos: [{articulo_id, cantidad}], observaciones? }
 */
export const crearMovimientoRapido = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { operacion, destino_tipo, camioneta_id, destino_area, articulos, observaciones } = req.body;
        const usuario_id = req.usuario.id;

        if (!['entrada', 'salida'].includes(operacion)) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'La operación debe ser entrada o salida' });
        }

        if (!['camioneta', 'area'].includes(destino_tipo)) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'El destino debe ser camioneta o area' });
        }

        if (destino_tipo === 'camioneta' && !camioneta_id) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Falta indicar la camioneta' });
        }

        if (destino_tipo === 'area' && !destino_area) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Falta indicar el área' });
        }

        if (!Array.isArray(articulos) || articulos.length === 0) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Agrega al menos un artículo' });
        }

        // salida = sale del almacén, entrada = regresa al almacén
        const tipo = operacion === 'salida' ? 'retiro' : 'devolucion';

        let destinoNombre = destino_area;
        if (destino_tipo === 'camioneta') {
            const camioneta = await Camioneta.findByPk(camioneta_id, { transaction });
            if (!camioneta) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: 'La camioneta no existe' });
            }
            destinoNombre = camioneta.nombre;
        }

        const movimiento = await Movimiento.create({
            ticket_id: generarTicketID(),
            tipo,
            fecha_hora: new Date(),
            usuario_id,
            estado: 'completado',
            destino_tipo,
            destino_area: destino_tipo === 'area' ? destino_area : null,
            camioneta_id: destino_tipo === 'camioneta' ? camioneta_id : null,
            observaciones: observaciones || `${operacion === 'salida' ? 'Salida' : 'Entrada'} rápida · ${destinoNombre}`
        }, { transaction });

        let totalPiezas = 0;

        for (const item of articulos) {
            const cantidad = parseFloat(item.cantidad);

            if (!item.articulo_id || !cantidad || cantidad <= 0) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: 'Cada artículo necesita cantidad mayor a 0' });
            }

            const articulo = await Articulo.findByPk(item.articulo_id, { transaction });
            if (!articulo) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: `Artículo ${item.articulo_id} no encontrado` });
            }

            const stockActual = parseFloat(articulo.stock_actual);
            if (operacion === 'salida' && stockActual < cantidad) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Stock insuficiente de ${articulo.nombre}. Disponible: ${stockActual} ${articulo.unidad}`
                });
            }

            await DetalleMovimiento.create({
                movimiento_id: movimiento.id,
                articulo_id: articulo.id,
                cantidad,
                costo_unitario: articulo.costo_unitario,
                observaciones: item.observaciones || null
            }, { transaction });

            const nuevoStock = operacion === 'salida' ? stockActual - cantidad : stockActual + cantidad;
            await articulo.update({ stock_actual: nuevoStock }, { transaction });

            totalPiezas += cantidad;
        }

        await movimiento.update({ total_piezas: Math.round(totalPiezas) }, { transaction });
        await transaction.commit();

        res.status(201).json({
            success: true,
            message: `${operacion === 'salida' ? 'Salida' : 'Entrada'} registrada: ${articulos.length} artículo(s) · ${destinoNombre}`,
            data: {
                movimiento: {
                    id: movimiento.id,
                    ticket_id: movimiento.ticket_id,
                    tipo,
                    destino: destinoNombre,
                    articulos: articulos.length
                }
            }
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Error en crearMovimientoRapido:', error);
        res.status(500).json({
            success: false,
            message: 'Error al registrar el movimiento',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * GET /api/movimientos/consolidado?desde=&hasta=
 * Corte por destino de los movimientos rápidos: qué se llevó y qué regresó
 * cada camioneta/área en el periodo, como si fuera un pedido consolidado.
 */
export const getConsolidadoDestinos = async (req, res) => {
    try {
        const { desde, hasta } = req.query;

        const hoy = new Date();
        const fechaDesde = desde ? new Date(desde) : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const fechaHasta = hasta ? new Date(hasta) : hoy;
        fechaHasta.setHours(23, 59, 59, 999);

        const movimientos = await Movimiento.findAll({
            where: {
                destino_tipo: { [Op.ne]: null },
                estado: 'completado',
                fecha_hora: { [Op.between]: [fechaDesde, fechaHasta] }
            },
            include: [
                { model: Usuario, as: 'usuario', attributes: ['id', 'nombre'], required: false },
                { model: Camioneta, as: 'camioneta', attributes: ['id', 'nombre'], required: false },
                {
                    model: DetalleMovimiento,
                    as: 'detalles',
                    include: [{ model: Articulo, as: 'articulo', attributes: ['id', 'nombre', 'unidad', 'costo_unitario'] }]
                }
            ],
            order: [['fecha_hora', 'ASC']]
        });

        const destinos = new Map();

        for (const mov of movimientos) {
            const esSalida = mov.tipo === 'retiro';
            const clave = mov.destino_tipo === 'camioneta'
                ? `camioneta:${mov.camioneta_id}`
                : `area:${mov.destino_area}`;
            const nombre = mov.destino_tipo === 'camioneta'
                ? (mov.camioneta?.nombre || `Camioneta ${mov.camioneta_id}`)
                : mov.destino_area;

            if (!destinos.has(clave)) {
                destinos.set(clave, {
                    clave,
                    destino_tipo: mov.destino_tipo,
                    destino: nombre,
                    movimientos: 0,
                    articulos: new Map()
                });
            }

            const grupo = destinos.get(clave);
            grupo.movimientos += 1;

            for (const det of mov.detalles || []) {
                const artId = det.articulo_id;
                if (!grupo.articulos.has(artId)) {
                    grupo.articulos.set(artId, {
                        articulo_id: artId,
                        nombre: det.articulo?.nombre || `Artículo ${artId}`,
                        unidad: det.articulo?.unidad || '',
                        costo_unitario: parseFloat(det.articulo?.costo_unitario) || 0,
                        salidas: 0,
                        entradas: 0
                    });
                }
                const fila = grupo.articulos.get(artId);
                const cantidad = parseFloat(det.cantidad) || 0;
                if (esSalida) fila.salidas += cantidad;
                else fila.entradas += cantidad;
            }
        }

        const resultado = Array.from(destinos.values()).map(g => {
            const articulos = Array.from(g.articulos.values())
                .map(a => {
                    const neto = a.salidas - a.entradas;
                    return {
                        ...a,
                        salidas: parseFloat(a.salidas.toFixed(2)),
                        entradas: parseFloat(a.entradas.toFixed(2)),
                        neto: parseFloat(neto.toFixed(2)),
                        valor_neto: parseFloat((neto * a.costo_unitario).toFixed(2))
                    };
                })
                .sort((a, b) => b.neto - a.neto);

            return {
                clave: g.clave,
                destino_tipo: g.destino_tipo,
                destino: g.destino,
                movimientos: g.movimientos,
                total_articulos: articulos.length,
                valor_neto: parseFloat(articulos.reduce((s, a) => s + a.valor_neto, 0).toFixed(2)),
                articulos
            };
        }).sort((a, b) => b.valor_neto - a.valor_neto);

        res.json({
            success: true,
            data: {
                periodo: { desde: fechaDesde.toISOString(), hasta: fechaHasta.toISOString() },
                destinos: resultado
            }
        });

    } catch (error) {
        console.error('Error en getConsolidadoDestinos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al generar el consolidado',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    getMovimientos,
    getMovimientoById,
    createMovimiento,
    updateMovimiento,
    getMovimientosByUsuario,
    crearMovimientoRapido,
    getConsolidadoDestinos
};
