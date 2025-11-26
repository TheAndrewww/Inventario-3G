import {
    TipoHerramientaRenta,
    UnidadHerramientaRenta,
    HistorialAsignacionHerramienta,
    Categoria,
    Ubicacion,
    Proveedor,
    Usuario,
    Equipo,
    Articulo,
    sequelize
} from '../models/index.js';
import { Op } from 'sequelize';
import { generarCodigoEAN13Temporal, generarCodigoEAN13 } from '../utils/ean13-generator.js';
import { generarImagenCodigoBarras, generarSVGCodigoBarras } from '../utils/barcode-generator.js';

// ============ FUNCIONES AUXILIARES ============

/**
 * Genera un prefijo automático a partir del nombre
 * Ejemplo: "Pistola de Pintura HVLP" -> "PP"
 */
const generarPrefijo = (nombre) => {
    // Palabras a ignorar
    const palabrasIgnoradas = ['de', 'la', 'el', 'del', 'los', 'las', 'y', 'para', 'con'];

    const palabras = nombre
        .split(' ')
        .filter(palabra => !palabrasIgnoradas.includes(palabra.toLowerCase()));

    if (palabras.length >= 2) {
        // Tomar primera letra de las dos primeras palabras significativas
        return (palabras[0][0] + palabras[1][0]).toUpperCase();
    } else if (palabras.length === 1) {
        // Si solo hay una palabra, tomar las dos primeras letras
        return palabras[0].substring(0, 2).toUpperCase();
    }

    return 'HR'; // Fallback: Herramienta Renta
};

/**
 * Verifica si un prefijo ya existe y genera uno único
 */
const obtenerPrefijoUnico = async (prefijoBase) => {
    let prefijo = prefijoBase;
    let contador = 2;

    while (true) {
        const existe = await TipoHerramientaRenta.findOne({
            where: { prefijo_codigo: prefijo }
        });

        if (!existe) {
            return prefijo;
        }

        prefijo = `${prefijoBase}${contador}`;
        contador++;
    }
};

/**
 * Genera un código único para una unidad
 * Formato: PREFIJO-XXX (ej: PP-001, PP-002)
 */
const generarCodigoUnidad = async (prefijoTipo) => {
    // Buscar el último código con este prefijo
    const ultimaUnidad = await UnidadHerramientaRenta.findOne({
        where: {
            codigo_unico: {
                [Op.like]: `${prefijoTipo}-%`
            }
        },
        order: [['codigo_unico', 'DESC']]
    });

    let numeroConsecutivo = 1;

    if (ultimaUnidad) {
        // Extraer el número del último código (ej: "PP-005" -> 5)
        const match = ultimaUnidad.codigo_unico.match(/-(\d+)$/);
        if (match) {
            numeroConsecutivo = parseInt(match[1]) + 1;
        }
    }

    // Formatear con ceros a la izquierda (3 dígitos)
    const numeroFormateado = numeroConsecutivo.toString().padStart(3, '0');

    return `${prefijoTipo}-${numeroFormateado}`;
};

// ============ CONTROLADORES - TIPOS DE HERRAMIENTA ============

/**
 * Obtener todos los tipos de herramienta de renta
 * GET /api/herramientas-renta/tipos
 */
export const obtenerTipos = async (req, res) => {
    try {
        const tipos = await TipoHerramientaRenta.findAll({
            where: { activo: true },
            include: [
                {
                    model: Categoria,
                    as: 'categoria',
                    attributes: ['id', 'nombre']
                },
                {
                    model: Ubicacion,
                    as: 'ubicacion',
                    attributes: ['id', 'codigo', 'almacen', 'descripcion']
                },
                {
                    model: Proveedor,
                    as: 'proveedor',
                    attributes: ['id', 'nombre']
                }
            ],
            order: [['nombre', 'ASC']]
        });

        res.status(200).json({
            success: true,
            data: { tipos }
        });
    } catch (error) {
        console.error('Error al obtener tipos de herramienta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener tipos de herramienta'
        });
    }
};

/**
 * Obtener un tipo por ID con sus unidades
 * GET /api/herramientas-renta/tipos/:id
 */
