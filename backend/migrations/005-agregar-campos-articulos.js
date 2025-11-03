export const up = async (queryInterface, Sequelize) => {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    // Agregar proveedor_id
    await queryInterface.addColumn('articulos', 'proveedor_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'proveedores',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Proveedor del artículo'
    }, { transaction });

    // Agregar stock_maximo
    await queryInterface.addColumn('articulos', 'stock_maximo', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Stock máximo recomendado para el artículo',
      defaultValue: null
    }, { transaction });

    // Crear índice para proveedor_id
    await queryInterface.addIndex('articulos', ['proveedor_id'], {
      name: 'idx_articulos_proveedor_id',
      transaction
    });

    console.log('✅ Campos proveedor_id y stock_maximo agregados a artículos');

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error en migración 005:', error);
    throw error;
  }
};

export const down = async (queryInterface, Sequelize) => {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    // Eliminar índice
    await queryInterface.removeIndex('articulos', 'idx_articulos_proveedor_id', { transaction });

    // Eliminar columnas
    await queryInterface.removeColumn('articulos', 'stock_maximo', { transaction });
    await queryInterface.removeColumn('articulos', 'proveedor_id', { transaction });

    console.log('✅ Campos eliminados de artículos');

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error al revertir migración 005:', error);
    throw error;
  }
};
