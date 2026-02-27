import { Articulo, Ubicacion } from '../models/index.js';
import RolloMembrana from '../models/RolloMembrana.js';
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';

// Obtener artículos del almacén de Membranas con resumen de rollos
export const getArticulosMembrana = async (req, res) => {
    try {
        const { search } = req.query;

        // Obtener IDs de ubicaciones del almacén "Membranas"
        const ubicaciones = await Ubicacion.findAll({
            where: { almacen: 'Membranas', activo: true },
            attributes: ['id']
        });

        const ubicacionIds = ubicaciones.map(u => u.id);

        if (ubicacionIds.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const where = {
            activo: true,
            ubicacion_id: { [Op.in]: ubicacionIds }
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
            order: [['nombre', 'ASC']]
        });

        // Para cada artículo, obtener resumen de rollos
        const articulosConRollos = await Promise.all(articulos.map(async (art) => {
            const rollosStats = await RolloMembrana.findAll({
                where: { articulo_id: art.id, activo: true },
                attributes: [
                    [sequelize.fn('COUNT', sequelize.col('id')), 'total_rollos'],
                    [sequelize.fn('SUM', sequelize.col('metraje_restante')), 'metraje_total_disponible'],
                    [sequelize.fn('COUNT', sequelize.literal("CASE WHEN estado = 'disponible' THEN 1 END")), 'rollos_disponibles'],
                    [sequelize.fn('COUNT', sequelize.literal("CASE WHEN estado = 'en_uso' THEN 1 END")), 'rollos_en_uso'],
                    [sequelize.fn('COUNT', sequelize.literal("CASE WHEN estado = 'agotado' THEN 1 END")), 'rollos_agotados']
                ],
                raw: true
            });

            const stats = rollosStats[0] || {};

            return {
                ...art.toJSON(),
                rollos_stats: {
                    total_rollos: parseInt(stats.total_rollos) || 0,
                    metraje_total_disponible: parseFloat(stats.metraje_total_disponible) || 0,
                    rollos_disponibles: parseInt(stats.rollos_disponibles) || 0,
                    rollos_en_uso: parseInt(stats.rollos_en_uso) || 0,
                    rollos_agotados: parseInt(stats.rollos_agotados) || 0
                }
            };
        }));

        res.json({ success: true, data: articulosConRollos });
    } catch (error) {
        console.error('Error obteniendo artículos de membrana:', error);
        res.status(500).json({ success: false, message: 'Error al obtener artículos', error: error.message });
    }
};

// Obtener rollos de un artículo específico
export const getRollosByArticulo = async (req, res) => {
    try {
        const { articuloId } = req.params;
        const { estado } = req.query;

        const where = { articulo_id: articuloId, activo: true };
        if (estado) {
            where.estado = estado;
        }

        const rollos = await RolloMembrana.findAll({
            where,
            order: [['estado', 'ASC'], ['identificador', 'ASC']]
        });

        // También obtener info del artículo
        const articulo = await Articulo.findByPk(articuloId, {
            attributes: ['id', 'nombre', 'codigo_ean13', 'imagen_url', 'stock_actual', 'unidad']
        });

        res.json({
            success: true,
            data: {
                articulo,
                rollos
            }
        });
    } catch (error) {
        console.error('Error obteniendo rollos:', error);
        res.status(500).json({ success: false, message: 'Error al obtener rollos', error: error.message });
    }
};

