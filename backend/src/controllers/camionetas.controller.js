import { Camioneta, Usuario, Ubicacion, StockMinimoCamioneta, TipoHerramientaRenta, UnidadHerramientaRenta } from '../models/index.js';

// Obtener todas las camionetas
export const obtenerCamionetas = async (req, res) => {
    try {
        const camionetas = await Camioneta.findAll({
            include: [
                {
                    model: Usuario,
                    as: 'encargado',
                    attributes: ['id', 'nombre', 'email', 'puesto']
                },
                {
                    model: Ubicacion,
                    as: 'almacenBase',
                    attributes: ['id', 'codigo', 'almacen', 'descripcion'],
                    required: false
                }
            ],
            order: [['nombre', 'ASC']]
        });

        res.status(200).json({
            success: true,
            data: { camionetas }
        });
    } catch (error) {
        console.error('Error al obtener camionetas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener camionetas'
        });
    }
};

// Obtener una camioneta por ID
export const obtenerCamionetaPorId = async (req, res) => {
    try {
        const { id } = req.params;

        const camioneta = await Camioneta.findByPk(id, {
            include: [
                {
                    model: Usuario,
                    as: 'encargado',
                    attributes: ['id', 'nombre', 'email', 'puesto']
                },
                {
                    model: Ubicacion,
                    as: 'almacenBase',
                    attributes: ['id', 'codigo', 'almacen', 'descripcion'],
                    required: false
                }
            ]
        });

        if (!camioneta) {
            return res.status(404).json({
                success: false,
                message: 'Camioneta no encontrada'
            });
        }

        res.status(200).json({
            success: true,
            data: { camioneta }
        });
    } catch (error) {
        console.error('Error al obtener camioneta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener camioneta'
        });
    }
};

// Crear una camioneta
export const crearCamioneta = async (req, res) => {
    try {
        const { nombre, descripcion, encargado_id, matricula, tipo_camioneta, almacen_base_id } = req.body;

        // Validaciones
        if (!nombre || !encargado_id) {
            return res.status(400).json({
                success: false,
                message: 'El nombre y encargado_id son requeridos'
            });
        }

        // Verificar que el encargado existe y tiene rol de encargado
        const encargado = await Usuario.findByPk(encargado_id);
        if (!encargado) {
            return res.status(404).json({
                success: false,
                message: 'Encargado no encontrado'
            });
        }

        if (encargado.rol !== 'encargado' && encargado.rol !== 'administrador') {
            return res.status(400).json({
                success: false,
                message: 'El usuario debe tener rol de encargado o administrador'
            });
        }

        // Verificar que el encargado no esté ya asignado a otra camioneta activa
        const camionetaExistente = await Camioneta.findOne({
            where: {
                encargado_id,
                activo: true
            }
        });

        if (camionetaExistente) {
            return res.status(400).json({
                success: false,
                message: `Este encargado ya está asignado a la camioneta "${camionetaExistente.nombre}"`
            });
        }

        // Validar matrícula única si se proporciona
        if (matricula) {
            const matriculaExistente = await Camioneta.findOne({
                where: { matricula }
            });

            if (matriculaExistente) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe una camioneta con esa matrícula'
                });
            }
        }

        // Validar tipo_camioneta
        const tiposValidos = ['instalacion', 'mantenimiento', 'supervision', 'general'];
        if (tipo_camioneta && !tiposValidos.includes(tipo_camioneta)) {
            return res.status(400).json({
                success: false,
                message: `Tipo de camioneta inválido. Debe ser uno de: ${tiposValidos.join(', ')}`
            });
        }

        // Validar almacen_base_id si se proporciona
        if (almacen_base_id) {
            const almacen = await Ubicacion.findByPk(almacen_base_id);
            if (!almacen) {
                return res.status(404).json({
                    success: false,
                    message: 'Almacén base no encontrado'
                });
            }
        }

        const camioneta = await Camioneta.create({
            nombre,
            descripcion,
            encargado_id,
            matricula,
            tipo_camioneta: tipo_camioneta || 'general',
            almacen_base_id
        });

        const camionetaCompleta = await Camioneta.findByPk(camioneta.id, {
            include: [
                {
                    model: Usuario,
                    as: 'encargado',
                    attributes: ['id', 'nombre', 'email', 'puesto']
                },
                {
                    model: Ubicacion,
                    as: 'almacenBase',
                    attributes: ['id', 'codigo', 'almacen', 'descripcion'],
                    required: false
                }
            ]
        });

        res.status(201).json({
            success: true,
            message: 'Camioneta creada exitosamente',
            data: { camioneta: camionetaCompleta }
        });
    } catch (error) {
        console.error('Error al crear camioneta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear camioneta'
        });
    }
};

