import { DataTypes } from 'sequelize';

export default {
  up: async (queryInterface, Sequelize) => {
    // 1. Actualizar enum de estados para incluir estados transitorios
    await queryInterface.sequelize.query(`
      ALTER TYPE enum_unidades_herramienta_renta_estado
      ADD VALUE IF NOT EXISTS 'en_transito';
    `);

    await queryInterface.sequelize.query(`
      ALTER TYPE enum_unidades_herramienta_renta_estado
      ADD VALUE IF NOT EXISTS 'pendiente_devolucion';
    `);

    // 2. Agregar campo fecha_vencimiento_asignacion a unidades
    await queryInterface.addColumn('unidades_herramienta_renta', 'fecha_vencimiento_asignacion', {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha límite para devolver la herramienta asignada'
    });

    // 3. Agregar índice para búsqueda por fecha vencimiento
    await queryInterface.addIndex('unidades_herramienta_renta', ['fecha_vencimiento_asignacion'], {
      name: 'idx_unidades_herramienta_fecha_vencimiento'
    });

    // 4. Agregar columna para motivo de cambio de estado
    await queryInterface.addColumn('unidades_herramienta_renta', 'motivo_estado', {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Motivo del cambio de estado (reparación, pérdida, baja, etc.)'
    });

    // 5. Agregar timestamp de último cambio de estado
    await queryInterface.addColumn('unidades_herramienta_renta', 'fecha_cambio_estado', {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha del último cambio de estado'
    });

    console.log('✅ Migración 010: Mejoras al sistema de herramientas completada');
  },

  down: async (queryInterface, Sequelize) => {
    // Eliminar columnas agregadas
    await queryInterface.removeColumn('unidades_herramienta_renta', 'fecha_cambio_estado');
    await queryInterface.removeColumn('unidades_herramienta_renta', 'motivo_estado');
    await queryInterface.removeIndex('unidades_herramienta_renta', 'idx_unidades_herramienta_fecha_vencimiento');
    await queryInterface.removeColumn('unidades_herramienta_renta', 'fecha_vencimiento_asignacion');

    // Nota: No se pueden eliminar valores de enum en PostgreSQL sin reconstruir el tipo
    console.log('⚠️ Advertencia: Los nuevos estados del enum no se eliminan para evitar errores en datos existentes');
  }
};