// Crear un nuevo rollo
export const crearRollo = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { articuloId } = req.params;
        const { identificador, metraje_total, color, observaciones, fecha_ingreso } = req.body;

        if (!identificador || !metraje_total || metraje_total <= 0) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Se requiere un identificador y un metraje mayor a 0'
            });
        }

        // Verificar que el artículo existe
        const articulo = await Articulo.findByPk(articuloId, { transaction });
        if (!articulo || !articulo.activo) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Artículo no encontrado' });
        }

        // Verificar identificador único
        const existente = await RolloMembrana.findOne({
            where: { identificador },
            transaction
        });
        if (existente) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Ya existe un rollo con el identificador "${identificador}"`
            });
        }

        const rollo = await RolloMembrana.create({
            articulo_id: parseInt(articuloId),
            identificador: identificador.trim(),
            metraje_total: parseFloat(metraje_total),
            metraje_restante: parseFloat(metraje_total),
            color: color?.trim() || null,
            estado: 'disponible',
            fecha_ingreso: fecha_ingreso || new Date(),
            observaciones: observaciones?.trim() || null
        }, { transaction });

        await transaction.commit();

        res.status(201).json({
            success: true,
            message: `Rollo "${identificador}" creado con ${metraje_total} metros`,
            data: rollo
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error creando rollo:', error);
        res.status(500).json({ success: false, message: 'Error al crear rollo', error: error.message });
    }
};

// Editar un rollo
export const editarRollo = async (req, res) => {
    try {
        const { rolloId } = req.params;
        const { identificador, metraje_total, metraje_restante, color, estado, observaciones } = req.body;

        const rollo = await RolloMembrana.findByPk(rolloId);
        if (!rollo || !rollo.activo) {
            return res.status(404).json({ success: false, message: 'Rollo no encontrado' });
        }

        // Si se cambia identificador, verificar unicidad
        if (identificador && identificador !== rollo.identificador) {
            const existente = await RolloMembrana.findOne({
                where: { identificador, id: { [Op.ne]: rolloId } }
            });
            if (existente) {
                return res.status(400).json({
                    success: false,
                    message: `Ya existe un rollo con el identificador "${identificador}"`
                });
            }
        }

        const updates = {};
        if (identificador !== undefined) updates.identificador = identificador.trim();
        if (metraje_total !== undefined) updates.metraje_total = parseFloat(metraje_total);
        if (metraje_restante !== undefined) updates.metraje_restante = parseFloat(metraje_restante);
        if (color !== undefined) updates.color = color?.trim() || null;
        if (estado !== undefined) updates.estado = estado;
        if (observaciones !== undefined) updates.observaciones = observaciones?.trim() || null;

        // Auto-detectar estado según metraje
        if (updates.metraje_restante !== undefined) {
            if (updates.metraje_restante <= 0) {
                updates.estado = 'agotado';
                updates.metraje_restante = 0;
            }
        }

        await rollo.update(updates);

        res.json({
            success: true,
            message: 'Rollo actualizado',
            data: rollo
        });
    } catch (error) {
        console.error('Error editando rollo:', error);
        res.status(500).json({ success: false, message: 'Error al editar rollo', error: error.message });
    }
};

// Desactivar un rollo (soft delete)
export const desactivarRollo = async (req, res) => {
    try {
        const { rolloId } = req.params;

        const rollo = await RolloMembrana.findByPk(rolloId);
        if (!rollo) {
            return res.status(404).json({ success: false, message: 'Rollo no encontrado' });
        }

        await rollo.update({ activo: false });

        res.json({
            success: true,
            message: `Rollo "${rollo.identificador}" eliminado`
        });
    } catch (error) {
        console.error('Error desactivando rollo:', error);
        res.status(500).json({ success: false, message: 'Error al eliminar rollo', error: error.message });
    }
};

// Descontar metraje de un rollo
export const descontarMetraje = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { rolloId } = req.params;
        const { cantidad, observaciones } = req.body;

        if (!cantidad || cantidad <= 0) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Se requiere una cantidad mayor a 0'
            });
        }

        const rollo = await RolloMembrana.findByPk(rolloId, { transaction });
        if (!rollo || !rollo.activo) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Rollo no encontrado' });
        }

        if (rollo.estado === 'agotado') {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Este rollo ya está agotado'
            });
        }

        const cantidadDescontar = parseFloat(cantidad);
        const metrajePrevio = parseFloat(rollo.metraje_restante);

        if (metrajePrevio < cantidadDescontar) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Metraje insuficiente. Disponible: ${metrajePrevio} metros`
            });
        }

        const nuevoMetraje = metrajePrevio - cantidadDescontar;
        const nuevoEstado = nuevoMetraje <= 0 ? 'agotado' : 'en_uso';

        await rollo.update({
            metraje_restante: Math.max(0, nuevoMetraje),
            estado: nuevoEstado,
            observaciones: observaciones
                ? `${rollo.observaciones ? rollo.observaciones + '\n' : ''}[${new Date().toLocaleDateString('es-MX')}] Descuento: ${cantidadDescontar}m - ${observaciones}`
                : rollo.observaciones
        }, { transaction });

        await transaction.commit();

        res.json({
            success: true,
            message: `Se descontaron ${cantidadDescontar} metros del rollo "${rollo.identificador}"`,
            data: {
                rollo_id: rollo.id,
                identificador: rollo.identificador,
                metraje_anterior: metrajePrevio,
                cantidad_descontada: cantidadDescontar,
                metraje_nuevo: Math.max(0, nuevoMetraje),
                estado: nuevoEstado
            }
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error descontando metraje:', error);
        res.status(500).json({ success: false, message: 'Error al descontar metraje', error: error.message });
    }
};

export default {
    getArticulosMembrana,
    getRollosByArticulo,
    crearRollo,
    editarRollo,
    desactivarRollo,
    descontarMetraje
};