// Actualizar una camioneta
export const actualizarCamioneta = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, encargado_id, activo, matricula, tipo_camioneta, almacen_base_id } = req.body;

        const camioneta = await Camioneta.findByPk(id);
        if (!camioneta) {
            return res.status(404).json({
                success: false,
                message: 'Camioneta no encontrada'
            });
        }

        // Si se va a cambiar el encargado, validar
        if (encargado_id && encargado_id !== camioneta.encargado_id) {
            const encargado = await Usuario.findByPk(encargado_id);
            if (!encargado) {
                return res.status(404).json({
                    success: false,
                    message: 'Encargado no encontrado'
                });
            }

            if (encargado.rol !== 'encargado' && encargado.rol !== 'administrador') {
                return res.status(400).json({
                    success: false,
                    message: 'El usuario debe tener rol de encargado o administrador'
                });
            }

            // Verificar que el encargado no esté ya asignado a otra camioneta activa
            const camionetaExistente = await Camioneta.findOne({
                where: {
                    encargado_id,
                    activo: true
                }
            });

            if (camionetaExistente && camionetaExistente.id !== parseInt(id)) {
                return res.status(400).json({
                    success: false,
                    message: `Este encargado ya está asignado a la camioneta "${camionetaExistente.nombre}"`
                });
            }
        }

        // Validar matrícula única si se proporciona y cambió
        if (matricula && matricula !== camioneta.matricula) {
            const matriculaExistente = await Camioneta.findOne({
                where: { matricula }
            });

            if (matriculaExistente) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe una camioneta con esa matrícula'
                });
            }
        }

        // Validar tipo_camioneta
        const tiposValidos = ['instalacion', 'mantenimiento', 'supervision', 'general'];
        if (tipo_camioneta && !tiposValidos.includes(tipo_camioneta)) {
            return res.status(400).json({
                success: false,
                message: `Tipo de camioneta inválido. Debe ser uno de: ${tiposValidos.join(', ')}`
            });
        }

        // Validar almacen_base_id si se proporciona
        if (almacen_base_id) {
            const almacen = await Ubicacion.findByPk(almacen_base_id);
            if (!almacen) {
                return res.status(404).json({
                    success: false,
                    message: 'Almacén base no encontrado'
                });
            }
        }

        await camioneta.update({
            nombre: nombre || camioneta.nombre,
            descripcion: descripcion !== undefined ? descripcion : camioneta.descripcion,
            encargado_id: encargado_id || camioneta.encargado_id,
            activo: activo !== undefined ? activo : camioneta.activo,
            matricula: matricula !== undefined ? matricula : camioneta.matricula,
            tipo_camioneta: tipo_camioneta || camioneta.tipo_camioneta,
            almacen_base_id: almacen_base_id !== undefined ? almacen_base_id : camioneta.almacen_base_id
        });

        const camionetaActualizada = await Camioneta.findByPk(id, {
            include: [
                {
                    model: Usuario,
                    as: 'encargado',
                    attributes: ['id', 'nombre', 'email', 'puesto']
                },
                {
                    model: Ubicacion,
                    as: 'almacenBase',
                    attributes: ['id', 'codigo', 'almacen', 'descripcion'],
                    required: false
                }
            ]
        });

        res.status(200).json({
            success: true,
            message: 'Camioneta actualizada exitosamente',
            data: { camioneta: camionetaActualizada }
        });
    } catch (error) {
        console.error('Error al actualizar camioneta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar camioneta'
        });
    }
};

