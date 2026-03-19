import { Op } from 'sequelize';
import { ChecklistItem, ChecklistItemArticulo, ChecklistEquipo, Articulo, Equipo, Categoria, sequelize } from '../models/index.js';

// ─── Importar ítems desde JSON (parseado del Excel en frontend) ───
export const importarItems = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { items } = req.body;
        // items: [{ nombre, especificacion, seccion, tipo, cantidad_requerida }]

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'No se proporcionaron ítems para importar' });
        }

        const creados = [];
        for (const item of items) {
            const [registro, wasCreated] = await ChecklistItem.findOrCreate({
                where: {
                    nombre: item.nombre,
                    especificacion: item.especificacion || null
                },
                defaults: {
                    seccion: item.seccion || null,
                    tipo: item.tipo || 'herramienta',
                    cantidad_requerida: item.cantidad_requerida || 1,
                    activo: true
                },
                transaction: t
            });

            if (!wasCreated) {
                // Actualizar si ya existe
                await registro.update({
                    seccion: item.seccion || registro.seccion,
                    tipo: item.tipo || registro.tipo,
                    cantidad_requerida: item.cantidad_requerida || registro.cantidad_requerida
                }, { transaction: t });
            }

            creados.push(registro);
        }

        await t.commit();
        res.json({
            success: true,
            message: `${creados.length} ítems importados correctamente`,
            data: { items: creados }
        });
    } catch (error) {
        await t.rollback();
        console.error('Error al importar ítems de checklist:', error);
        res.status(500).json({ success: false, message: 'Error al importar ítems' });
    }
};

// ─── Listar todos los ítems ───
export const listarItems = async (req, res) => {
    try {
        const items = await ChecklistItem.findAll({
            where: { activo: true },
            include: [
                {
                    model: ChecklistItemArticulo,
                    as: 'articulosVinculados',
                    include: [{
                        model: Articulo,
                        as: 'articulo',
                        attributes: ['id', 'nombre', 'codigo_ean13', 'imagen_url', 'stock_actual']
                    }]
                }
            ],
            order: [['seccion', 'ASC'], ['nombre', 'ASC']]
        });

        res.json({ success: true, data: { items } });
    } catch (error) {
        console.error('Error al listar ítems de checklist:', error);
        res.status(500).json({ success: false, message: 'Error al listar ítems' });
    }
};

// ─── Editar ítem ───
export const editarItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, especificacion, seccion, tipo, cantidad_requerida } = req.body;

        const item = await ChecklistItem.findByPk(id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Ítem no encontrado' });
        }

        await item.update({
            nombre: nombre || item.nombre,
            especificacion: especificacion !== undefined ? especificacion : item.especificacion,
            seccion: seccion !== undefined ? seccion : item.seccion,
            tipo: tipo || item.tipo,
            cantidad_requerida: cantidad_requerida || item.cantidad_requerida
        });

        res.json({ success: true, data: { item } });
    } catch (error) {
        console.error('Error al editar ítem:', error);
        res.status(500).json({ success: false, message: 'Error al editar ítem' });
    }
};

// ─── Eliminar ítem (soft delete) ───
export const eliminarItem = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await ChecklistItem.findByPk(id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Ítem no encontrado' });
        }

        await item.update({ activo: false });
        res.json({ success: true, message: 'Ítem eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar ítem:', error);
        res.status(500).json({ success: false, message: 'Error al eliminar ítem' });
    }
};

// ─── Enlazar artículos a un ítem ───
export const enlazarArticulos = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { articulo_ids } = req.body;
        // articulo_ids: [1, 2, 3] — IDs de artículos que satisfacen este ítem

        const item = await ChecklistItem.findByPk(id);
        if (!item) {
            await t.rollback();
            return res.status(404).json({ success: false, message: 'Ítem no encontrado' });
        }

        // Eliminar enlaces previos y crear nuevos
        await ChecklistItemArticulo.destroy({ where: { checklist_item_id: id }, transaction: t });

        if (articulo_ids && articulo_ids.length > 0) {
            const enlaces = articulo_ids.map(articuloId => ({
                checklist_item_id: id,
                articulo_id: articuloId
            }));
            await ChecklistItemArticulo.bulkCreate(enlaces, { transaction: t });
        }

        await t.commit();

        // Refetch con artículos
        const itemActualizado = await ChecklistItem.findByPk(id, {
            include: [{
                model: ChecklistItemArticulo,
                as: 'articulosVinculados',
                include: [{
                    model: Articulo,
                    as: 'articulo',
                    attributes: ['id', 'nombre', 'codigo_ean13', 'imagen_url', 'stock_actual']
                }]
            }]
        });

        res.json({ success: true, data: { item: itemActualizado } });
    } catch (error) {
        await t.rollback();
        console.error('Error al enlazar artículos:', error);
        res.status(500).json({ success: false, message: 'Error al enlazar artículos' });
    }
};

