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
import { migrarArticulosPendientes } from '../utils/autoMigrate.js';

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
                },
                {
                    model: Articulo,
                    as: 'articuloOrigen',
                    attributes: ['id', 'nombre', 'imagen_url'],
                    required: false
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
                    where: { activo: true },
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
                condicion: 'bueno',
                estatus: 'disponible',
                estado: 'buen_estado', // DEPRECATED: mantener para compatibilidad
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
        const { unidad_id, usuario_id, equipo_id, observaciones, fecha_vencimiento } = req.body;
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

        // Verificar disponibilidad usando el nuevo campo estatus
        if (unidad.estatus === 'asignado') {
            return res.status(400).json({
                success: false,
                message: `La unidad ya está asignada`
            });
        }

        // Actualizar la unidad - Solo cambiar estatus, preservar condicion
        await unidad.update({
            estatus: 'asignado',
            estado: 'asignada', // DEPRECATED: mantener para compatibilidad
            usuario_asignado_id: usuario_id || null,
            equipo_asignado_id: equipo_id || null,
            fecha_asignacion: new Date(),
            fecha_vencimiento_asignacion: fecha_vencimiento || null
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

        // Verificar que esté asignada usando el nuevo campo estatus
        if (unidad.estatus !== 'asignado') {
            return res.status(400).json({
                success: false,
                message: `La unidad no está asignada. Estatus actual: ${unidad.estatus}`
            });
        }

        const fecha_asignacion_original = unidad.fecha_asignacion;
        const usuario_anterior = unidad.usuario_asignado_id;
        const equipo_anterior = unidad.equipo_asignado_id;

        // Actualizar la unidad - Solo cambiar estatus a disponible, preservar condicion
        await unidad.update({
            estatus: 'disponible',
            estado: 'buen_estado', // DEPRECATED: mantener para compatibilidad
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

        // Actualizar unidad y marcar como etiquetado
        await unidad.update({
            codigo_ean13: codigoEAN13,
            etiquetado: true
        });

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
                await unidad.update({
                    codigo_ean13: codigoEAN13,
                    etiquetado: true
                }, { transaction });
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
 * Obtener imagen PNG del código QR de una unidad de herramienta
 * GET /api/herramientas-renta/unidades/:unidadId/barcode
 * CAMBIADO: Ahora genera código QR en lugar de código de barras EAN13
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

        // Generar código QR con el código único de la unidad (ej: PP-001, AT-002)
        // En lugar de usar EAN13, usamos el codigo_unico que es más descriptivo
        const imagenBuffer = await generarImagenCodigoBarras(unidad.codigo_unico, 'QRCODE');

        // Configurar headers para imagen PNG
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `inline; filename="qrcode-${unidad.codigo_unico}.png"`);
        res.send(imagenBuffer);

    } catch (error) {
        console.error('Error al generar código QR:', error);
        res.status(500).json({
            success: false,
            message: 'Error al generar código QR',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Obtener imagen SVG del código QR de una unidad de herramienta
 * GET /api/herramientas-renta/unidades/:unidadId/barcode-svg
 * CAMBIADO: Ahora genera código QR en lugar de código de barras EAN13
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

        // Generar SVG del código QR con el código único (ej: PP-001, AT-002)
        const svg = await generarSVGCodigoBarras(unidad.codigo_unico, 'QRCODE');

        // Configurar headers para SVG
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Content-Disposition', `inline; filename="qrcode-${unidad.codigo_unico}.svg"`);
        res.send(svg);

    } catch (error) {
        console.error('Error al generar código QR SVG:', error);
        res.status(500).json({
            success: false,
            message: 'Error al generar código QR SVG',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============ MIGRACIÓN MANUAL ============

/**
 * Ejecutar migración manual de artículos pendientes
 * POST /api/herramientas-renta/migrar-pendientes
 * Acceso: Solo administrador
 */
export const ejecutarMigracionManual = async (req, res) => {
    try {
        console.log('🚀 Ejecutando migración manual de artículos pendientes...');

        const resultado = await migrarArticulosPendientes();

        if (resultado.error) {
            return res.status(500).json({
                success: false,
                message: 'Error al ejecutar la migración',
                error: resultado.error
            });
        }

        res.status(200).json({
            success: true,
            message: resultado.mensaje || 'Migración completada',
            data: {
                articulos_migrados: resultado.migrados || 0,
                unidades_creadas: resultado.unidades || 0
            }
        });
    } catch (error) {
        console.error('Error al ejecutar migración manual:', error);
        res.status(500).json({
            success: false,
            message: 'Error al ejecutar migración manual',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * GET /api/herramientas-renta/unidades-todas
 * Obtener todas las unidades de herramientas con paginación completa
 */
export const obtenerTodasLasUnidades = async (req, res) => {
    try {
        const {
            activo = 'true',
            limit = 50,
            page = 1,
            offset
        } = req.query;

        const whereClause = {};
        if (activo !== 'all') {
            whereClause.activo = activo === 'true';
        }

        // Calcular offset
        const calculatedOffset = offset !== undefined
            ? parseInt(offset)
            : (parseInt(page) - 1) * parseInt(limit);

        // Obtener total de registros
        const total = await UnidadHerramientaRenta.count({ where: whereClause });

        // Obtener unidades con paginación
        const unidades = await UnidadHerramientaRenta.findAll({
            where: whereClause,
            include: [{
                model: TipoHerramientaRenta,
                as: 'tipoHerramienta',
                attributes: ['id', 'nombre', 'descripcion', 'imagen_url', 'prefijo_codigo']
            }],
            limit: parseInt(limit),
            offset: calculatedOffset,
            order: [['codigo_unico', 'ASC']]
        });

        res.json({
            success: true,
            data: {
                unidades,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    hasMore: calculatedOffset + unidades.length < total
                }
            }
        });

    } catch (error) {
        console.error('Error al obtener todas las unidades:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener unidades',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * PUT /api/herramientas-renta/unidades/:id/cambiar-estado
 * Cambiar la condición y/o estatus de una unidad de herramienta
 * Body: { condicion?, estatus?, motivo? }
 * 
 * REFACTORIZADO: Ahora maneja condicion y estatus por separado
 * - condicion: estado físico (bueno, regular, malo, perdido, baja)
 * - estatus: disponibilidad (disponible, asignado, en_reparacion, en_transito)
 */
export const cambiarEstadoUnidad = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { id } = req.params;
        const { condicion, estatus, estado, motivo } = req.body;

        // Definir valores válidos
        const condicionesValidas = ['bueno', 'regular', 'malo', 'perdido', 'baja'];
        const estatusValidos = ['disponible', 'asignado', 'en_reparacion', 'en_transito'];

        // Compatibilidad con el campo antiguo 'estado'
        let nuevaCondicion = condicion;
        let nuevoEstatus = estatus;

        if (estado && !condicion && !estatus) {
            // Convertir estado antiguo a nuevos campos
            const mapeoCondicion = {
                'buen_estado': 'bueno',
                'estado_regular': 'regular',
                'mal_estado': 'malo',
                'perdida': 'perdido',
                'baja': 'baja'
            };
            const mapeoEstatus = {
                'asignada': 'asignado',
                'disponible': 'disponible',
                'en_reparacion': 'en_reparacion',
                'en_transito': 'en_transito',
                'pendiente_devolucion': 'asignado'
            };

            if (mapeoCondicion[estado]) {
                nuevaCondicion = mapeoCondicion[estado];
            }
            if (mapeoEstatus[estado]) {
                nuevoEstatus = mapeoEstatus[estado];
            }
        }

        // Validar campos si se proporcionan
        if (nuevaCondicion && !condicionesValidas.includes(nuevaCondicion)) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Condición inválida. Debe ser una de: ${condicionesValidas.join(', ')}`
            });
        }

        if (nuevoEstatus && !estatusValidos.includes(nuevoEstatus)) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Estatus inválido. Debe ser uno de: ${estatusValidos.join(', ')}`
            });
        }

        // Buscar la unidad
        const unidad = await UnidadHerramientaRenta.findByPk(id, {
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
            transaction
        });

        if (!unidad) {
            await transaction.rollback();
            return res.status(404).json({
                success: false,
                message: 'Unidad no encontrada'
            });
        }

        const condicionAnterior = unidad.condicion;
        const estatusAnterior = unidad.estatus;

        // Si está pasando de asignado a cualquier otro estatus, limpiar asignación
        if (estatusAnterior === 'asignado' && nuevoEstatus && nuevoEstatus !== 'asignado') {
            const usuarioAnterior = unidad.usuario_asignado_id;
            const equipoAnterior = unidad.equipo_asignado_id;
            const fechaAsignacionOriginal = unidad.fecha_asignacion;

            // Limpiar asignación
            unidad.usuario_asignado_id = null;
            unidad.equipo_asignado_id = null;
            unidad.fecha_asignacion = null;
            unidad.fecha_vencimiento_asignacion = null;

            // Registrar devolución en historial
            await HistorialAsignacionHerramienta.create({
                unidad_herramienta_id: unidad.id,
                usuario_id: usuarioAnterior,
                equipo_id: equipoAnterior,
                tipo_movimiento: 'devolucion',
                fecha_asignacion: fechaAsignacionOriginal,
                fecha_devolucion: new Date(),
                observaciones: motivo || `Cambio de estatus a ${nuevoEstatus}`,
                registrado_por_usuario_id: req.usuario.id
            }, { transaction });

            // Actualizar contadores del tipo
            await TipoHerramientaRenta.update(
                {
                    unidades_disponibles: sequelize.literal('unidades_disponibles + 1'),
                    unidades_asignadas: sequelize.literal('unidades_asignadas - 1')
                },
                {
                    where: { id: unidad.tipo_herramienta_id },
                    transaction
                }
            );
        }

        // Actualizar campos
        if (nuevaCondicion) {
            unidad.condicion = nuevaCondicion;
        }
        if (nuevoEstatus) {
            unidad.estatus = nuevoEstatus;
        }

        // Actualizar campo deprecated para compatibilidad
        const mapeoEstadoDeprecado = {
            'bueno': 'buen_estado',
            'regular': 'estado_regular',
            'malo': 'mal_estado',
            'perdido': 'perdida',
            'baja': 'baja'
        };
        if (nuevaCondicion) {
            unidad.estado = mapeoEstadoDeprecado[nuevaCondicion] || 'buen_estado';
        }
        if (nuevoEstatus === 'asignado') {
            unidad.estado = 'asignada';
        }

        unidad.motivo_estado = motivo || null;
        unidad.fecha_cambio_estado = new Date();
        await unidad.save({ transaction });

        // Registrar en historial si es un cambio significativo de condición
        if (nuevaCondicion && ['perdido', 'baja', 'malo'].includes(nuevaCondicion)) {
            await HistorialAsignacionHerramienta.create({
                unidad_herramienta_id: unidad.id,
                usuario_id: unidad.usuario_asignado_id,
                equipo_id: unidad.equipo_asignado_id,
                tipo_movimiento: nuevaCondicion === 'perdido' ? 'perdida' : nuevaCondicion,
                fecha_asignacion: new Date(),
                observaciones: motivo || `Cambio de condición de ${condicionAnterior} a ${nuevaCondicion}`,
                registrado_por_usuario_id: req.usuario.id
            }, { transaction });
        }

        await transaction.commit();

        res.json({
            success: true,
            message: `Actualizado: condición "${condicionAnterior}" → "${unidad.condicion}", estatus "${estatusAnterior}" → "${unidad.estatus}"`,
            data: {
                unidad: await UnidadHerramientaRenta.findByPk(id, {
                    include: [
                        { model: TipoHerramientaRenta, as: 'tipoHerramienta' },
                        { model: Usuario, as: 'usuarioAsignado', attributes: ['id', 'nombre'] },
                        { model: Equipo, as: 'equipoAsignado', attributes: ['id', 'nombre'] }
                    ]
                })
            }
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Error al cambiar estado de unidad:', error);
        res.status(500).json({
            success: false,
            message: 'Error al cambiar estado de la unidad',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * POST /api/herramientas-renta/sincronizar-todas
 * Sincroniza TODAS las unidades de herramientas con el stock_actual de sus artículos
 * Útil para corregir discrepancias existentes
 */
export const sincronizarTodasLasUnidades = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        console.log('🔄 Iniciando sincronización de todas las herramientas...');

        // Obtener todos los tipos de herramientas activos
        const tipos = await TipoHerramientaRenta.findAll({
            where: { activo: true },
            include: [{
                model: Articulo,
                as: 'articuloOrigen',
                where: { es_herramienta: true, activo: true },
                required: true
            }],
            transaction
        });

        console.log(`📦 Encontrados ${tipos.length} tipos de herramientas para sincronizar`);

        const resultados = [];

        for (const tipo of tipos) {
            const articulo = tipo.articuloOrigen;
            const stockActual = parseInt(articulo.stock_actual);

            // Contar unidades activas
            const unidadesActivas = await UnidadHerramientaRenta.count({
                where: { tipo_herramienta_id: tipo.id, activo: true },
                transaction
            });

            const diferencia = stockActual - unidadesActivas;

            console.log(`\n📋 ${articulo.nombre} (${tipo.prefijo_codigo})`);
            console.log(`   Stock: ${stockActual} | Unidades: ${unidadesActivas} | Diferencia: ${diferencia}`);

            if (diferencia === 0) {
                console.log(`   ✅ Ya está sincronizado`);
                resultados.push({
                    articulo_id: articulo.id,
                    nombre: articulo.nombre,
                    prefijo: tipo.prefijo_codigo,
                    accion: 'sin_cambios',
                    stock: stockActual,
                    unidades: unidadesActivas
                });
                continue;
            }

            if (diferencia > 0) {
                // CREAR nuevas unidades
                const prefijo = tipo.prefijo_codigo;

                // Obtener el último número usado
                const ultimaUnidad = await UnidadHerramientaRenta.findOne({
                    where: { codigo_unico: { [Op.like]: `${prefijo}-%` } },
                    order: [['codigo_unico', 'DESC']],
                    transaction
                });

                let numeroInicial = 1;
                if (ultimaUnidad) {
                    const match = ultimaUnidad.codigo_unico.match(/-(\d+)$/);
                    if (match) {
                        numeroInicial = parseInt(match[1]) + 1;
                    }
                }

                const unidadesCreadas = [];
                for (let i = 0; i < diferencia; i++) {
                    const numeroActual = numeroInicial + i;
                    const codigoUnico = `${prefijo}-${numeroActual.toString().padStart(3, '0')}`;

                    await UnidadHerramientaRenta.create({
                        tipo_herramienta_id: tipo.id,
                        codigo_unico: codigoUnico,
                        codigo_ean13: null,
                        estado: 'buen_estado',
                        activo: true
                    }, { transaction });

                    unidadesCreadas.push(codigoUnico);
                    console.log(`   ✅ Creada: ${codigoUnico}`);
                }

                // Actualizar contadores
                await tipo.update({
                    total_unidades: stockActual,
                    unidades_disponibles: tipo.unidades_disponibles + diferencia
                }, { transaction });

                resultados.push({
                    articulo_id: articulo.id,
                    nombre: articulo.nombre,
                    prefijo: tipo.prefijo_codigo,
                    accion: 'creadas',
                    cantidad: diferencia,
                    unidades_creadas: unidadesCreadas,
                    stock: stockActual,
                    unidades_antes: unidadesActivas,
                    unidades_despues: stockActual
                });

            } else {
                // DESACTIVAR unidades sobrantes
                const unidadesSobran = Math.abs(diferencia);

                const unidadesParaDesactivar = await UnidadHerramientaRenta.findAll({
                    where: {
                        tipo_herramienta_id: tipo.id,
                        activo: true,
                        estado: { [Op.ne]: 'asignada' }
                    },
                    order: [['id', 'DESC']],
                    limit: unidadesSobran,
                    transaction
                });

                const unidadesDesactivadas = [];
                for (const unidad of unidadesParaDesactivar) {
                    await unidad.update({
                        activo: false,
                        observaciones: `Desactivada en sincronización masiva (stock: ${stockActual}, unidades activas: ${unidadesActivas})`
                    }, { transaction });

                    unidadesDesactivadas.push(unidad.codigo_unico);
                    console.log(`   ❌ Desactivada: ${unidad.codigo_unico}`);
                }

                // Actualizar contadores
                const unidadesDisponiblesRestantes = Math.max(0, tipo.unidades_disponibles - unidadesParaDesactivar.length);
                await tipo.update({
                    total_unidades: stockActual,
                    unidades_disponibles: unidadesDisponiblesRestantes
                }, { transaction });

                resultados.push({
                    articulo_id: articulo.id,
                    nombre: articulo.nombre,
                    prefijo: tipo.prefijo_codigo,
                    accion: 'desactivadas',
                    cantidad: unidadesParaDesactivar.length,
                    unidades_desactivadas: unidadesDesactivadas,
                    stock: stockActual,
                    unidades_antes: unidadesActivas,
                    unidades_despues: stockActual
                });
            }
        }

        await transaction.commit();

        console.log('\n✅ Sincronización completada exitosamente');

        res.status(200).json({
            success: true,
            message: `Sincronización completada. ${resultados.length} artículos procesados`,
            data: {
                total_procesados: resultados.length,
                sin_cambios: resultados.filter(r => r.accion === 'sin_cambios').length,
                unidades_creadas: resultados.filter(r => r.accion === 'creadas').length,
                unidades_desactivadas: resultados.filter(r => r.accion === 'desactivadas').length,
                detalles: resultados
            }
        });

    } catch (error) {
        await transaction.rollback();
        console.error('❌ Error en sincronización masiva:', error);
        res.status(500).json({
            success: false,
            message: 'Error al sincronizar unidades de herramientas',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
