import { Proyecto, Usuario, Movimiento, DetalleMovimiento, Articulo } from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Obtener todos los proyectos con filtros opcionales
 * GET /api/proyectos
 *
 * Query params:
 * - activo: true/false (filtrar por activo)
 * - estado: 'planificado','activo','pausado','completado','cancelado'
 * - buscar: texto para buscar en nombre
 * - supervisor_id: filtrar por supervisor
 */
export const obtenerProyectos = async (req, res) => {
  try {
    const { activo, estado, buscar, supervisor_id } = req.query;

    // Construir condiciones de filtrado
    const where = {};

    if (activo !== undefined) {
      where.activo = activo === 'true';
    }

    if (estado) {
      where.estado = estado;
    }

    if (buscar) {
      where.nombre = {
        [Op.iLike]: `%${buscar}%`
      };
    }

    if (supervisor_id) {
      where.supervisor_id = supervisor_id;
    }

    const proyectos = await Proyecto.findAll({
      where,
      include: [
        {
          model: Usuario,
          as: 'supervisor',
          attributes: ['id', 'nombre', 'email', 'rol']
        }
      ],
      order: [
        ['activo', 'DESC'],
        ['estado', 'ASC'],
        ['fecha_inicio', 'DESC']
      ]
    });

    res.json({
      success: true,
      data: {
        proyectos,
        total: proyectos.length
      }
    });
  } catch (error) {
    console.error('Error al obtener proyectos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener proyectos',
      error: error.message
    });
  }
};

/**
 * Obtener un proyecto por ID con información detallada
 * GET /api/proyectos/:id
 */
export const obtenerProyectoPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const proyecto = await Proyecto.findByPk(id, {
      include: [
        {
          model: Usuario,
          as: 'supervisor',
          attributes: ['id', 'nombre', 'email', 'rol']
        }
      ]
    });

    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    // Calcular estadísticas del proyecto
    const costoMateriales = await proyecto.calcularCostoMateriales();
    const porcentajeAvance = proyecto.calcularPorcentajeAvance();

    // Contar movimientos asociados
    const totalMovimientos = await Movimiento.count({
      where: { proyecto_id: id }
    });

    res.json({
      success: true,
      data: {
        proyecto: {
          ...proyecto.toJSON(),
          estadisticas: {
            costo_materiales: costoMateriales,
            porcentaje_avance: porcentajeAvance,
            total_movimientos: totalMovimientos
          }
        }
      }
    });
  } catch (error) {
    console.error('Error al obtener proyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener proyecto',
      error: error.message
    });
  }
};

/**
 * Crear un nuevo proyecto
 * POST /api/proyectos
 *
 * Body: {
 *   nombre: string (requerido),
 *   descripcion: string,
 *   cliente: string,
 *   ubicacion_obra: string,
 *   fecha_inicio: date,
 *   fecha_fin: date,
 *   estado: enum,
 *   presupuesto_estimado: decimal,
 *   supervisor_id: integer
 * }
 */
