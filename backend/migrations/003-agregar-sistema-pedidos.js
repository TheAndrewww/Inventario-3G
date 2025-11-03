/**
 * Migración: Agregar sistema de pedidos
 *
 * - Agrega tipo 'pedido' al ENUM de movimientos
 * - Agrega campos para control de dispersión en detalle_movimientos
 */

export async function up(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log('🔄 Iniciando migración de sistema de pedidos...\n');

    // Paso 1: Agregar tipo 'pedido' al ENUM de movimientos
    console.log('1️⃣ Agregando tipo "pedido" al ENUM de movimientos...');

    await queryInterface.sequelize.query(`
      ALTER TYPE enum_movimientos_tipo ADD VALUE 'pedido';
    `, { transaction });

    console.log('✅ Tipo "pedido" agregado\n');

    // Paso 2: Agregar campos de dispersión al detalle_movimientos
    console.log('2️⃣ Agregando campos de dispersión a detalle_movimientos...');

    await queryInterface.addColumn('detalle_movimientos', 'dispersado', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Indica si el artículo fue dispersado/entregado'
    }, { transaction });

    await queryInterface.addColumn('detalle_movimientos', 'fecha_dispersado', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Fecha y hora en que se dispersó el artículo'
    }, { transaction });

    await queryInterface.addColumn('detalle_movimientos', 'dispersado_por_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'usuarios',
        key: 'id'
      },
      comment: 'Usuario que dispersó el artículo'
    }, { transaction });

    console.log('✅ Campos de dispersión agregados\n');

    await transaction.commit();
    console.log('✅ Migración de sistema de pedidos completada exitosamente');

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error en migración de pedidos:', error);
    throw error;
  }
}

export async function down(queryInterface, Sequelize) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log('🔄 Revirtiendo migración de sistema de pedidos...\n');

    // Eliminar columnas agregadas
    console.log('1️⃣ Eliminando campos de dispersión...');
    await queryInterface.removeColumn('detalle_movimientos', 'dispersado_por_id', { transaction });
    await queryInterface.removeColumn('detalle_movimientos', 'fecha_dispersado', { transaction });
    await queryInterface.removeColumn('detalle_movimientos', 'dispersado', { transaction });

    console.log('✅ Campos eliminados\n');

    // Nota: No se puede eliminar un valor del ENUM directamente en PostgreSQL sin recrear el tipo
    console.log('⚠️  Nota: El valor "pedido" permanece en el ENUM (limitación de PostgreSQL)');
    console.log('   Si necesitas eliminarlo, deberás recrear el ENUM manualmente.');

    await transaction.commit();
    console.log('✅ Reversión completada');

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error al revertir migración:', error);
    throw error;
  }
}
