import { Op } from 'sequelize';
import { Articulo, Categoria, Ubicacion, Proveedor, ArticuloProveedor, DetalleMovimiento, SolicitudCompra, DetalleOrdenCompra } from '../models/index.js';
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
            limit = 1000,
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
                },
                {
                    model: Proveedor,
                    as: 'proveedores',
                    attributes: ['id', 'nombre', 'contacto', 'telefono', 'email'],
                    through: {
                        attributes: ['costo_unitario', 'es_preferido', 'sku_proveedor', 'notas']
                    },
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
                },
                {
                    model: Proveedor,
                    as: 'proveedores',
                    attributes: ['id', 'nombre', 'contacto', 'telefono', 'email'],
                    through: {
                        attributes: ['costo_unitario', 'es_preferido', 'sku_proveedor', 'notas']
                    },
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
                },
                {
                    model: Proveedor,
                    as: 'proveedores',
                    attributes: ['id', 'nombre', 'contacto', 'telefono', 'email'],
                    through: {
                        attributes: ['costo_unitario', 'es_preferido', 'sku_proveedor', 'notas']
                    },
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
            proveedores_ids, // Nuevo: array de IDs de proveedores
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

        // Determinar si el artículo debe marcarse como pendiente de revisión
        // (cuando lo crea un usuario con rol almacén)
        const esAlmacen = req.usuario?.rol === 'almacen';

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
            es_herramienta: es_herramienta || false,
            pendiente_revision: esAlmacen
        });

        // Si se generó automáticamente y es EAN13, actualizar con código basado en ID
        if (!codigo_ean13 && tipoFinal === 'EAN13') {
            const codigoBasadoEnId = generarCodigoEAN13(articulo.id);
            await articulo.update({ codigo_ean13: codigoBasadoEnId });
            articulo.codigo_ean13 = codigoBasadoEnId;
        }

        // Asociar múltiples proveedores si se proporcionaron
        if (proveedores_ids && Array.isArray(proveedores_ids) && proveedores_ids.length > 0) {
            for (const proveedorData of proveedores_ids) {
                const { proveedor_id: provId, costo_unitario: costoProveedor, es_preferido } = proveedorData;

                await ArticuloProveedor.create({
                    articulo_id: articulo.id,
                    proveedor_id: provId,
                    costo_unitario: costoProveedor || costo_unitario || 0,
                    es_preferido: es_preferido || false
                });
            }
        } else if (proveedor_id) {
            // Compatibilidad con API anterior: si solo se envía proveedor_id único
            await ArticuloProveedor.create({
                articulo_id: articulo.id,
                proveedor_id: proveedor_id,
                costo_unitario: costo_unitario || 0,
                es_preferido: true
            });
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
                },
                {
                    model: Proveedor,
                    as: 'proveedores',
                    attributes: ['id', 'nombre', 'contacto', 'telefono', 'email'],
                    through: {
                        attributes: ['costo_unitario', 'es_preferido', 'sku_proveedor', 'notas']
                    },
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
            proveedores_ids, // Nuevo: array de IDs de proveedores
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

        // Si el usuario que edita es admin o encargado, marcar como revisado
        const esAdminOEncargado = ['administrador', 'encargado'].includes(req.usuario?.rol);

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
            ...(es_herramienta !== undefined && { es_herramienta }),
            // Si es admin o encargado, marcar como revisado
            ...(esAdminOEncargado && { pendiente_revision: false })
        });

        // Actualizar múltiples proveedores si se proporcionaron
        if (proveedores_ids && Array.isArray(proveedores_ids)) {
            // Eliminar todas las asociaciones actuales
            await ArticuloProveedor.destroy({ where: { articulo_id: id } });

            // Crear nuevas asociaciones
            for (const proveedorData of proveedores_ids) {
                const { proveedor_id: provId, costo_unitario: costoProveedor, es_preferido } = proveedorData;

                await ArticuloProveedor.create({
                    articulo_id: id,
                    proveedor_id: provId,
                    costo_unitario: costoProveedor || 0,
                    es_preferido: es_preferido || false
                });
            }
        }

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
                },
                {
                    model: Proveedor,
                    as: 'proveedores',
                    attributes: ['id', 'nombre', 'contacto', 'telefono', 'email'],
                    through: {
                        attributes: ['costo_unitario', 'es_preferido', 'sku_proveedor', 'notas']
                    },
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
 * DELETE /api/articulos/:id/permanente
 * Eliminar permanentemente un artículo de la base de datos
 */
export const deleteArticuloPermanente = async (req, res) => {
    try {
        const { id } = req.params;

        const articulo = await Articulo.findByPk(id);

        if (!articulo) {
            return res.status(404).json({
                success: false,
                message: 'Artículo no encontrado'
            });
        }

        // Verificar que el artículo esté desactivado antes de eliminar permanentemente
        if (articulo.activo) {
            return res.status(400).json({
                success: false,
                message: 'Solo se pueden eliminar permanentemente artículos desactivados'
            });
        }

        // Eliminar todas las relaciones del artículo

        // 1. Eliminar relaciones con proveedores
        await ArticuloProveedor.destroy({ where: { articulo_id: id } });

        // 2. Eliminar detalles de movimientos
        if (DetalleMovimiento) {
            await DetalleMovimiento.destroy({ where: { articulo_id: id } });
        }

        // 3. Eliminar solicitudes de compra
        if (SolicitudCompra) {
            await SolicitudCompra.destroy({ where: { articulo_id: id } });
        }

        // 4. Eliminar detalles de órdenes de compra
        if (DetalleOrdenCompra) {
            await DetalleOrdenCompra.destroy({ where: { articulo_id: id } });
        }

        // Eliminar imagen de Cloudinary si existe
        if (articulo.imagen_url) {
            try {
                const { eliminarImagen } = await import('../config/cloudinary.js');
                await eliminarImagen(articulo.imagen_url);
            } catch (error) {
                console.log('Error al eliminar imagen de Cloudinary:', error.message);
                // Continuar aunque falle la eliminación de la imagen
            }
        }

        // Hard delete - eliminar permanentemente
        await articulo.destroy();

        res.status(200).json({
            success: true,
            message: 'Artículo eliminado permanentemente'
        });

    } catch (error) {
        console.error('Error en deleteArticuloPermanente:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar artículo permanentemente',
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

        // Importar generador de etiquetas
        const { generarEtiquetaIndividual } = await import('../utils/label-generator.js');

        // Generar etiqueta completa de 3cm x 9cm con nombre y código de barras
        const etiquetaBuffer = await generarEtiquetaIndividual({
            nombre: articulo.nombre,
            codigo_ean13: articulo.codigo_ean13
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="etiqueta-${articulo.nombre.replace(/\s+/g, '-')}.pdf"`);
        res.send(etiquetaBuffer);

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
 * POST /api/articulos/etiquetas/lote-mixto
 * Generar PDF con múltiples etiquetas (3cm x 9cm) organizadas en hojas A4
 * Acepta tanto artículos consumibles como unidades de herramientas
 */
export const generarEtiquetasMixtas = async (req, res) => {
    try {
        const { articulos_ids = [], unidades_ids = [] } = req.body;

        // Validar que se proporcionó al menos uno
        if ((!articulos_ids || articulos_ids.length === 0) && (!unidades_ids || unidades_ids.length === 0)) {
            return res.status(400).json({
                success: false,
                message: 'Debes proporcionar al menos un artículo o unidad de herramienta'
            });
        }

        const etiquetas = [];

        // Procesar artículos consumibles
        if (articulos_ids && articulos_ids.length > 0) {
            const articulos = await Articulo.findAll({
                where: {
                    id: articulos_ids,
                    activo: true,
                    es_herramienta: false // Solo consumibles
                }
            });

            articulos.forEach(a => {
                etiquetas.push({
                    nombre: a.nombre,
                    codigo_ean13: a.codigo_ean13,
                    tipo: 'articulo'
                });
            });
        }

        // Procesar unidades de herramientas
        if (unidades_ids && unidades_ids.length > 0) {
            const { UnidadHerramientaRenta, TipoHerramientaRenta } = await import('../models/index.js');

            const unidades = await UnidadHerramientaRenta.findAll({
                where: {
                    id: unidades_ids,
                    activo: true
                },
                include: [{
                    model: TipoHerramientaRenta,
                    as: 'tipoHerramienta',
                    attributes: ['nombre']
                }]
            });

            unidades.forEach(u => {
                etiquetas.push({
                    nombre: `${u.tipoHerramienta.nombre} - ${u.codigo_unico}`,
                    codigo_ean13: u.codigo_ean13,
                    tipo: 'unidad'
                });
            });
        }

        if (etiquetas.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No se encontraron artículos o unidades válidas'
            });
        }

        // Generar PDF con todas las etiquetas
        const labelGenerator = await import('../utils/label-generator.js');
        const pdfBuffer = await labelGenerator.generarEtiquetasLote(etiquetas);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="etiquetas-lote-${etiquetas.length}-items.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error en generarEtiquetasMixtas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al generar etiquetas',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * POST /api/articulos/etiquetas/lote
 * Generar PDF con múltiples etiquetas (3cm x 9cm) organizadas en hojas A4
 */
export const generarEtiquetasLote = async (req, res) => {
    try {
        const { articulos_ids } = req.body;

        // Validar que se proporcionaron IDs
        if (!articulos_ids || !Array.isArray(articulos_ids) || articulos_ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Debes proporcionar un array de IDs de artículos'
            });
        }

        // Buscar todos los artículos
        const articulos = await Articulo.findAll({
            where: {
                id: articulos_ids,
                activo: true
            },
            attributes: ['id', 'nombre', 'codigo_ean13'],
            order: [['nombre', 'ASC']]
        });

        if (articulos.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No se encontraron artículos activos con los IDs proporcionados'
            });
        }

        // Importar generador de etiquetas
        const labelGenerator = await import('../utils/label-generator.js');

        // Generar PDF con todas las etiquetas
        const pdfBuffer = await labelGenerator.generarEtiquetasLote(articulos.map(a => ({
            nombre: a.nombre,
            codigo_ean13: a.codigo_ean13
        })));

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="etiquetas-lote-${articulos.length}-articulos.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error en generarEtiquetasLote:', error);
        res.status(500).json({
            success: false,
            message: 'Error al generar etiquetas',
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

        const imageBuffer = req.file.buffer;

        // Subir imagen directamente a Cloudinary (sin procesamiento IA automático)
        // El procesamiento con IA se hace manualmente con el botón "Mejorar IA"
        console.log('📤 Subiendo imagen a Cloudinary...');
        const { uploadBufferToCloudinary } = await import('../config/cloudinary.js');
        const imageUrl = await uploadBufferToCloudinary(imageBuffer);

        console.log('☁️ Imagen subida a Cloudinary:', imageUrl);

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

/**
 * POST /api/articulos/:id/imagen/reprocess
 * Reprocesar imagen existente con Nano Banana
 */
export const reprocessArticuloImagen = async (req, res) => {
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
                message: 'El artículo no tiene imagen para reprocesar'
            });
        }

        // Importar servicios necesarios
        const { procesarImagenDesdeUrl, isNanoBananaEnabled } = await import('../services/nanoBanana.service.js');
        const { uploadBufferToCloudinary, eliminarImagen } = await import('../config/cloudinary.js');

        // Verificar que Gemini está configurado
        if (!isNanoBananaEnabled()) {
            return res.status(503).json({
                success: false,
                message: 'Gemini (Nano Banana) no está configurado. Agrega GEMINI_API_KEY en las variables de entorno.'
            });
        }

        console.log(`🔄 Reprocesando imagen del artículo ${id} con Gemini...`);

        // Procesar imagen con Gemini usando metadata del artículo
        const processedBuffer = await procesarImagenDesdeUrl(articulo.imagen_url, {
            nombre: articulo.nombre,
            descripcion: articulo.descripcion,
            unidad: articulo.unidad
        });

        // Eliminar imagen anterior de Cloudinary
        try {
            await eliminarImagen(articulo.imagen_url);
            console.log('🗑️ Imagen anterior eliminada de Cloudinary');
        } catch (error) {
            console.log('⚠️ Error al eliminar imagen anterior:', error.message);
            // Continuar aunque falle la eliminación
        }

        // Subir nueva imagen procesada a Cloudinary
        const newImageUrl = await uploadBufferToCloudinary(processedBuffer);
        console.log('☁️ Nueva imagen subida a Cloudinary:', newImageUrl);

        // Actualizar artículo con nueva URL
        await articulo.update({ imagen_url: newImageUrl });

        res.status(200).json({
            success: true,
            message: 'Imagen reprocesada exitosamente con IA',
            data: {
                imagen_url: newImageUrl,
                processed_with_ai: true
            }
        });

    } catch (error) {
        console.error('Error en reprocessArticuloImagen:', error);
        res.status(500).json({
            success: false,
            message: 'Error al reprocesar imagen',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * POST /api/articulos/batch-process-images
 * Agregar múltiples artículos a la cola de procesamiento masivo
 */
export const batchProcessImages = async (req, res) => {
    try {
        const { articuloIds, prioridad = 0 } = req.body;

        if (!Array.isArray(articuloIds) || articuloIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere un array de IDs de artículos'
            });
        }

        // Importar servicio de cola
        const { agregarArticulosACola } = await import('../services/imageProcessingQueue.service.js');

        // Agregar a la cola
        const resultado = await agregarArticulosACola(articuloIds, prioridad);

        res.status(200).json({
            success: true,
            message: `${resultado.agregados} artículo(s) agregado(s) a la cola de procesamiento`,
            data: resultado
        });

    } catch (error) {
        console.error('Error en batchProcessImages:', error);
        res.status(500).json({
            success: false,
            message: 'Error al agregar artículos a la cola',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * GET /api/articulos/processing-queue/status
 * Obtener estado actual de la cola de procesamiento
 */
export const getProcessingQueueStatus = async (req, res) => {
    try {
        const { obtenerEstadoCola } = await import('../services/imageProcessingQueue.service.js');
        const estado = await obtenerEstadoCola();

        res.status(200).json({
            success: true,
            data: estado
        });

    } catch (error) {
        console.error('Error en getProcessingQueueStatus:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estado de la cola',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * GET /api/articulos/processing-queue/history
 * Obtener historial de la cola de procesamiento
 */
export const getProcessingQueueHistory = async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const { obtenerHistorialCola } = await import('../services/imageProcessingQueue.service.js');

        const historial = await obtenerHistorialCola(parseInt(limit), parseInt(offset));

        res.status(200).json({
            success: true,
            data: {
                historial,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });

    } catch (error) {
        console.error('Error en getProcessingQueueHistory:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener historial de la cola',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * POST /api/articulos/processing-queue/:id/retry
 * Reintentar procesamiento de un artículo fallido
 */
export const retryQueueItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { reintentarArticulo } = await import('../services/imageProcessingQueue.service.js');

        await reintentarArticulo(parseInt(id));

        res.status(200).json({
            success: true,
            message: 'Artículo marcado para reintento'
        });

    } catch (error) {
        console.error('Error en retryQueueItem:', error);
        res.status(500).json({
            success: false,
            message: 'Error al reintentar artículo',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * DELETE /api/articulos/processing-queue/clean
 * Limpiar cola (eliminar completados y fallidos antiguos)
 */
export const cleanProcessingQueue = async (req, res) => {
    try {
        const { dias = 7 } = req.query;
        const { limpiarCola } = await import('../services/imageProcessingQueue.service.js');

        const eliminados = await limpiarCola(parseInt(dias));

        res.status(200).json({
            success: true,
            message: `${eliminados} elemento(s) eliminado(s) de la cola`,
            data: { eliminados }
        });

    } catch (error) {
        console.error('Error en cleanProcessingQueue:', error);
        res.status(500).json({
            success: false,
            message: 'Error al limpiar cola',
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
    deleteArticuloPermanente,
    getArticuloBarcode,
    getArticuloBarcodeSVG,
    getArticuloEtiqueta,
    uploadArticuloImagen,
    deleteArticuloImagen,
    reprocessArticuloImagen,
    batchProcessImages,
    getProcessingQueueStatus,
    getProcessingQueueHistory,
    retryQueueItem,
    cleanProcessingQueue
};