export const obtenerTipoPorId = async (req, res) => {
    try {
        const { id } = req.params;

        const tipo = await TipoHerramientaRenta.findByPk(id, {
            include: [
                {
                    model: Categoria,
                    as: 'categoria',
                    attributes: ['id', 'nombre']
                },
                {
                    model: Ubicacion,
                    as: 'ubicacion',
                    attributes: ['id', 'codigo', 'almacen', 'descripcion']
                },
                {
                    model: Proveedor,
                    as: 'proveedor',
                    attributes: ['id', 'nombre']
                },
                {
                    model: UnidadHerramientaRenta,
                    as: 'unidades',
                    include: [
                        {
                            model: Usuario,
                            as: 'usuarioAsignado',
                            attributes: ['id', 'nombre', 'email']
                        },
                        {
                            model: Equipo,
                            as: 'equipoAsignado',
                            attributes: ['id', 'nombre']
                        }
                    ]
                }
            ]
        });

        if (!tipo) {
            return res.status(404).json({
                success: false,
                message: 'Tipo de herramienta no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            data: { tipo }
        });
    } catch (error) {
        console.error('Error al obtener tipo de herramienta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener tipo de herramienta'
        });
    }
};

/**
 * Crear un tipo de herramienta + N unidades
 * POST /api/herramientas-renta/tipos
 * Body: { nombre, descripcion, categoria_id, ubicacion_id, proveedor_id, precio_unitario, cantidad_unidades, imagen_url }
 */
export const crearTipo = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const {
            nombre,
            descripcion,
            categoria_id,
            ubicacion_id,
            proveedor_id,
            precio_unitario,
            cantidad_unidades,
            imagen_url,
            prefijo_codigo // Opcional: si no se provee, se genera automáticamente
        } = req.body;

        // Validaciones
        if (!nombre || !categoria_id || !ubicacion_id) {
            return res.status(400).json({
                success: false,
                message: 'Faltan campos requeridos'
            });
        }

        if (!cantidad_unidades || cantidad_unidades < 1) {
            return res.status(400).json({
                success: false,
                message: 'La cantidad de unidades debe ser mayor a 0'
            });
        }

        // Generar prefijo único
        let prefijo = prefijo_codigo;
        if (!prefijo) {
            const prefijoGenerado = generarPrefijo(nombre);
            prefijo = await obtenerPrefijoUnico(prefijoGenerado);
        } else {
            // Verificar que el prefijo provisto no exista
            prefijo = await obtenerPrefijoUnico(prefijo);
        }

        // Crear el tipo
        const nuevoTipo = await TipoHerramientaRenta.create({
            nombre,
            descripcion,
            imagen_url,
            categoria_id,
            ubicacion_id,
            proveedor_id,
            precio_unitario: precio_unitario || 0,
            prefijo_codigo: prefijo,
            total_unidades: cantidad_unidades,
            unidades_disponibles: cantidad_unidades,
            unidades_asignadas: 0
        }, { transaction });

        // Obtener el número inicial para los códigos únicos (una sola vez)
        const ultimaUnidad = await UnidadHerramientaRenta.findOne({
            where: {
                codigo_unico: {
                    [Op.like]: `${prefijo}-%`
                }
            },
            order: [['codigo_unico', 'DESC']]
        });

        let numeroInicial = 1;
        if (ultimaUnidad) {
            const match = ultimaUnidad.codigo_unico.match(/-(\d+)$/);
            if (match) {
                numeroInicial = parseInt(match[1]) + 1;
            }
        }

        // Crear las unidades
        const unidadesCreadas = [];
        for (let i = 0; i < cantidad_unidades; i++) {
            const numeroActual = numeroInicial + i;
            const codigoUnico = `${prefijo}-${numeroActual.toString().padStart(3, '0')}`;
            const codigoEAN13 = generarCodigoEAN13Temporal();

            const unidad = await UnidadHerramientaRenta.create({
                tipo_herramienta_id: nuevoTipo.id,
                codigo_unico: codigoUnico,
                codigo_ean13: codigoEAN13,
                estado: 'disponible',
                activo: true
            }, { transaction });

            unidadesCreadas.push(unidad);
        }

        await transaction.commit();

        // Obtener el tipo completo con las unidades
        const tipoCompleto = await TipoHerramientaRenta.findByPk(nuevoTipo.id, {
            include: [
                {
                    model: UnidadHerramientaRenta,
                    as: 'unidades'
                },
                {
                    model: Categoria,
                    as: 'categoria'
                },
                {
                    model: Ubicacion,
                    as: 'ubicacion'
                },
                {
                    model: Proveedor,
                    as: 'proveedor'
                }
            ]
        });

        res.status(201).json({
            success: true,
            message: `Tipo de herramienta creado con ${cantidad_unidades} unidades`,
            data: { tipo: tipoCompleto }
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error al crear tipo de herramienta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear tipo de herramienta'
        });
    }
};

