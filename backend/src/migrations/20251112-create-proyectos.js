/**
 * Migración: Crear tabla proyectos
 * Fecha: 2025-11-12
 * Descripción: Normalizar el campo 'proyecto' de movimientos en una tabla separada
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Crear tabla proyectos
    await queryInterface.createTable('proyectos', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      nombre: {
        type: Sequelize.STRING(200),
        allowNull: false,
        unique: true,
        comment: 'Nombre único del proyecto'
      },
      descripcion: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Descripción detallada del proyecto'
      },
      cliente: {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: 'Nombre del cliente'
      },
      ubicacion_obra: {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: 'Dirección o ubicación de la obra'
      },
      fecha_inicio: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Fecha de inicio planificada'
      },
      fecha_fin: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Fecha de fin planificada'
      },
      fecha_fin_real: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Fecha de fin real (cuando se completó)'
      },
      estado: {
        type: Sequelize.ENUM('planificado', 'activo', 'pausado', 'completado', 'cancelado'),
        defaultValue: 'activo',
        allowNull: false,
        comment: 'Estado actual del proyecto'
      },
      presupuesto_estimado: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Presupuesto estimado del proyecto'
      },
      presupuesto_real: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Costo real del proyecto'
      },
      supervisor_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'usuarios',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Supervisor o encargado del proyecto'
      },
      activo: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Si el proyecto está activo o fue eliminado (soft delete)'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Agregar índices para búsquedas rápidas
    await queryInterface.addIndex('proyectos', ['nombre'], {
      name: 'idx_proyectos_nombre'
    });

    await queryInterface.addIndex('proyectos', ['activo'], {
      name: 'idx_proyectos_activo'
    });

    await queryInterface.addIndex('proyectos', ['estado'], {
      name: 'idx_proyectos_estado'
    });

    // Agregar columna proyecto_id a movimientos (nullable por ahora)
    await queryInterface.addColumn('movimientos', 'proyecto_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'proyectos',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Referencia al proyecto normalizado'
    });

    // Agregar índice en movimientos.proyecto_id
    await queryInterface.addIndex('movimientos', ['proyecto_id'], {
      name: 'idx_movimientos_proyecto_id'
    });

    console.log('✅ Tabla proyectos creada exitosamente');
    console.log('✅ Columna proyecto_id agregada a movimientos');
  },

  down: async (queryInterface, Sequelize) => {
    // Eliminar índice de movimientos
    await queryInterface.removeIndex('movimientos', 'idx_movimientos_proyecto_id');

    // Eliminar columna proyecto_id de movimientos
    await queryInterface.removeColumn('movimientos', 'proyecto_id');

    // Eliminar índices de proyectos
    await queryInterface.removeIndex('proyectos', 'idx_proyectos_estado');
    await queryInterface.removeIndex('proyectos', 'idx_proyectos_activo');
    await queryInterface.removeIndex('proyectos', 'idx_proyectos_nombre');

    // Eliminar tabla proyectos
    await queryInterface.dropTable('proyectos');

    console.log('✅ Rollback completado: tabla proyectos eliminada');
  }
};