// Eliminar (desactivar) una camioneta
export const eliminarCamioneta = async (req, res) => {
    try {
        const { id } = req.params;

        const camioneta = await Camioneta.findByPk(id);
        if (!camioneta) {
            return res.status(404).json({
                success: false,
                message: 'Camioneta no encontrada'
            });
        }

        // Desactivar en lugar de eliminar
        await camioneta.update({ activo: false });

        res.status(200).json({
            success: true,
            message: 'Camioneta desactivada exitosamente'
        });
    } catch (error) {
        console.error('Error al eliminar camioneta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar camioneta'
        });
    }
};

// Obtener camionetas de un encargado específico
export const obtenerCamionetasPorEncargado = async (req, res) => {
    try {
        const { encargadoId } = req.params;

        const camionetas = await Camioneta.findAll({
            where: {
                encargado_id: encargadoId,
                activo: true
            },
            include: [
                {
                    model: Usuario,
                    as: 'encargado',
                    attributes: ['id', 'nombre', 'email', 'puesto']
                },
                {
                    model: Ubicacion,
                    as: 'almacenBase',
                    attributes: ['id', 'codigo', 'almacen', 'descripcion'],
                    required: false
                }
            ],
            order: [['nombre', 'ASC']]
        });

        res.status(200).json({
            success: true,
            data: { camionetas }
        });
    } catch (error) {
        console.error('Error al obtener camionetas por encargado:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener camionetas'
        });
    }
};

// ============================================
// GESTIÓN DE STOCK MÍNIMO
// ============================================

// Obtener stock mínimo de una camioneta
export const obtenerStockMinimo = async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar que la camioneta existe
        const camioneta = await Camioneta.findByPk(id);
        if (!camioneta) {
            return res.status(404).json({
                success: false,
                message: 'Camioneta no encontrada'
            });
        }

        const stockMinimo = await StockMinimoCamioneta.findAll({
            where: { camioneta_id: id },
            include: [
                {
                    model: TipoHerramientaRenta,
                    as: 'tipoHerramienta',
                    attributes: ['id', 'nombre', 'descripcion', 'prefijo_codigo', 'total_unidades', 'unidades_disponibles']
                }
            ],
            order: [[{ model: TipoHerramientaRenta, as: 'tipoHerramienta' }, 'nombre', 'ASC']]
        });

        res.status(200).json({
            success: true,
            data: { stockMinimo }
        });
    } catch (error) {
        console.error('Error al obtener stock mínimo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener stock mínimo'
        });
    }
};

