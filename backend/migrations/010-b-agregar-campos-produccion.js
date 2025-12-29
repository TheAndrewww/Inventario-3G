import { DataTypes } from 'sequelize';

export default {
  up: async (queryInterface, Sequelize) => {
    console.log('🚀 Agregando campos nuevos a unidades_herramienta_renta...');

    // 1. Agregar campo fecha_vencimiento_asignacion
    try {
      await queryInterface.addColumn('unidades_herramienta_renta', 'fecha_vencimiento_asignacion', {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha límite para devolver la herramienta asignada'
      });
      console.log('  ✅ Campo fecha_vencimiento_asignacion agregado');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('  ⚠️ Campo fecha_vencimiento_asignacion ya existe, omitiendo');
      } else {
        throw err;
      }
    }

    // 2. Agregar columna para motivo de cambio de estado
    try {
      await queryInterface.addColumn('unidades_herramienta_renta', 'motivo_estado', {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Motivo del cambio de estado (reparación, pérdida, baja, etc.)'
      });
      console.log('  ✅ Campo motivo_estado agregado');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('  ⚠️ Campo motivo_estado ya existe, omitiendo');
      } else {
        throw err;
      }
    }

    // 3. Agregar timestamp de último cambio de estado
    try {
      await queryInterface.addColumn('unidades_herramienta_renta', 'fecha_cambio_estado', {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha del último cambio de estado'
      });
      console.log('  ✅ Campo fecha_cambio_estado agregado');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('  ⚠️ Campo fecha_cambio_estado ya existe, omitiendo');
      } else {
        throw err;
      }
    }

    // 4. Agregar índice para búsqueda por fecha vencimiento
    try {
      await queryInterface.addIndex('unidades_herramienta_renta', ['fecha_vencimiento_asignacion'], {
        name: 'idx_unidades_herramienta_fecha_vencimiento'
      });
      console.log('  ✅ Índice idx_unidades_herramienta_fecha_vencimiento creado');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('  ⚠️ Índice ya existe, omitiendo');
      } else {
        throw err;
      }
    }

    console.log('✅ Migración completada: Campos agregados a unidades_herramienta_renta');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('unidades_herramienta_renta', 'fecha_cambio_estado');
    await queryInterface.removeColumn('unidades_herramienta_renta', 'motivo_estado');
    await queryInterface.removeIndex('unidades_herramienta_renta', 'idx_unidades_herramienta_fecha_vencimiento');
    await queryInterface.removeColumn('unidades_herramienta_renta', 'fecha_vencimiento_asignacion');
  }
};
