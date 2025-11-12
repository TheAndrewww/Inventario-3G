import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * Modelo: Proyecto
 * Descripción: Representa un proyecto o obra de la empresa
 * Relaciones:
 *   - belongsTo Usuario (supervisor)
 *   - hasMany Movimiento
 */
const Proyecto = sequelize.define('Proyecto', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  nombre: {
    type: DataTypes.STRING(200),
    allowNull: false,
    unique: {
      msg: 'Ya existe un proyecto con este nombre'
    },
    validate: {
      notEmpty: {
        msg: 'El nombre del proyecto es requerido'
      },
      len: {
        args: [3, 200],
        msg: 'El nombre debe tener entre 3 y 200 caracteres'
      }
    },
    comment: 'Nombre único del proyecto'
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descripción detallada del proyecto'
  },
  cliente: {
    type: DataTypes.STRING(200),
    allowNull: true,
    validate: {
      len: {
        args: [0, 200],
        msg: 'El nombre del cliente no puede exceder 200 caracteres'
      }
    },
    comment: 'Nombre del cliente'
  },
  ubicacion_obra: {
    type: DataTypes.STRING(200),
    allowNull: true,
    validate: {
      len: {
        args: [0, 200],
        msg: 'La ubicación no puede exceder 200 caracteres'
      }
    },
    comment: 'Dirección o ubicación de la obra'
  },
  fecha_inicio: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isDate: {
        msg: 'La fecha de inicio debe ser una fecha válida'
      }
    },
    comment: 'Fecha de inicio planificada'
  },
  fecha_fin: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isDate: {
        msg: 'La fecha de fin debe ser una fecha válida'
      },
      isAfterStart(value) {
        if (value && this.fecha_inicio && value < this.fecha_inicio) {
          throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
        }
      }
    },
    comment: 'Fecha de fin planificada'
  },
  fecha_fin_real: {
    type: DataTypes.DATE,
    allowNull: true,
    validate: {
      isDate: {
        msg: 'La fecha de fin real debe ser una fecha válida'
      }
    },
    comment: 'Fecha de fin real (cuando se completó)'
  },
  estado: {
    type: DataTypes.ENUM('planificado', 'activo', 'pausado', 'completado', 'cancelado'),
    defaultValue: 'activo',
    allowNull: false,
    validate: {
      isIn: {
        args: [['planificado', 'activo', 'pausado', 'completado', 'cancelado']],
        msg: 'Estado inválido'
      }
    },
    comment: 'Estado actual del proyecto'
  },
  presupuesto_estimado: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    validate: {
      isDecimal: {
        msg: 'El presupuesto estimado debe ser un número decimal'
      },
      min: {
        args: [0],
        msg: 'El presupuesto estimado no puede ser negativo'
      }
    },
    comment: 'Presupuesto estimado del proyecto'
  },
  presupuesto_real: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    validate: {
      isDecimal: {
        msg: 'El presupuesto real debe ser un número decimal'
      },
      min: {
        args: [0],
        msg: 'El presupuesto real no puede ser negativo'
      }
    },
    comment: 'Costo real del proyecto'
  },
  supervisor_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'usuarios',
      key: 'id'
    },
    comment: 'Supervisor o encargado del proyecto'
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: 'Si el proyecto está activo o fue eliminado (soft delete)'
  }
}, {
  tableName: 'proyectos',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      name: 'idx_proyectos_nombre',
      fields: ['nombre']
    },
    {
      name: 'idx_proyectos_activo',
      fields: ['activo']
    },
    {
      name: 'idx_proyectos_estado',
      fields: ['estado']
    }
  ],
  hooks: {
    // Normalizar nombre antes de guardar (trim + capitalizar primera letra)
    beforeValidate: (proyecto) => {
      if (proyecto.nombre) {
        proyecto.nombre = proyecto.nombre.trim();
      }
      if (proyecto.cliente) {
        proyecto.cliente = proyecto.cliente.trim();
      }
      if (proyecto.ubicacion_obra) {
        proyecto.ubicacion_obra = proyecto.ubicacion_obra.trim();
      }
    },

    // Establecer fecha_fin_real cuando se marca como completado
    beforeUpdate: (proyecto) => {
      if (proyecto.changed('estado') && proyecto.estado === 'completado' && !proyecto.fecha_fin_real) {
        proyecto.fecha_fin_real = new Date();
      }
    }
  }
});

// Métodos de instancia

/**
 * Verifica si el proyecto está en curso
 */
Proyecto.prototype.estaActivo = function() {
  return this.activo && this.estado === 'activo';
};

/**
 * Obtiene el costo total de materiales del proyecto
 */
Proyecto.prototype.calcularCostoMateriales = async function() {
  const { default: models } = await import('./index.js');
  const { Movimiento, DetalleMovimiento, Articulo } = models;

  const resultado = await DetalleMovimiento.findAll({
    include: [
      {
        model: Movimiento,
        as: 'movimiento',
        where: { proyecto_id: this.id },
        attributes: []
      },
      {
        model: Articulo,
        as: 'articulo',
        attributes: ['costo_unitario']
      }
    ],
    attributes: ['cantidad']
  });

  let costoTotal = 0;
  resultado.forEach(detalle => {
    if (detalle.articulo && detalle.articulo.costo_unitario) {
      costoTotal += parseFloat(detalle.cantidad) * parseFloat(detalle.articulo.costo_unitario);
    }
  });

  return costoTotal;
};

/**
 * Obtiene el porcentaje de avance (basado en fechas)
 */
Proyecto.prototype.calcularPorcentajeAvance = function() {
  if (!this.fecha_inicio || !this.fecha_fin) {
    return null;
  }

  const ahora = new Date();
  const inicio = new Date(this.fecha_inicio);
  const fin = new Date(this.fecha_fin);

  if (ahora < inicio) return 0;
  if (ahora > fin) return 100;

  const duracionTotal = fin - inicio;
  const transcurrido = ahora - inicio;

  return Math.round((transcurrido / duracionTotal) * 100);
};

// Métodos estáticos

/**
 * Buscar proyectos por nombre (para autocomplete)
 */
Proyecto.buscarPorNombre = async function(query, limit = 10) {
  const { Op } = await import('sequelize');

  return await this.findAll({
    where: {
      nombre: {
        [Op.iLike]: `%${query}%`
      },
      activo: true
    },
    order: [['nombre', 'ASC']],
    limit: limit
  });
};

/**
 * Obtener proyectos activos
 */
Proyecto.obtenerActivos = async function() {
  const { Op } = await import('sequelize');

  return await this.findAll({
    where: {
      activo: true,
      estado: {
        [Op.in]: ['planificado', 'activo']
      }
    },
    order: [['fecha_inicio', 'DESC']]
  });
};

export default Proyecto;