export const crearProyecto = async (req, res) => {
  try {
    const {
      nombre,
      descripcion,
      cliente,
      ubicacion_obra,
      fecha_inicio,
      fecha_fin,
      estado,
      presupuesto_estimado,
      supervisor_id
    } = req.body;

    // Validaciones
    if (!nombre || nombre.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del proyecto es requerido'
      });
    }

    // Verificar que no exista un proyecto con el mismo nombre
    const proyectoExistente = await Proyecto.findOne({
      where: { nombre: nombre.trim() }
    });

    if (proyectoExistente) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un proyecto con este nombre'
      });
    }

    // Crear proyecto
    const nuevoProyecto = await Proyecto.create({
      nombre: nombre.trim(),
      descripcion,
      cliente,
      ubicacion_obra,
      fecha_inicio,
      fecha_fin,
      estado: estado || 'activo',
      presupuesto_estimado,
      supervisor_id,
      activo: true
    });

    // Obtener proyecto con relaciones
    const proyectoCreado = await Proyecto.findByPk(nuevoProyecto.id, {
      include: [
        {
          model: Usuario,
          as: 'supervisor',
          attributes: ['id', 'nombre', 'email', 'rol']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Proyecto creado exitosamente',
      data: {
        proyecto: proyectoCreado
      }
    });
  } catch (error) {
    console.error('Error al crear proyecto:', error);

    // Manejo de errores de validación de Sequelize
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: error.errors.map(e => ({
          campo: e.path,
          mensaje: e.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al crear proyecto',
      error: error.message
    });
  }
};

/**
 * Actualizar un proyecto existente
 * PUT /api/proyectos/:id
 */
export const actualizarProyecto = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      descripcion,
      cliente,
      ubicacion_obra,
      fecha_inicio,
      fecha_fin,
      fecha_fin_real,
      estado,
      presupuesto_estimado,
      presupuesto_real,
      supervisor_id
    } = req.body;

    // Buscar proyecto
    const proyecto = await Proyecto.findByPk(id);

    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    // Si se cambia el nombre, verificar que no exista otro con ese nombre
    if (nombre && nombre.trim() !== proyecto.nombre) {
      const proyectoExistente = await Proyecto.findOne({
        where: {
          nombre: nombre.trim(),
          id: { [Op.ne]: id }
        }
      });

      if (proyectoExistente) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe otro proyecto con este nombre'
        });
      }
    }

    // Actualizar proyecto
    await proyecto.update({
      nombre: nombre?.trim() || proyecto.nombre,
      descripcion: descripcion !== undefined ? descripcion : proyecto.descripcion,
      cliente: cliente !== undefined ? cliente : proyecto.cliente,
      ubicacion_obra: ubicacion_obra !== undefined ? ubicacion_obra : proyecto.ubicacion_obra,
      fecha_inicio: fecha_inicio !== undefined ? fecha_inicio : proyecto.fecha_inicio,
      fecha_fin: fecha_fin !== undefined ? fecha_fin : proyecto.fecha_fin,
      fecha_fin_real: fecha_fin_real !== undefined ? fecha_fin_real : proyecto.fecha_fin_real,
      estado: estado || proyecto.estado,
      presupuesto_estimado: presupuesto_estimado !== undefined ? presupuesto_estimado : proyecto.presupuesto_estimado,
      presupuesto_real: presupuesto_real !== undefined ? presupuesto_real : proyecto.presupuesto_real,
      supervisor_id: supervisor_id !== undefined ? supervisor_id : proyecto.supervisor_id
    });

    // Obtener proyecto actualizado con relaciones
    const proyectoActualizado = await Proyecto.findByPk(id, {
      include: [
        {
          model: Usuario,
          as: 'supervisor',
          attributes: ['id', 'nombre', 'email', 'rol']
        }
      ]
    });

    res.json({
      success: true,
      message: 'Proyecto actualizado exitosamente',
      data: {
        proyecto: proyectoActualizado
      }
    });
  } catch (error) {
    console.error('Error al actualizar proyecto:', error);

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: error.errors.map(e => ({
          campo: e.path,
          mensaje: e.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al actualizar proyecto',
      error: error.message
    });
  }
};

/**
 * Eliminar (desactivar) un proyecto
 * DELETE /api/proyectos/:id
 * Nota: Soft delete - solo marca como inactivo
 */
export const eliminarProyecto = async (req, res) => {
  try {
    const { id } = req.params;

    const proyecto = await Proyecto.findByPk(id);

    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    // Verificar si tiene movimientos asociados
    const tieneMovimientos = await Movimiento.count({
      where: { proyecto_id: id }
    });

    if (tieneMovimientos > 0) {
      // Si tiene movimientos, solo desactivar
      await proyecto.update({ activo: false });

      return res.json({
        success: true,
        message: `Proyecto desactivado exitosamente (tiene ${tieneMovimientos} movimientos asociados)`,
        data: { proyecto }
      });
    } else {
      // Si no tiene movimientos, permitir eliminación completa
      await proyecto.destroy();

      return res.json({
        success: true,
        message: 'Proyecto eliminado exitosamente'
      });
    }
  } catch (error) {
    console.error('Error al eliminar proyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar proyecto',
      error: error.message
    });
  }
};

