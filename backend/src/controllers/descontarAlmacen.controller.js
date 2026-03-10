import { Articulo, Ubicacion, Movimiento, DetalleMovimiento, Almacen } from '../models/index.js';
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';
import { generarTicketID } from '../utils/ticket-generator.js';

// Obtener lista de almacenes disponibles
export const getAlmacenes = async (req, res) => {
    try {
        const almacenes = await Almacen.findAll({
            where: { activo: true },
            attributes: ['id', 'nombre'],
            order: [['nombre', 'ASC']]
        });

        // Agregar conteo de artículos por almacén
        const almacenesConConteo = await Promise.all(almacenes.map(async (alm) => {
            const ubicacionIds = (await Ubicacion.findAll({
                where: { almacen_id: alm.id, activo: true },
                attributes: ['id']
            })).map(u => u.id);

            const total_articulos = ubicacionIds.length > 0
                ? await Articulo.count({
                    where: { ubicacion_id: { [Op.in]: ubicacionIds }, activo: true }
                })
                : 0;

            return {
                almacen: alm.nombre,
                almacen_id: alm.id,
                total_articulos
            };
        }));

        // Filtrar solo los que tienen artículos
        const almacenesFiltrados = almacenesConConteo.filter(a => a.total_articulos > 0);

        res.json({
            success: true,
            data: almacenesFiltrados
        });
    } catch (error) {
        console.error('Error obteniendo almacenes:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener almacenes',
            error: error.message
        });
    }
};

// Obtener artículos de un almacén específico
export const getArticulosPorAlmacen = async (req, res) => {
    try {
        const { almacen } = req.params;
        const { search } = req.query;

        // Obtener IDs de ubicaciones de este almacén
        const ubicaciones = await Ubicacion.findAll({
            where: { almacen: decodeURIComponent(almacen), activo: true },
            attributes: ['id']
        });

        const ubicacionIds = ubicaciones.map(u => u.id);

        if (ubicacionIds.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const where = {
            activo: true,
            ubicacion_id: { [Op.in]: ubicacionIds },
            stock_actual: { [Op.gt]: 0 }
        };

        if (search && search.trim()) {
            where[Op.or] = [
                { nombre: { [Op.iLike]: `%${search}%` } },
                { codigo_ean13: { [Op.iLike]: `%${search}%` } },
                { sku: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const articulos = await Articulo.findAll({
            where,
            include: [
                { model: Ubicacion, as: 'ubicacion', attributes: ['id', 'codigo', 'almacen'] }
            ],
            attributes: ['id', 'codigo_ean13', 'nombre', 'stock_actual', 'unidad', 'imagen_url'],
            order: [['nombre', 'ASC']],
            limit: 100
        });

        res.json({
            success: true,
            data: articulos
        });
    } catch (error) {
        console.error('Error obteniendo artículos por almacén:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener artículos',
            error: error.message
        });
    }
};

// Descontar stock de un artículo (crear movimiento de retiro)
export const descontarArticulo = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { articulo_id, cantidad, observaciones } = req.body;
        const usuario_id = req.usuario.id;

        if (!articulo_id || !cantidad || cantidad <= 0) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Se requiere articulo_id y una cantidad mayor a 0'
            });
        }

        const articulo = await Articulo.findByPk(articulo_id, { transaction });

        if (!articulo || !articulo.activo) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: 'Artículo no encontrado'
            });
        }

        const cantidadDescontar = parseFloat(cantidad);
        const stockActual = parseFloat(articulo.stock_actual);

        if (stockActual < cantidadDescontar) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Stock insuficiente. Disponible: ${stockActual} ${articulo.unidad}`
            });
        }

        // Crear movimiento de retiro
        const ticketId = generarTicketID();
        const movimiento = await Movimiento.create({
            ticket_id: ticketId,
            tipo: 'retiro',
            fecha_hora: new Date(),
            usuario_id,
            estado: 'completado',
            observaciones: observaciones || 'Descuento desde panel de almacén',
            total_piezas: cantidadDescontar
        }, { transaction });

        // Crear detalle
        await DetalleMovimiento.create({
            movimiento_id: movimiento.id,
            articulo_id: parseInt(articulo_id),
            cantidad: cantidadDescontar,
            costo_unitario: articulo.costo_unitario || 0,
            observaciones: observaciones || null
        }, { transaction });

        // Descontar stock
        const nuevoStock = stockActual - cantidadDescontar;
        await articulo.update({ stock_actual: nuevoStock }, { transaction });

        await transaction.commit();

        res.json({
            success: true,
            message: `Se descontaron ${cantidadDescontar} ${articulo.unidad} de ${articulo.nombre}`,
            data: {
                articulo_id: articulo.id,
                nombre: articulo.nombre,
                stock_anterior: stockActual,
                cantidad_descontada: cantidadDescontar,
                stock_nuevo: nuevoStock,
                ticket_id: ticketId
            }
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error descontando artículo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al descontar artículo',
            error: error.message
        });
    }
};

export default {
    getAlmacenes,
    getArticulosPorAlmacen,
    descontarArticulo
};