// ============ CONTROLADORES - UNIDADES ============

/**
 * Obtener unidades de un tipo específico
 * GET /api/herramientas-renta/unidades/:tipoId
 */
export const obtenerUnidadesPorTipo = async (req, res) => {
    try {
        const { tipoId } = req.params;

        const unidades = await UnidadHerramientaRenta.findAll({
            where: {
                tipo_herramienta_id: tipoId,
                activo: true
            },
            include: [
                {
                    model: TipoHerramientaRenta,
                    as: 'tipoHerramienta',
                    attributes: ['id', 'nombre', 'prefijo_codigo']
                },
                {
                    model: Usuario,
                    as: 'usuarioAsignado',
                    attributes: ['id', 'nombre', 'email']
                },
                {
                    model: Equipo,
                    as: 'equipoAsignado',
                    attributes: ['id', 'nombre']
                }
            ],
            order: [['codigo_unico', 'ASC']]
        });

        res.status(200).json({
            success: true,
            data: { unidades }
        });
    } catch (error) {
        console.error('Error al obtener unidades:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener unidades'
        });
    }
};

/**
 * Obtener historial de una unidad
 * GET /api/herramientas-renta/historial/:unidadId
 */
export const obtenerHistorialUnidad = async (req, res) => {
    try {
        const { unidadId } = req.params;

        const historial = await HistorialAsignacionHerramienta.findAll({
            where: { unidad_herramienta_id: unidadId },
            include: [
                {
                    model: Usuario,
                    as: 'usuario',
                    attributes: ['id', 'nombre', 'email']
                },
                {
                    model: Equipo,
                    as: 'equipo',
                    attributes: ['id', 'nombre']
                },
                {
                    model: Usuario,
                    as: 'registradoPor',
                    attributes: ['id', 'nombre']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        res.status(200).json({
            success: true,
            data: { historial }
        });
    } catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener historial'
        });
    }
};

/**
 * Obtener unidades por articulo_id (para mostrar en inventario)
 * GET /api/herramientas-renta/unidades-por-articulo/:articuloId
 */
export const obtenerUnidadesPorArticulo = async (req, res) => {
    try {
        const { articuloId } = req.params;

        // Primero buscar el tipo de herramienta que tiene este artículo como origen
        const tipo = await TipoHerramientaRenta.findOne({
            where: { articulo_origen_id: articuloId, activo: true }
        });

        if (!tipo) {
            return res.status(404).json({
                success: false,
                message: 'No se encontró tipo de herramienta para este artículo'
            });
        }

        // Ahora obtener las unidades de ese tipo
        const unidades = await UnidadHerramientaRenta.findAll({
            where: {
                tipo_herramienta_id: tipo.id,
                activo: true
            },
            include: [
                {
                    model: TipoHerramientaRenta,
                    as: 'tipoHerramienta',
                    attributes: ['id', 'nombre', 'prefijo_codigo']
                },
                {
                    model: Usuario,
                    as: 'usuarioAsignado',
                    attributes: ['id', 'nombre', 'email']
                },
                {
                    model: Equipo,
                    as: 'equipoAsignado',
                    attributes: ['id', 'nombre']
                }
            ],
            order: [['codigo_unico', 'ASC']]
        });

        res.status(200).json({
            success: true,
            data: { unidades, tipo }
        });
    } catch (error) {
        console.error('Error al obtener unidades por artículo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener unidades'
        });
    }
};