// ─── Sugerencias de artículos por nombre ───
export const sugerirArticulos = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await ChecklistItem.findByPk(id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Ítem no encontrado' });
        }

        // Buscar artículos cuyo nombre contenga palabras del ítem
        const palabras = item.nombre.split(/\s+/).filter(p => p.length > 2);
        const condiciones = palabras.map(p => ({
            nombre: { [Op.iLike]: `%${p}%` }
        }));

        const articulos = await Articulo.findAll({
            where: {
                activo: true,
                [Op.or]: condiciones.length > 0 ? condiciones : [{ nombre: { [Op.iLike]: `%${item.nombre}%` } }]
            },
            attributes: ['id', 'nombre', 'codigo_ean13', 'imagen_url', 'stock_actual', 'categoria_id'],
            include: [{
                model: Categoria,
                as: 'categoria',
                attributes: ['id', 'nombre']
            }],
            limit: 20,
            order: [['nombre', 'ASC']]
        });

        // También obtener los ya enlazados
        const enlazados = await ChecklistItemArticulo.findAll({
            where: { checklist_item_id: id },
            attributes: ['articulo_id']
        });
        const idsEnlazados = enlazados.map(e => e.articulo_id);

        res.json({
            success: true,
            data: {
                item,
                sugerencias: articulos,
                enlazados: idsEnlazados
            }
        });
    } catch (error) {
        console.error('Error al sugerir artículos:', error);
        res.status(500).json({ success: false, message: 'Error al buscar sugerencias' });
    }
};

// ─── Buscar artículos manualmente ───
export const buscarArticulos = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json({ success: true, data: { articulos: [] } });
        }

        const articulos = await Articulo.findAll({
            where: {
                activo: true,
                nombre: { [Op.iLike]: `%${q}%` }
            },
            attributes: ['id', 'nombre', 'codigo_ean13', 'imagen_url', 'stock_actual', 'categoria_id'],
            include: [{
                model: Categoria,
                as: 'categoria',
                attributes: ['id', 'nombre']
            }],
            limit: 20,
            order: [['nombre', 'ASC']]
        });

        res.json({ success: true, data: { articulos } });
    } catch (error) {
        console.error('Error al buscar artículos:', error);
        res.status(500).json({ success: false, message: 'Error al buscar artículos' });
    }
};

// ─── Obtener checklist de un equipo ───
export const obtenerChecklistEquipo = async (req, res) => {
    try {
        const { equipoId } = req.params;

        const equipo = await Equipo.findByPk(equipoId);
        if (!equipo) {
            return res.status(404).json({ success: false, message: 'Equipo no encontrado' });
        }

        const checklist = await ChecklistEquipo.findAll({
            where: { equipo_id: equipoId },
            include: [{
                model: ChecklistItem,
                as: 'checklistItem',
                where: { activo: true },
                include: [{
                    model: ChecklistItemArticulo,
                    as: 'articulosVinculados',
                    include: [{
                        model: Articulo,
                        as: 'articulo',
                        attributes: ['id', 'nombre', 'codigo_ean13', 'imagen_url', 'stock_actual']
                    }]
                }]
            }],
            order: [[{ model: ChecklistItem, as: 'checklistItem' }, 'seccion', 'ASC'], [{ model: ChecklistItem, as: 'checklistItem' }, 'nombre', 'ASC']]
        });

        res.json({ success: true, data: { equipo, checklist } });
    } catch (error) {
        console.error('Error al obtener checklist del equipo:', error);
        res.status(500).json({ success: false, message: 'Error al obtener checklist' });
    }
};

// ─── Asignar ítems a un equipo ───
export const asignarItemsAEquipo = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { equipoId } = req.params;
        const { items } = req.body;
        // items: [{ checklist_item_id, cantidad_requerida, notas }]

        const equipo = await Equipo.findByPk(equipoId);
        if (!equipo) {
            await t.rollback();
            return res.status(404).json({ success: false, message: 'Equipo no encontrado' });
        }

        const asignados = [];
        for (const item of items) {
            const [registro, wasCreated] = await ChecklistEquipo.findOrCreate({
                where: {
                    equipo_id: equipoId,
                    checklist_item_id: item.checklist_item_id
                },
                defaults: {
                    cantidad_requerida: item.cantidad_requerida || 1,
                    notas: item.notas || null
                },
                transaction: t
            });

            if (!wasCreated) {
                await registro.update({
                    cantidad_requerida: item.cantidad_requerida || registro.cantidad_requerida,
                    notas: item.notas !== undefined ? item.notas : registro.notas
                }, { transaction: t });
            }

            asignados.push(registro);
        }

        await t.commit();
        res.json({
            success: true,
            message: `${asignados.length} ítems asignados al equipo`,
            data: { asignados }
        });
    } catch (error) {
        await t.rollback();
        console.error('Error al asignar ítems al equipo:', error);
        res.status(500).json({ success: false, message: 'Error al asignar ítems' });
    }
};

// ─── Quitar ítem de un equipo ───
export const quitarItemDeEquipo = async (req, res) => {
    try {
        const { equipoId, itemId } = req.params;

        const deleted = await ChecklistEquipo.destroy({
            where: { equipo_id: equipoId, checklist_item_id: itemId }
        });

        if (deleted === 0) {
            return res.status(404).json({ success: false, message: 'Asignación no encontrada' });
        }

        res.json({ success: true, message: 'Ítem removido del equipo' });
    } catch (error) {
        console.error('Error al quitar ítem del equipo:', error);
        res.status(500).json({ success: false, message: 'Error al quitar ítem' });
    }
};