// Configurar stock mínimo de una camioneta
export const configurarStockMinimo = async (req, res) => {
    try {
        const { id } = req.params;
        const { tipo_herramienta_id, cantidad_minima, observaciones } = req.body;

        // Validaciones
        if (!tipo_herramienta_id || !cantidad_minima) {
            return res.status(400).json({
                success: false,
                message: 'tipo_herramienta_id y cantidad_minima son requeridos'
            });
        }

        if (cantidad_minima <= 0) {
            return res.status(400).json({
                success: false,
                message: 'La cantidad mínima debe ser mayor a 0'
            });
        }

        // Verificar que la camioneta existe
        const camioneta = await Camioneta.findByPk(id);
        if (!camioneta) {
            return res.status(404).json({
                success: false,
                message: 'Camioneta no encontrada'
            });
        }

        // Verificar que el tipo de herramienta existe
        const tipoHerramienta = await TipoHerramientaRenta.findByPk(tipo_herramienta_id);
        if (!tipoHerramienta) {
            return res.status(404).json({
                success: false,
                message: 'Tipo de herramienta no encontrado'
            });
        }

        // Crear o actualizar el stock mínimo
        const [stockMinimo, created] = await StockMinimoCamioneta.findOrCreate({
            where: {
                camioneta_id: id,
                tipo_herramienta_id
            },
            defaults: {
                cantidad_minima,
                observaciones
            }
        });

        if (!created) {
            await stockMinimo.update({
                cantidad_minima,
                observaciones: observaciones !== undefined ? observaciones : stockMinimo.observaciones
            });
        }

        const stockMinimoCompleto = await StockMinimoCamioneta.findByPk(stockMinimo.id, {
            include: [
                {
                    model: TipoHerramientaRenta,
                    as: 'tipoHerramienta',
                    attributes: ['id', 'nombre', 'descripcion', 'prefijo_codigo']
                }
            ]
        });

        res.status(created ? 201 : 200).json({
            success: true,
            message: created ? 'Stock mínimo configurado exitosamente' : 'Stock mínimo actualizado exitosamente',
            data: { stockMinimo: stockMinimoCompleto }
        });
    } catch (error) {
        console.error('Error al configurar stock mínimo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al configurar stock mínimo'
        });
    }
};

// Eliminar configuración de stock mínimo
export const eliminarStockMinimo = async (req, res) => {
    try {
        const { id, stockId } = req.params;

        const stockMinimo = await StockMinimoCamioneta.findOne({
            where: {
                id: stockId,
                camioneta_id: id
            }
        });

        if (!stockMinimo) {
            return res.status(404).json({
                success: false,
                message: 'Configuración de stock mínimo no encontrada'
            });
        }

        await stockMinimo.destroy();

        res.status(200).json({
            success: true,
            message: 'Configuración de stock mínimo eliminada exitosamente'
        });
    } catch (error) {
        console.error('Error al eliminar stock mínimo:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar configuración de stock mínimo'
        });
    }
};

// Obtener inventario actual de una camioneta
export const obtenerInventarioCamioneta = async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar que la camioneta existe
        const camioneta = await Camioneta.findByPk(id);
        if (!camioneta) {
            return res.status(404).json({
                success: false,
                message: 'Camioneta no encontrada'
            });
        }

        // Obtener todas las unidades ubicadas en esta camioneta
        const unidades = await UnidadHerramientaRenta.findAll({
            where: {
                camioneta_id: id,
                activo: true
            },
            include: [
                {
                    model: TipoHerramientaRenta,
                    as: 'tipoHerramienta',
                    attributes: ['id', 'nombre', 'descripcion', 'prefijo_codigo']
                }
            ],
            order: [[{ model: TipoHerramientaRenta, as: 'tipoHerramienta' }, 'nombre', 'ASC']]
        });

        res.status(200).json({
            success: true,
            data: { unidades }
        });
    } catch (error) {
        console.error('Error al obtener inventario de camioneta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener inventario'
        });
    }
};