// ============ CONTROLADORES - ASIGNACIÓN ============

/**
 * Asignar herramienta a usuario o equipo
 * POST /api/herramientas-renta/asignar
 * Body: { unidad_id, usuario_id?, equipo_id?, observaciones? }
 */
export const asignarHerramienta = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { unidad_id, usuario_id, equipo_id, observaciones } = req.body;
        const usuario_registrador_id = req.usuario.id;

        // Validaciones
        if (!unidad_id) {
            return res.status(400).json({
                success: false,
                message: 'El ID de la unidad es requerido'
            });
        }

        if (!usuario_id && !equipo_id) {
            return res.status(400).json({
                success: false,
                message: 'Debe asignar a un usuario o equipo'
            });
        }

        // Verificar que la unidad existe y está disponible
        const unidad = await UnidadHerramientaRenta.findByPk(unidad_id);

        if (!unidad) {
            return res.status(404).json({
                success: false,
                message: 'Unidad no encontrada'
            });
        }

        if (unidad.estado !== 'disponible') {
            return res.status(400).json({
                success: false,
                message: `La unidad no está disponible. Estado actual: ${unidad.estado}`
            });
        }

        // Actualizar la unidad
        await unidad.update({
            estado: 'asignada',
            usuario_asignado_id: usuario_id || null,
            equipo_asignado_id: equipo_id || null,
            fecha_asignacion: new Date()
        }, { transaction });

        // Registrar en el historial
        await HistorialAsignacionHerramienta.create({
            unidad_herramienta_id: unidad_id,
            usuario_id,
            equipo_id,
            tipo_movimiento: 'asignacion',
            fecha_asignacion: new Date(),
            observaciones,
            registrado_por_usuario_id: usuario_registrador_id
        }, { transaction });

        // Actualizar contadores del tipo
        const tipo = await TipoHerramientaRenta.findByPk(unidad.tipo_herramienta_id);
        await tipo.update({
            unidades_disponibles: tipo.unidades_disponibles - 1,
            unidades_asignadas: tipo.unidades_asignadas + 1
        }, { transaction });

        await transaction.commit();

        // Obtener unidad actualizada con relaciones
        const unidadActualizada = await UnidadHerramientaRenta.findByPk(unidad_id, {
            include: [
                {
                    model: Usuario,
                    as: 'usuarioAsignado'
                },
                {
                    model: Equipo,
                    as: 'equipoAsignado'
                },
                {
                    model: TipoHerramientaRenta,
                    as: 'tipoHerramienta'
                }
            ]
        });

        res.status(200).json({
            success: true,
            message: 'Herramienta asignada correctamente',
            data: { unidad: unidadActualizada }
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error al asignar herramienta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al asignar herramienta'
        });
    }
};

/**
 * Devolver herramienta (marcar como disponible)
 * POST /api/herramientas-renta/devolver/:unidadId
 * Body: { observaciones? }
 */
