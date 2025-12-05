import Proveedor from '../models/Proveedor.js';
import Articulo from '../models/Articulo.js';
import { Op } from 'sequelize';

/**
 * Listar todos los proveedores
 */
export const listarProveedores = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            busqueda = '',
            activo = null,
            orderBy = 'nombre',
            orderDir = 'ASC'
        } = req.query;

        const offset = (page - 1) * limit;

        // Construir filtros
        const where = {};

        if (busqueda) {
            where[Op.or] = [
                { nombre: { [Op.iLike]: `%${busqueda}%` } },
                { rfc: { [Op.iLike]: `%${busqueda}%` } },
                { contacto: { [Op.iLike]: `%${busqueda}%` } }
            ];
        }

        if (activo !== null) {
            where.activo = activo === 'true';
        }

        // Consultar proveedores
        const { rows: proveedores, count: total } = await Proveedor.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [[orderBy, orderDir.toUpperCase()]],
            attributes: { exclude: ['createdAt', 'updatedAt'] }
        });

        res.json({
            success: true,
            message: 'Proveedores obtenidos correctamente',
            data: {
                proveedores,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Error al listar proveedores:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener proveedores',
            error: error.message
        });
    }
};

/**
 * Obtener un proveedor por ID
 */
export const obtenerProveedor = async (req, res) => {
    try {
        const { id } = req.params;

        const proveedor = await Proveedor.findByPk(id, {
            include: [
                {
                    model: Articulo,
                    as: 'articulos',
                    attributes: ['id', 'nombre', 'codigo_ean13', 'stock_actual', 'activo'],
                    where: { activo: true },
                    required: false
                }
            ]
        });

        if (!proveedor) {
            return res.status(404).json({
                success: false,
                message: 'Proveedor no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Proveedor obtenido correctamente',
            data: proveedor
        });
    } catch (error) {
        console.error('Error al obtener proveedor:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener proveedor',
            error: error.message
        });
    }
};

/**
 * Crear un nuevo proveedor
 */
export const crearProveedor = async (req, res) => {
    try {
        const {
            nombre,
            rfc,
            contacto,
            telefono,
            email,
            direccion,
            ciudad,
            estado,
            codigo_postal,
            notas
        } = req.body;

        // Validaciones
        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'El nombre del proveedor es requerido'
            });
        }

        // Verificar si ya existe un proveedor con el mismo RFC (si se proporciona)
        if (rfc) {
            const proveedorExistente = await Proveedor.findOne({ where: { rfc } });
            if (proveedorExistente) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe un proveedor con ese RFC'
                });
            }
        }

        const proveedor = await Proveedor.create({
            nombre: nombre.trim(),
            rfc: rfc ? rfc.trim() : null,
            contacto: contacto ? contacto.trim() : null,
            telefono: telefono ? telefono.trim() : null,
            email: email ? email.trim() : null,
            direccion: direccion ? direccion.trim() : null,
            ciudad: ciudad ? ciudad.trim() : null,
            estado: estado ? estado.trim() : null,
            codigo_postal: codigo_postal ? codigo_postal.trim() : null,
            notas: notas ? notas.trim() : null,
            activo: true
        });

        res.status(201).json({
            success: true,
            message: 'Proveedor creado exitosamente',
            data: proveedor
        });
    } catch (error) {
        console.error('Error al crear proveedor:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear proveedor',
            error: error.message
        });
    }
};

/**
 * Actualizar un proveedor
 */