/**
 * Buscar proyectos por nombre (para autocomplete)
 * GET /api/proyectos/buscar/:query
 */
export const buscarProyectos = async (req, res) => {
  try {
    const { query } = req.params;
    const { limit = 10 } = req.query;

    const proyectos = await Proyecto.findAll({
      where: {
        nombre: {
          [Op.iLike]: `%${query}%`
        },
        activo: true
      },
      attributes: ['id', 'nombre', 'cliente', 'estado', 'fecha_inicio'],
      order: [['nombre', 'ASC']],
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: { proyectos }
    });
  } catch (error) {
    console.error('Error al buscar proyectos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar proyectos',
      error: error.message
    });
  }
};

/**
 * Obtener movimientos de un proyecto
 * GET /api/proyectos/:id/movimientos
 */
export const obtenerMovimientosProyecto = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el proyecto existe
    const proyecto = await Proyecto.findByPk(id);
    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    const movimientos = await Movimiento.findAll({
      where: { proyecto_id: id },
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['id', 'nombre', 'email']
        },
        {
          model: DetalleMovimiento,
          as: 'detalles',
          include: [
            {
              model: Articulo,
              as: 'articulo',
              attributes: ['id', 'nombre', 'codigo_ean13', 'costo_unitario', 'unidad']
            }
          ]
        }
      ],
      order: [['fecha_hora', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        proyecto: {
          id: proyecto.id,
          nombre: proyecto.nombre
        },
        movimientos,
        total: movimientos.length
      }
    });
  } catch (error) {
    console.error('Error al obtener movimientos del proyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener movimientos del proyecto',
      error: error.message
    });
  }
};

/**
 * Obtener costos de un proyecto
 * GET /api/proyectos/:id/costos
 */
export const obtenerCostosProyecto = async (req, res) => {
  try {
    const { id } = req.params;

    const proyecto = await Proyecto.findByPk(id);
    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    // Calcular costo de materiales
    const costoMateriales = await proyecto.calcularCostoMateriales();

    // Obtener desglose por artículo
    const desglose = await DetalleMovimiento.findAll({
      attributes: [
        'articulo_id',
        [DetalleMovimiento.sequelize.fn('SUM', DetalleMovimiento.sequelize.col('cantidad')), 'cantidad_total']
      ],
      include: [
        {
          model: Movimiento,
          as: 'movimiento',
          where: { proyecto_id: id },
          attributes: []
        },
        {
          model: Articulo,
          as: 'articulo',
          attributes: ['id', 'nombre', 'codigo_ean13', 'costo_unitario', 'unidad']
        }
      ],
      group: ['articulo_id', 'articulo.id'],
      raw: false
    });

    // Calcular costo por artículo
    const desgloseConCosto = desglose.map(detalle => {
      const cantidad = parseFloat(detalle.dataValues.cantidad_total);
      const costoUnitario = parseFloat(detalle.articulo.costo_unitario) || 0;
      const costoTotal = cantidad * costoUnitario;

      return {
        articulo: detalle.articulo,
        cantidad: cantidad,
        costo_unitario: costoUnitario,
        costo_total: costoTotal
      };
    });

    res.json({
      success: true,
      data: {
        proyecto: {
          id: proyecto.id,
          nombre: proyecto.nombre,
          presupuesto_estimado: proyecto.presupuesto_estimado,
          presupuesto_real: proyecto.presupuesto_real
        },
        costos: {
          materiales: costoMateriales,
          desglose: desgloseConCosto
        }
      }
    });
  } catch (error) {
    console.error('Error al obtener costos del proyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener costos del proyecto',
      error: error.message
    });
  }
};

export default {
  obtenerProyectos,
  obtenerProyectoPorId,
  crearProyecto,
  actualizarProyecto,
  eliminarProyecto,
  buscarProyectos,
  obtenerMovimientosProyecto,
  obtenerCostosProyecto
};
