import { sequelize } from '../src/config/database.js';
import { QueryInterface, DataTypes } from 'sequelize';

/**
 * Migración 008: Agregar estados de recepción y campos para validación de pedidos
 * - Agrega estado 'listo_para_entrega' y 'entregado'
 * - Agrega campos recibido_por_id y fecha_recepcion
 */

export const up = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const transaction = await sequelize.transaction();

  try {
    console.log('🔄 Iniciando migración 008: Agregar estados de recepción de pedidos...');

    // 1. Agregar campos recibido_por_id y fecha_recepcion
    console.log('  📝 Agregando campo recibido_por_id...');
    await queryInterface.addColumn('movimientos', 'recibido_por_id', {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'usuarios',
        key: 'id'
      },
      comment: 'Supervisor que recibió y validó el pedido'
    }, { transaction });

    console.log('  📝 Agregando campo fecha_recepcion...');
    await queryInterface.addColumn('movimientos', 'fecha_recepcion', {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha y hora de recepción del pedido por el supervisor'
    }, { transaction });

    // 2. Actualizar el ENUM de estado (solo PostgreSQL soporta esto directamente)
    console.log('  📝 Actualizando tipo ENUM estado...');

    // Para PostgreSQL
    await sequelize.query(`
      ALTER TYPE "enum_movimientos_estado" ADD VALUE IF NOT EXISTS 'listo_para_entrega';
    `, { transaction });

    await sequelize.query(`
      ALTER TYPE "enum_movimientos_estado" ADD VALUE IF NOT EXISTS 'entregado';
    `, { transaction });

    await transaction.commit();
    console.log('✅ Migración 008 completada exitosamente');

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error en migración 008:', error);
    throw error;
  }
};

export const down = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const transaction = await sequelize.transaction();

  try {
    console.log('🔄 Revirtiendo migración 008...');

    // Eliminar campos agregados
    await queryInterface.removeColumn('movimientos', 'fecha_recepcion', { transaction });
    await queryInterface.removeColumn('movimientos', 'recibido_por_id', { transaction });

    // Nota: No se pueden eliminar valores de ENUM en PostgreSQL sin recrear el tipo
    // Se deja como está para no afectar datos existentes

    await transaction.commit();
    console.log('✅ Migración 008 revertida');

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error al revertir migración 008:', error);
    throw error;
  }
};