// Obtener resumen de inventario vs stock mínimo
export const obtenerResumenInventario = async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar que la camioneta existe
        const camioneta = await Camioneta.findByPk(id, {
            include: [
                {
                    model: Usuario,
                    as: 'encargado',
                    attributes: ['id', 'nombre', 'email']
                }
            ]
        });

        if (!camioneta) {
            return res.status(404).json({
                success: false,
                message: 'Camioneta no encontrada'
            });
        }

        // Obtener stock mínimo configurado
        const stocksMinimos = await StockMinimoCamioneta.findAll({
            where: { camioneta_id: id },
            include: [
                {
                    model: TipoHerramientaRenta,
                    as: 'tipoHerramienta',
                    attributes: ['id', 'nombre', 'descripcion', 'prefijo_codigo']
                }
            ]
        });

        // Obtener inventario actual agrupado por tipo de herramienta
        const unidades = await UnidadHerramientaRenta.findAll({
            where: {
                camioneta_id: id,
                activo: true
            },
            include: [
                {
                    model: TipoHerramientaRenta,
                    as: 'tipoHerramienta',
                    attributes: ['id', 'nombre', 'descripcion', 'prefijo_codigo']
                }
            ]
        });

        // Contar unidades por tipo de herramienta
        const inventarioActual = unidades.reduce((acc, unidad) => {
            const tipoId = unidad.tipo_herramienta_id;
            if (!acc[tipoId]) {
                acc[tipoId] = {
                    tipo_herramienta_id: tipoId,
                    tipo_herramienta: unidad.tipoHerramienta,
                    cantidad_actual: 0,
                    unidades: []
                };
            }
            acc[tipoId].cantidad_actual++;
            acc[tipoId].unidades.push({
                id: unidad.id,
                codigo_unico: unidad.codigo_unico,
                estado: unidad.estado,
                observaciones: unidad.observaciones
            });
            return acc;
        }, {});

        // Crear resumen comparando stock mínimo con inventario actual
        const resumen = stocksMinimos.map(stock => {
            const inventario = inventarioActual[stock.tipo_herramienta_id] || {
                tipo_herramienta_id: stock.tipo_herramienta_id,
                tipo_herramienta: stock.tipoHerramienta,
                cantidad_actual: 0,
                unidades: []
            };

            const cantidad_minima = stock.cantidad_minima;
            const cantidad_actual = inventario.cantidad_actual;
            const faltante = Math.max(0, cantidad_minima - cantidad_actual);
            const estado = cantidad_actual >= cantidad_minima ? 'completo' :
                          cantidad_actual > 0 ? 'incompleto' : 'vacio';

            return {
                tipo_herramienta: {
                    id: stock.tipoHerramienta.id,
                    nombre: stock.tipoHerramienta.nombre,
                    descripcion: stock.tipoHerramienta.descripcion,
                    prefijo_codigo: stock.tipoHerramienta.prefijo_codigo
                },
                cantidad_minima,
                cantidad_actual,
                faltante,
                estado,
                observaciones_config: stock.observaciones,
                unidades: inventario.unidades
            };
        });

        // Agregar tipos de herramientas que están en el inventario pero no tienen stock mínimo configurado
        Object.values(inventarioActual).forEach(inventario => {
            const yaExiste = resumen.find(r => r.tipo_herramienta.id === inventario.tipo_herramienta_id);
            if (!yaExiste) {
                resumen.push({
                    tipo_herramienta: {
                        id: inventario.tipo_herramienta.id,
                        nombre: inventario.tipo_herramienta.nombre,
                        descripcion: inventario.tipo_herramienta.descripcion,
                        prefijo_codigo: inventario.tipo_herramienta.prefijo_codigo
                    },
                    cantidad_minima: 0,
                    cantidad_actual: inventario.cantidad_actual,
                    faltante: 0,
                    estado: 'sin_configurar',
                    observaciones_config: null,
                    unidades: inventario.unidades
                });
            }
        });

        // Ordenar por nombre de tipo de herramienta
        resumen.sort((a, b) => a.tipo_herramienta.nombre.localeCompare(b.tipo_herramienta.nombre));

        // Calcular estadísticas generales
        const estadisticas = {
            total_tipos_configurados: stocksMinimos.length,
            tipos_completos: resumen.filter(r => r.estado === 'completo').length,
            tipos_incompletos: resumen.filter(r => r.estado === 'incompleto').length,
            tipos_vacios: resumen.filter(r => r.estado === 'vacio').length,
            tipos_sin_configurar: resumen.filter(r => r.estado === 'sin_configurar').length,
            total_unidades: unidades.length
        };

        res.status(200).json({
            success: true,
            data: {
                camioneta: {
                    id: camioneta.id,
                    nombre: camioneta.nombre,
                    matricula: camioneta.matricula,
                    encargado: camioneta.encargado
                },
                resumen,
                estadisticas
            }
        });
    } catch (error) {
        console.error('Error al obtener resumen de inventario:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener resumen de inventario'
        });
    }
};
