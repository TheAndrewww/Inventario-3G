import { Op } from 'sequelize';
import { Articulo, Categoria, Ubicacion, Proveedor } from '../models/index.js';
import { generarCodigoEAN13, generarCodigoEAN13Temporal, validarCodigoEAN13 } from '../utils/ean13-generator.js';
import { generarImagenCodigoBarras, generarSVGCodigoBarras } from '../utils/barcode-generator.js';

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
                },
                {
                    model: Proveedor,
                    as: 'proveedor',
                    attributes: ['id', 'nombre', 'contacto', 'telefono'],
                    required: false
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
                },
                {
                    model: Proveedor,
                    as: 'proveedor',
                    attributes: ['id', 'nombre', 'contacto', 'telefono', 'email'],
                    required: false
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
 * GET /api/articulos/ean13/:codigoEAN13
 * Buscar artículo por código de barras EAN-13
 */
export const getArticuloByEAN13 = async (req, res) => {
    try {
        const { codigoEAN13 } = req.params;

        // Validar formato EAN-13 (13 dígitos numéricos)
        if (!/^[0-9]{13}$/.test(codigoEAN13)) {
            return res.status(400).json({
                success: false,
                message: 'Código EAN-13 inválido. Debe contener exactamente 13 dígitos numéricos.'
            });
        }

        const articulo = await Articulo.findOne({
            where: { codigo_ean13: codigoEAN13 },
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
                },
                {
                    model: Proveedor,
                    as: 'proveedor',
                    attributes: ['id', 'nombre', 'contacto', 'telefono'],
                    required: false
                }
            ]
        });

        if (!articulo) {
            return res.status(404).json({
                success: false,
                message: 'Artículo no encontrado con ese código EAN-13'
            });
        }

        res.status(200).json({
            success: true,
            data: { articulo }
        });

    } catch (error) {
        console.error('Error en getArticuloByEAN13:', error);
        res.status(500).json({
            success: false,
            message: 'Error al buscar artículo por código de barras',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * POST /api/articulos
 * Crear un nuevo artículo con código EAN-13 (opcional - se genera automáticamente si no se proporciona)
 */
export const createArticulo = async (req, res) => {
    try {
        const {
            codigo_ean13,
            codigo_tipo,
            nombre,
            descripcion,
            categoria_id,
            ubicacion_id,
            proveedor_id,
            stock_actual,
            stock_minimo,
            stock_maximo,
            unidad,
            costo_unitario,
            imagen,
            es_herramienta
        } = req.body;

        // Validar campos requeridos (codigo_ean13 ahora es OPCIONAL)
        if (!nombre || !categoria_id || !ubicacion_id || stock_actual === undefined || stock_minimo === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Campos requeridos: nombre, categoria_id, ubicacion_id, stock_actual, stock_minimo'
            });
        }

        // Determinar tipo de código (por defecto EAN13)
        const tipoFinal = codigo_tipo || 'EAN13';

        // Validar tipo de código
        const tiposValidos = ['EAN13', 'EAN8', 'UPCA', 'UPCE', 'CODE128', 'CODE39', 'QRCODE', 'DATAMATRIX'];
        if (!tiposValidos.includes(tipoFinal)) {
            return res.status(400).json({
                success: false,
                message: `Tipo de código inválido. Tipos válidos: ${tiposValidos.join(', ')}`
            });
        }

        // Si se proporciona código, validarlo
        if (codigo_ean13) {
            // Verificar que el código no exista
            const articuloExistente = await Articulo.findOne({ where: { codigo_ean13 } });
            if (articuloExistente) {
                return res.status(400).json({
                    success: false,
                    message: `Ya existe un artículo con ese código ${tipoFinal}`
                });
            }
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

        // Determinar el código EAN-13 a usar
        let codigoFinal = codigo_ean13;

        // Si no se proporcionó código, generar uno temporal
        if (!codigoFinal) {
            codigoFinal = generarCodigoEAN13Temporal();
        }

        // Crear artículo
        const articulo = await Articulo.create({
            codigo_ean13: codigoFinal,
            codigo_tipo: tipoFinal,
            nombre,
            descripcion,
            categoria_id,
            ubicacion_id,
            proveedor_id: proveedor_id || null,
            stock_actual,
            stock_minimo,
            stock_maximo: stock_maximo || null,
            unidad: unidad || 'piezas',
            costo_unitario: costo_unitario || 0,
            imagen_url: imagen,
            activo: true,
            es_herramienta: es_herramienta || false
        });

        // Si se generó automáticamente y es EAN13, actualizar con código basado en ID
        if (!codigo_ean13 && tipoFinal === 'EAN13') {
            const codigoBasadoEnId = generarCodigoEAN13(articulo.id);
            await articulo.update({ codigo_ean13: codigoBasadoEnId });
            articulo.codigo_ean13 = codigoBasadoEnId;
        }

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
                },
                {
                    model: Proveedor,
                    as: 'proveedor',
                    attributes: ['id', 'nombre', 'contacto', 'telefono'],
                    required: false
                }
            ]
        });

        res.status(201).json({
            success: true,
            message: 'Artículo creado exitosamente',
            data: {
                articulo: articuloCompleto
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
            codigo_ean13,
            codigo_tipo,
            nombre,
            descripcion,
            categoria_id,
            ubicacion_id,
            proveedor_id,
            stock_actual,
            stock_minimo,
            stock_maximo,
            unidad,
            costo_unitario,
            imagen,
            activo,
            es_herramienta
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

        // Validar tipo de código si se proporciona
        if (codigo_tipo) {
            const tiposValidos = ['EAN13', 'EAN8', 'UPCA', 'UPCE', 'CODE128', 'CODE39', 'QRCODE', 'DATAMATRIX'];
            if (!tiposValidos.includes(codigo_tipo)) {
                return res.status(400).json({
                    success: false,
                    message: `Tipo de código inválido. Tipos válidos: ${tiposValidos.join(', ')}`
                });
            }
        }

        // Si se proporciona código, validarlo
        if (codigo_ean13) {
            // Verificar que el código no exista en otro artículo
            const articuloExistente = await Articulo.findOne({
                where: {
                    codigo_ean13,
                    id: { [Op.ne]: id }  // Excluir el artículo actual
                }
            });
            if (articuloExistente) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe otro artículo con ese código'
                });
            }
        }

        // Actualizar artículo
        await articulo.update({
            ...(codigo_ean13 && { codigo_ean13 }),
            ...(codigo_tipo && { codigo_tipo }),
            ...(nombre && { nombre }),
            ...(descripcion !== undefined && { descripcion }),
            ...(categoria_id && { categoria_id }),
            ...(ubicacion_id && { ubicacion_id }),
            ...(proveedor_id !== undefined && { proveedor_id }),
            ...(stock_actual !== undefined && { stock_actual }),
            ...(stock_minimo !== undefined && { stock_minimo }),
            ...(stock_maximo !== undefined && { stock_maximo }),
            ...(unidad && { unidad }),
            ...(costo_unitario !== undefined && { costo_unitario }),
            ...(imagen !== undefined && { imagen }),
            ...(activo !== undefined && { activo }),
            ...(es_herramienta !== undefined && { es_herramienta })
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
                },
                {
                    model: Proveedor,
                    as: 'proveedor',
                    attributes: ['id', 'nombre', 'contacto', 'telefono'],
                    required: false
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
 * GET /api/articulos/:id/barcode
 * Generar código de barras EAN-13 como imagen PNG
 */
export const getArticuloBarcode = async (req, res) => {
    try {
        const { id } = req.params;

        // Buscar artículo
        const articulo = await Articulo.findByPk(id);

        if (!articulo) {
            return res.status(404).json({
                success: false,
                message: 'Artículo no encontrado'
            });
        }

        // Generar imagen del código de barras usando el tipo especificado
        const tipoCodigo = articulo.codigo_tipo || 'EAN13';
        const imagenBuffer = await generarImagenCodigoBarras(articulo.codigo_ean13, tipoCodigo);

        // Configurar headers para imagen PNG
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `inline; filename="barcode-${articulo.codigo_ean13}.png"`);
        res.send(imagenBuffer);

    } catch (error) {
        console.error('Error en getArticuloBarcode:', error);
        res.status(500).json({
            success: false,
            message: 'Error al generar código de barras',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * GET /api/articulos/:id/barcode-svg
 * Generar código de barras EAN-13 como SVG
 */
export const getArticuloBarcodeSVG = async (req, res) => {
    try {
        const { id } = req.params;

        // Buscar artículo
        const articulo = await Articulo.findByPk(id);

        if (!articulo) {
            return res.status(404).json({
                success: false,
                message: 'Artículo no encontrado'
            });
        }

        // Generar SVG del código de barras usando el tipo especificado
        const tipoCodigo = articulo.codigo_tipo || 'EAN13';
        const svg = await generarSVGCodigoBarras(articulo.codigo_ean13, tipoCodigo);

        // Configurar headers para SVG
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Content-Disposition', `inline; filename="barcode-${articulo.codigo_ean13}.svg"`);
        res.send(svg);

    } catch (error) {
        console.error('Error en getArticuloBarcodeSVG:', error);
        res.status(500).json({
            success: false,
            message: 'Error al generar código de barras SVG',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * GET /api/articulos/:id/etiqueta
 * Generar etiqueta completa para imprimir con código de barras y datos del artículo
 */
export const getArticuloEtiqueta = async (req, res) => {
    try {
        const { id } = req.params;

        // Buscar artículo con todas sus relaciones
        const articulo = await Articulo.findByPk(id, {
            include: [
                {
                    model: Categoria,
                    as: 'categoria',
                    attributes: ['nombre']
                },
                {
                    model: Ubicacion,
                    as: 'ubicacion',
                    attributes: ['codigo', 'almacen']
                }
            ]
        });

        if (!articulo) {
            return res.status(404).json({
                success: false,
                message: 'Artículo no encontrado'
            });
        }

        // Generar imagen del código de barras usando el tipo especificado
        const tipoCodigo = articulo.codigo_tipo || 'EAN13';
        const imagenBuffer = await generarImagenCodigoBarras(articulo.codigo_ean13, tipoCodigo, {
            scale: 4,
            height: 12
        });

        // Por ahora solo devolvemos el código de barras
        // En el futuro se puede generar una etiqueta completa con más datos
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="etiqueta-${articulo.nombre.replace(/\s+/g, '-')}.png"`);
        res.send(imagenBuffer);

    } catch (error) {
        console.error('Error en getArticuloEtiqueta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al generar etiqueta',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * POST /api/articulos/:id/imagen
 * Subir imagen para un artículo
 */
export const uploadArticuloImagen = async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar que el artículo existe
        const articulo = await Articulo.findByPk(id);

        if (!articulo) {
            return res.status(404).json({
                success: false,
                message: 'Artículo no encontrado'
            });
        }

        // Verificar que se subió un archivo
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No se proporcionó ninguna imagen'
            });
        }

        // Eliminar imagen anterior de Cloudinary si existe
        if (articulo.imagen_url) {
            try {
                const { eliminarImagen } = await import('../config/cloudinary.js');
                await eliminarImagen(articulo.imagen_url);
            } catch (error) {
                console.log('Error al eliminar imagen anterior:', error.message);
                // Continuar aunque falle la eliminación
            }
        }

        // Cloudinary provee la URL en req.file.path
        // Asegurarse de que la URL tenga el formato correcto (https://)
        let imageUrl = req.file.path;

        // Corregir si la URL está malformada (https// en lugar de https://)
        if (imageUrl && imageUrl.includes('https//')) {
            imageUrl = imageUrl.replace('https//', 'https://');
        }
        if (imageUrl && imageUrl.includes('http//')) {
            imageUrl = imageUrl.replace('http//', 'http://');
        }

        // Actualizar artículo con nueva imagen
        await articulo.update({ imagen_url: imageUrl });

        res.status(200).json({
            success: true,
            message: 'Imagen subida exitosamente',
            data: {
                imagen_url: imageUrl
            }
        });

    } catch (error) {
        console.error('Error en uploadArticuloImagen:', error);
        res.status(500).json({
            success: false,
            message: 'Error al subir imagen',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * DELETE /api/articulos/:id/imagen
 * Eliminar imagen de un artículo
 */
export const deleteArticuloImagen = async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar que el artículo existe
        const articulo = await Articulo.findByPk(id);

        if (!articulo) {
            return res.status(404).json({
                success: false,
                message: 'Artículo no encontrado'
            });
        }

        if (!articulo.imagen_url) {
            return res.status(404).json({
                success: false,
                message: 'El artículo no tiene imagen'
            });
        }

        // Eliminar imagen de Cloudinary
        const { eliminarImagen } = await import('../config/cloudinary.js');
        await eliminarImagen(articulo.imagen_url);

        // Actualizar artículo
        await articulo.update({ imagen_url: null });

        res.status(200).json({
            success: true,
            message: 'Imagen eliminada exitosamente'
        });

    } catch (error) {
        console.error('Error en deleteArticuloImagen:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar imagen',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export default {
    getArticulos,
    getArticuloById,
    getArticuloByEAN13,
    createArticulo,
    updateArticulo,
    deleteArticulo,
    getArticuloBarcode,
    getArticuloBarcodeSVG,
    getArticuloEtiqueta,
    uploadArticuloImagen,
    deleteArticuloImagen
};