export const devolverHerramienta = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { unidadId } = req.params;
        const { observaciones } = req.body;
        const usuario_registrador_id = req.usuario.id;

        const unidad = await UnidadHerramientaRenta.findByPk(unidadId);

        if (!unidad) {
            return res.status(404).json({
                success: false,
                message: 'Unidad no encontrada'
            });
        }

        if (unidad.estado !== 'asignada') {
            return res.status(400).json({
                success: false,
                message: `La unidad no está asignada. Estado actual: ${unidad.estado}`
            });
        }

        const fecha_asignacion_original = unidad.fecha_asignacion;
        const usuario_anterior = unidad.usuario_asignado_id;
        const equipo_anterior = unidad.equipo_asignado_id;

        // Actualizar la unidad
        await unidad.update({
            estado: 'disponible',
            usuario_asignado_id: null,
            equipo_asignado_id: null,
            fecha_asignacion: null
        }, { transaction });

        // Registrar en el historial
        await HistorialAsignacionHerramienta.create({
            unidad_herramienta_id: unidadId,
            usuario_id: usuario_anterior,
            equipo_id: equipo_anterior,
            tipo_movimiento: 'devolucion',
            fecha_asignacion: fecha_asignacion_original,
            fecha_devolucion: new Date(),
            observaciones,
            registrado_por_usuario_id: usuario_registrador_id
        }, { transaction });

        // Actualizar contadores del tipo
        const tipo = await TipoHerramientaRenta.findByPk(unidad.tipo_herramienta_id);
        await tipo.update({
            unidades_disponibles: tipo.unidades_disponibles + 1,
            unidades_asignadas: tipo.unidades_asignadas - 1
        }, { transaction });

        await transaction.commit();

        // Obtener unidad actualizada
        const unidadActualizada = await UnidadHerramientaRenta.findByPk(unidadId, {
            include: [
                {
                    model: TipoHerramientaRenta,
                    as: 'tipoHerramienta'
                }
            ]
        });

        res.status(200).json({
            success: true,
            message: 'Herramienta devuelta correctamente',
            data: { unidad: unidadActualizada }
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Error al devolver herramienta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al devolver herramienta'
        });
    }
};

/**
 * Obtener herramientas asignadas a un usuario
 * GET /api/herramientas-renta/por-usuario/:usuarioId
 */
export const obtenerHerramientasPorUsuario = async (req, res) => {
    try {
        const { usuarioId } = req.params;

        const herramientas = await UnidadHerramientaRenta.findAll({
            where: {
                usuario_asignado_id: usuarioId,
                estado: 'asignada',
                activo: true
            },
            include: [
                {
                    model: TipoHerramientaRenta,
                    as: 'tipoHerramienta',
                    include: [
                        {
                            model: Categoria,
                            as: 'categoria'
                        }
                    ]
                }
            ]
        });

        res.status(200).json({
            success: true,
            data: { herramientas }
        });
    } catch (error) {
        console.error('Error al obtener herramientas por usuario:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener herramientas por usuario'
        });
    }
};

/**
 * Obtener herramientas asignadas a un equipo
 * GET /api/herramientas-renta/por-equipo/:equipoId
 */
export const obtenerHerramientasPorEquipo = async (req, res) => {
    try {
        const { equipoId } = req.params;

        const herramientas = await UnidadHerramientaRenta.findAll({
            where: {
                equipo_asignado_id: equipoId,
                estado: 'asignada',
                activo: true
            },
            include: [
                {
                    model: TipoHerramientaRenta,
                    as: 'tipoHerramienta',
                    include: [
                        {
                            model: Categoria,
                            as: 'categoria'
                        }
                    ]
                },
                {
                    model: Usuario,
                    as: 'usuarioAsignado'
                }
            ]
        });

        res.status(200).json({
            success: true,
            data: { herramientas }
        });
    } catch (error) {
        console.error('Error al obtener herramientas por equipo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener herramientas por equipo'
        });
    }
};

// ============ CÓDIGOS DE BARRAS ============

/**
 * Generar código EAN-13 para una unidad de herramienta
 * POST /api/herramientas-renta/unidades/:unidadId/generar-ean13
 */
export const generarCodigoEAN13Unidad = async (req, res) => {
    try {
        const { unidadId } = req.params;

        const unidad = await UnidadHerramientaRenta.findByPk(unidadId);

        if (!unidad) {
            return res.status(404).json({
                success: false,
                message: 'Unidad no encontrada'
            });
        }

        // Si ya tiene código, no generar uno nuevo
        if (unidad.codigo_ean13) {
            return res.status(400).json({
                success: false,
                message: 'Esta unidad ya tiene un código EAN-13 asignado',
                data: { codigo_ean13: unidad.codigo_ean13 }
            });
        }

        // Generar código EAN-13 basado en el ID de la unidad
        const codigoEAN13 = generarCodigoEAN13(unidad.id);

        // Actualizar unidad
        await unidad.update({ codigo_ean13: codigoEAN13 });

        res.status(200).json({
            success: true,
            message: 'Código EAN-13 generado exitosamente',
            data: {
                unidad_id: unidad.id,
                codigo_unico: unidad.codigo_unico,
                codigo_ean13: codigoEAN13
            }
        });
    } catch (error) {
        console.error('Error al generar código EAN-13:', error);
        res.status(500).json({
            success: false,
            message: 'Error al generar código EAN-13'
        });
    }
};