export const actualizarProveedor = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nombre,
            rfc,
            contacto,
            telefono,
            email,
            direccion,
            ciudad,
            estado,
            codigo_postal,
            notas,
            activo
        } = req.body;

        const proveedor = await Proveedor.findByPk(id);

        if (!proveedor) {
            return res.status(404).json({
                success: false,
                message: 'Proveedor no encontrado'
            });
        }

        // Verificar RFC único (si se está cambiando)
        if (rfc && rfc !== proveedor.rfc) {
            const proveedorExistente = await Proveedor.findOne({
                where: {
                    rfc,
                    id: { [Op.ne]: id }
                }
            });

            if (proveedorExistente) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe otro proveedor con ese RFC'
                });
            }
        }

        // Actualizar campos
        await proveedor.update({
            nombre: nombre !== undefined ? nombre.trim() : proveedor.nombre,
            rfc: rfc !== undefined ? (rfc ? rfc.trim() : null) : proveedor.rfc,
            contacto: contacto !== undefined ? (contacto ? contacto.trim() : null) : proveedor.contacto,
            telefono: telefono !== undefined ? (telefono ? telefono.trim() : null) : proveedor.telefono,
            email: email !== undefined ? (email ? email.trim() : null) : proveedor.email,
            direccion: direccion !== undefined ? (direccion ? direccion.trim() : null) : proveedor.direccion,
            ciudad: ciudad !== undefined ? (ciudad ? ciudad.trim() : null) : proveedor.ciudad,
            estado: estado !== undefined ? (estado ? estado.trim() : null) : proveedor.estado,
            codigo_postal: codigo_postal !== undefined ? (codigo_postal ? codigo_postal.trim() : null) : proveedor.codigo_postal,
            notas: notas !== undefined ? (notas ? notas.trim() : null) : proveedor.notas,
            activo: activo !== undefined ? activo : proveedor.activo
        });

        res.json({
            success: true,
            message: 'Proveedor actualizado exitosamente',
            data: proveedor
        });
    } catch (error) {
        console.error('Error al actualizar proveedor:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar proveedor',
            error: error.message
        });
    }
};

/**
 * Eliminar un proveedor completamente
 */
export const eliminarProveedor = async (req, res) => {
    try {
        const { id } = req.params;

        const proveedor = await Proveedor.findByPk(id, {
            include: [
                {
                    model: Articulo,
                    as: 'articulos',
                    attributes: ['id'],
                    required: false
                }
            ]
        });

        if (!proveedor) {
            return res.status(404).json({
                success: false,
                message: 'Proveedor no encontrado'
            });
        }

        // Verificar si hay artículos asociados
        if (proveedor.articulos && proveedor.articulos.length > 0) {
            return res.status(400).json({
                success: false,
                message: `No se puede eliminar el proveedor porque tiene ${proveedor.articulos.length} artículo(s) asociado(s). Primero debe reasignar o eliminar los artículos.`
            });
        }

        // Eliminar el proveedor de forma permanente
        await proveedor.destroy();

        res.json({
            success: true,
            message: 'Proveedor eliminado exitosamente'
        });
    } catch (error) {
        console.error('Error al eliminar proveedor:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar proveedor',
            error: error.message
        });
    }
};

/**
 * Obtener artículos de un proveedor
 */
export const obtenerArticulosProveedor = async (req, res) => {
    try {
        const { id } = req.params;
        const { activo = 'true' } = req.query;

        const proveedor = await Proveedor.findByPk(id);

        if (!proveedor) {
            return res.status(404).json({
                success: false,
                message: 'Proveedor no encontrado'
            });
        }

        const where = { proveedor_id: id };
        if (activo !== null) {
            where.activo = activo === 'true';
        }

        const articulos = await Articulo.findAll({
            where,
            attributes: ['id', 'codigo_ean13', 'nombre', 'stock_actual', 'stock_minimo', 'stock_maximo', 'unidad', 'costo_unitario', 'activo'],
            order: [['nombre', 'ASC']]
        });

        res.json({
            success: true,
            message: 'Artículos del proveedor obtenidos correctamente',
            data: {
                proveedor: {
                    id: proveedor.id,
                    nombre: proveedor.nombre
                },
                articulos,
                total: articulos.length
            }
        });
    } catch (error) {
        console.error('Error al obtener artículos del proveedor:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener artículos del proveedor',
            error: error.message
        });
    }
};
