import { Op } from 'sequelize';
import { Articulo, Categoria, Ubicacion } from '../models/index.js';
import { generarQRArticulo } from '../utils/qr-generator.js';

/**
 * GET /api/articulos
 * Obtener todos los artículos con filtros opcionales
 */
export const getArticulos = async (req, res) => {
    try {
        const {
            search,
            categoria_id,
            ubicacion_id,
            stock_bajo,
            activo,
            page = 1,
            limit = 50,
            order_by = 'nombre',
            order_dir = 'ASC'
        } = req.query;

        // Construir filtros
        const where = {};

        if (search) {
            where[Op.or] = [
                { nombre: { [Op.iLike]: `%${search}%` } },
                { descripcion: { [Op.iLike]: `%${search}%` } },
                { id: { [Op.iLike]: `%${search}%` } }
            ];
        }

        if (categoria_id) {
            where.categoria_id = categoria_id;
        }

        if (ubicacion_id) {
            where.ubicacion_id = ubicacion_id;
        }

        if (activo !== undefined) {
            where.activo = activo === 'true';
        }

        // Calcular offset para paginación
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Consultar artículos
        const { count, rows: articulos } = await Articulo.findAndCountAll({
            where,
            include: [
                {
                    model: Categoria,
                    as: 'categoria',
                    attributes: ['id', 'nombre', 'color', 'icono']
                },
                {
                    model: Ubicacion,
                    as: 'ubicacion',
                    attributes: ['id', 'codigo', 'almacen', 'descripcion']
                }
            ],
            order: [[order_by, order_dir.toUpperCase()]],
            limit: parseInt(limit),
            offset
        });

        // Si se solicita filtrar por stock bajo
        let articulosFiltrados = articulos;
        if (stock_bajo === 'true') {
            articulosFiltrados = articulos.filter(art => art.stock_actual <= art.stock_minimo);
        }

        res.status(200).json({
            success: true,
            data: {
                articulos: articulosFiltrados,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / parseInt(limit))
                }
            }
        });

    } catch (error) {
        console.error('Error en getArticulos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener artículos',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * GET /api/articulos/:id
 * Obtener un artículo por ID
 */
export const getArticuloById = async (req, res) => {
    try {
        const { id } = req.params;

        const articulo = await Articulo.findByPk(id, {
            include: [
                {
                    model: Categoria,
                    as: 'categoria',
                    attributes: ['id', 'nombre', 'color', 'icono']
                },
                {
                    model: Ubicacion,
                    as: 'ubicacion',
                    attributes: ['id', 'codigo', 'almacen', 'pasillo', 'estante', 'nivel', 'descripcion']
                }
            ]
        });

        if (!articulo) {
            return res.status(404).json({
                success: false,
                message: 'Artículo no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            data: { articulo }
        });

    } catch (error) {
        console.error('Error en getArticuloById:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener artículo',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * GET /api/articulos/qr/:codigoQR
 * Buscar artículo por código QR
 */
export const getArticuloByQR = async (req, res) => {
    try {
        const { codigoQR } = req.params;

        // Decodificar el QR (viene como JSON string)
        let qrData;
        try {
            qrData = JSON.parse(decodeURIComponent(codigoQR));
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: 'Código QR inválido'
            });
        }

        const articulo = await Articulo.findOne({
            where: { id: qrData.id },
            include: [
                {
                    model: Categoria,
                    as: 'categoria',
                    attributes: ['id', 'nombre', 'color', 'icono']
                },
                {
                    model: Ubicacion,
                    as: 'ubicacion',
                    attributes: ['id', 'codigo', 'almacen', 'descripcion']
                }
            ]
        });

        if (!articulo) {
            return res.status(404).json({
                success: false,
                message: 'Artículo no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            data: { articulo }
        });

    } catch (error) {
        console.error('Error en getArticuloByQR:', error);
        res.status(500).json({
            success: false,
            message: 'Error al buscar artículo por QR',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * POST /api/articulos
 * Crear un nuevo artículo con QR automático
 */
export const createArticulo = async (req, res) => {
    try {
        const {
            nombre,
            descripcion,
            categoria_id,
            ubicacion_id,
            stock_actual,
            stock_minimo,
            unidad,
            costo_unitario,
            imagen
        } = req.body;

        // Validar campos requeridos
        if (!nombre || !categoria_id || !ubicacion_id || stock_actual === undefined || stock_minimo === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Campos requeridos: nombre, categoria_id, ubicacion_id, stock_actual, stock_minimo'
            });
        }

        // Verificar que la categoría existe
        const categoria = await Categoria.findByPk(categoria_id);
        if (!categoria) {
            return res.status(404).json({
                success: false,
                message: 'Categoría no encontrada'
            });
        }

        // Verificar que la ubicación existe
        const ubicacion = await Ubicacion.findByPk(ubicacion_id);
        if (!ubicacion) {
            return res.status(404).json({
                success: false,
                message: 'Ubicación no encontrada'
            });
        }

        // Generar un ID temporal para el QR (antes de crear el artículo)
        // Vamos a generar el código QR con un placeholder y luego actualizar
        const tempId = Date.now().toString();
        const tempQRData = JSON.stringify({
            id: tempId,
            type: 'articulo',
            timestamp: new Date().toISOString()
        });

        // Crear artículo con QR temporal
        const articulo = await Articulo.create({
            nombre,
            descripcion,
            categoria_id,
            ubicacion_id,
            stock_actual,
            stock_minimo,
            unidad: unidad || 'piezas',
            costo_unitario: costo_unitario || 0,
            imagen_url: imagen,
            activo: true,
            codigo_qr: tempQRData // QR temporal para cumplir con NOT NULL
        });

        // Ahora generar el código QR real con el ID correcto
        const qrResult = await generarQRArticulo({
            id: articulo.id,
            nombre: articulo.nombre
        });

        // Actualizar artículo con el código QR real
        await articulo.update({
            codigo_qr: qrResult.qrData
        });

        // Obtener artículo completo con relaciones
        const articuloCompleto = await Articulo.findByPk(articulo.id, {
            include: [
                {
                    model: Categoria,
                    as: 'categoria',
                    attributes: ['id', 'nombre', 'color', 'icono']
                },
                {
                    model: Ubicacion,
                    as: 'ubicacion',
                    attributes: ['id', 'codigo', 'almacen', 'descripcion']
                }
            ]
        });

        res.status(201).json({
            success: true,
            message: 'Artículo creado exitosamente',
            data: {
                articulo: articuloCompleto,
                qr: {
                    dataURL: qrResult.qrDataURL,
                    filePath: qrResult.qrFilePath
                }
            }
        });

    } catch (error) {
        console.error('Error en createArticulo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear artículo',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * PUT /api/articulos/:id
 * Actualizar un artículo existente
 */
export const updateArticulo = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nombre,
            descripcion,
            categoria_id,
            ubicacion_id,
            stock_actual,
            stock_minimo,
            unidad,
            costo_unitario,
            imagen,
            activo
        } = req.body;

        // Buscar artículo
        const articulo = await Articulo.findByPk(id);

        if (!articulo) {
            return res.status(404).json({
                success: false,
                message: 'Artículo no encontrado'
            });
        }

        // Verificar categoría si se proporciona
        if (categoria_id) {
            const categoria = await Categoria.findByPk(categoria_id);
            if (!categoria) {
                return res.status(404).json({
                    success: false,
                    message: 'Categoría no encontrada'
                });
            }
        }

        // Verificar ubicación si se proporciona
        if (ubicacion_id) {
            const ubicacion = await Ubicacion.findByPk(ubicacion_id);
            if (!ubicacion) {
                return res.status(404).json({
                    success: false,
                    message: 'Ubicación no encontrada'
                });
            }
        }

        // Actualizar artículo
        await articulo.update({
            ...(nombre && { nombre }),
            ...(descripcion !== undefined && { descripcion }),
            ...(categoria_id && { categoria_id }),
            ...(ubicacion_id && { ubicacion_id }),
            ...(stock_actual !== undefined && { stock_actual }),
            ...(stock_minimo !== undefined && { stock_minimo }),
            ...(unidad && { unidad }),
            ...(costo_unitario !== undefined && { costo_unitario }),
            ...(imagen !== undefined && { imagen }),
            ...(activo !== undefined && { activo })
        });

        // Obtener artículo actualizado con relaciones
        const articuloActualizado = await Articulo.findByPk(id, {
            include: [
                {
                    model: Categoria,
                    as: 'categoria',
                    attributes: ['id', 'nombre', 'color', 'icono']
                },
                {
                    model: Ubicacion,
                    as: 'ubicacion',
                    attributes: ['id', 'codigo', 'almacen', 'descripcion']
                }
            ]
        });

        res.status(200).json({
            success: true,
            message: 'Artículo actualizado exitosamente',
            data: { articulo: articuloActualizado }
        });

    } catch (error) {
        console.error('Error en updateArticulo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar artículo',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * DELETE /api/articulos/:id
 * Eliminar (desactivar) un artículo
 */
export const deleteArticulo = async (req, res) => {
    try {
        const { id } = req.params;

        const articulo = await Articulo.findByPk(id);

        if (!articulo) {
            return res.status(404).json({
                success: false,
                message: 'Artículo no encontrado'
            });
        }

        // Soft delete - solo desactivar
        await articulo.update({ activo: false });

        res.status(200).json({
            success: true,
            message: 'Artículo desactivado exitosamente'
        });

    } catch (error) {
        console.error('Error en deleteArticulo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar artículo',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * POST /api/articulos/:id/regenerar-qr
 * Regenerar código QR de un artículo
 */
export const regenerarQR = async (req, res) => {
    try {
        const { id } = req.params;

        const articulo = await Articulo.findByPk(id);

        if (!articulo) {
            return res.status(404).json({
                success: false,
                message: 'Artículo no encontrado'
            });
        }

        // Generar nuevo código QR
        const qrResult = await generarQRArticulo({
            id: articulo.id,
            nombre: articulo.nombre
        });

        // Actualizar artículo con el nuevo código QR
        await articulo.update({
            codigo_qr: qrResult.qrData,
            qr_image_url: qrResult.qrFilePath
        });

        res.status(200).json({
            success: true,
            message: 'Código QR regenerado exitosamente',
            data: {
                qr: {
                    dataURL: qrResult.qrDataURL,
                    filePath: qrResult.qrFilePath
                }
            }
        });

    } catch (error) {
        console.error('Error en regenerarQR:', error);
        res.status(500).json({
            success: false,
            message: 'Error al regenerar código QR',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    getArticulos,
    getArticuloById,
    getArticuloByQR,
    createArticulo,
    updateArticulo,
    deleteArticulo,
    regenerarQR
};
