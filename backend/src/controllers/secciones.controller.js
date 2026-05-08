import { Seccion, Almacen, Articulo } from '../models/index.js';

const ALMACEN_PERMITIDO = 'Herramientas';

/**
 * Verifica que el almacén exista y se llame "Herramientas".
 * Devuelve null si todo OK, o un objeto con error y mensaje si falla.
 */
const validarAlmacenHerramientas = async (almacen_id) => {
    if (!almacen_id) {
        return { error: true, status: 400, message: 'almacen_id es obligatorio' };
    }
    const almacen = await Almacen.findByPk(almacen_id);
    if (!almacen) {
        return { error: true, status: 404, message: 'Almacén no encontrado' };
    }
    if (almacen.nombre !== ALMACEN_PERMITIDO) {
        return {
            error: true,
            status: 400,
            message: `Las secciones solo están disponibles para el almacén "${ALMACEN_PERMITIDO}"`
        };
    }
    return null;
};

/**
 * GET /api/secciones?almacen_id=...
 */
export const getSecciones = async (req, res) => {
    try {
        const { almacen_id } = req.query;
        const where = {};
        if (almacen_id) where.almacen_id = almacen_id;

        const secciones = await Seccion.findAll({
            where,
            order: [['nombre', 'ASC']]
        });

        res.status(200).json({
            success: true,
            data: { secciones }
        });
    } catch (error) {
        console.error('Error en getSecciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener secciones',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * POST /api/secciones
 */
export const crearSeccion = async (req, res) => {
    try {
        const { nombre, descripcion, almacen_id } = req.body;

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ success: false, message: 'El nombre de la sección es obligatorio' });
        }

        const valid = await validarAlmacenHerramientas(almacen_id);
        if (valid) return res.status(valid.status).json({ success: false, message: valid.message });

        const existente = await Seccion.findOne({ where: { nombre: nombre.trim(), almacen_id } });
        if (existente) {
            return res.status(400).json({ success: false, message: 'Ya existe una sección con ese nombre en este almacén' });
        }

        const nueva = await Seccion.create({
            nombre: nombre.trim(),
            descripcion: descripcion ? descripcion.trim() : null,
            almacen_id
        });

        res.status(201).json({ success: true, message: 'Sección creada exitosamente', data: nueva });
    } catch (error) {
        console.error('Error en crearSeccion:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear sección',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * PUT /api/secciones/:id
 */
export const actualizarSeccion = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion } = req.body;

        const seccion = await Seccion.findByPk(id);
        if (!seccion) {
            return res.status(404).json({ success: false, message: 'Sección no encontrada' });
        }

        if (nombre !== undefined) {
            if (!nombre.trim()) {
                return res.status(400).json({ success: false, message: 'El nombre no puede estar vacío' });
            }
            const existente = await Seccion.findOne({
                where: { nombre: nombre.trim(), almacen_id: seccion.almacen_id }
            });
            if (existente && existente.id !== parseInt(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe otra sección con ese nombre en este almacén'
                });
            }
        }

        await seccion.update({
            nombre: nombre ? nombre.trim() : seccion.nombre,
            descripcion: descripcion !== undefined ? (descripcion ? descripcion.trim() : null) : seccion.descripcion
        });

        res.status(200).json({ success: true, message: 'Sección actualizada exitosamente', data: { seccion } });
    } catch (error) {
        console.error('Error en actualizarSeccion:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar sección',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * DELETE /api/secciones/:id
 * Si hay artículos asociados y no se fuerza, retorna requiresConfirmation.
 * Con force=true, los artículos quedan con seccion_id NULL (FK ON DELETE SET NULL).
 */
export const eliminarSeccion = async (req, res) => {
    try {
        const { id } = req.params;
        const { force } = req.query;

        const seccion = await Seccion.findByPk(id);
        if (!seccion) {
            return res.status(404).json({ success: false, message: 'Sección no encontrada' });
        }

        const articulosAsociados = await Articulo.count({ where: { seccion_id: id } });

        if (articulosAsociados > 0 && force !== 'true') {
            return res.status(400).json({
                success: false,
                requiresConfirmation: true,
                articlesCount: articulosAsociados,
                message: `Esta sección tiene ${articulosAsociados} artículo(s) asociado(s). Si la eliminas, esos artículos quedarán sin sección.`
            });
        }

        if (articulosAsociados > 0 && force === 'true') {
            await Articulo.update({ seccion_id: null }, { where: { seccion_id: id } });
        }

        await seccion.destroy();

        res.status(200).json({
            success: true,
            message: `Sección eliminada exitosamente${articulosAsociados > 0 ? `. ${articulosAsociados} artículo(s) quedaron sin sección` : ''}`
        });
    } catch (error) {
        console.error('Error en eliminarSeccion:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar sección',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    getSecciones,
    crearSeccion,
    actualizarSeccion,
    eliminarSeccion
};