/**
 * Generar códigos EAN-13 para todas las unidades de un tipo
 * POST /api/herramientas-renta/tipos/:tipoId/generar-codigos-masivo
 */
export const generarCodigosMasivos = async (req, res) => {
    try {
        const { tipoId } = req.params;

        // Obtener todas las unidades del tipo que no tienen código EAN-13
        const unidades = await UnidadHerramientaRenta.findAll({
            where: {
                tipo_herramienta_id: tipoId,
                codigo_ean13: null,
                activo: true
            }
        });

        if (unidades.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'Todas las unidades ya tienen código EAN-13 asignado',
                data: { generados: 0 }
            });
        }

        // Generar códigos para cada unidad
        const transaction = await sequelize.transaction();

        try {
            for (const unidad of unidades) {
                const codigoEAN13 = generarCodigoEAN13(unidad.id);
                await unidad.update({ codigo_ean13: codigoEAN13 }, { transaction });
            }

            await transaction.commit();

            res.status(200).json({
                success: true,
                message: `Se generaron ${unidades.length} códigos EAN-13 exitosamente`,
                data: { generados: unidades.length }
            });
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error al generar códigos masivos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al generar códigos masivos'
        });
    }
};

/**
 * Obtener imagen PNG del código de barras de una unidad
 * GET /api/herramientas-renta/unidades/:unidadId/barcode
 */
export const obtenerCodigoBarras = async (req, res) => {
    try {
        const { unidadId } = req.params;

        const unidad = await UnidadHerramientaRenta.findByPk(unidadId, {
            include: [{
                model: TipoHerramientaRenta,
                as: 'tipoHerramienta',
                attributes: ['nombre', 'prefijo_codigo']
            }]
        });

        if (!unidad) {
            return res.status(404).json({
                success: false,
                message: 'Unidad no encontrada'
            });
        }

        // Si no tiene código EAN-13, generarlo automáticamente
        if (!unidad.codigo_ean13) {
            const codigoEAN13 = generarCodigoEAN13(unidad.id);
            await unidad.update({ codigo_ean13: codigoEAN13 });
            unidad.codigo_ean13 = codigoEAN13;
        }

        // Generar imagen del código de barras
        const imagenBuffer = await generarImagenCodigoBarras(unidad.codigo_ean13, 'EAN13');

        // Configurar headers para imagen PNG
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `inline; filename="barcode-${unidad.codigo_unico}.png"`);
        res.send(imagenBuffer);

    } catch (error) {
        console.error('Error al generar código de barras:', error);
        res.status(500).json({
            success: false,
            message: 'Error al generar código de barras',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Obtener imagen SVG del código de barras de una unidad
 * GET /api/herramientas-renta/unidades/:unidadId/barcode-svg
 */
export const obtenerCodigoBarrasSVG = async (req, res) => {
    try {
        const { unidadId } = req.params;

        const unidad = await UnidadHerramientaRenta.findByPk(unidadId);

        if (!unidad) {
            return res.status(404).json({
                success: false,
                message: 'Unidad no encontrada'
            });
        }

        // Si no tiene código EAN-13, generarlo automáticamente
        if (!unidad.codigo_ean13) {
            const codigoEAN13 = generarCodigoEAN13(unidad.id);
            await unidad.update({ codigo_ean13: codigoEAN13 });
            unidad.codigo_ean13 = codigoEAN13;
        }

        // Generar SVG del código de barras
        const svg = await generarSVGCodigoBarras(unidad.codigo_ean13, 'EAN13');

        // Configurar headers para SVG
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Content-Disposition', `inline; filename="barcode-${unidad.codigo_unico}.svg"`);
        res.send(svg);

    } catch (error) {
        console.error('Error al generar código de barras SVG:', error);
        res.status(500).json({
            success: false,
            message: 'Error al generar código de barras SVG',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
