/**
 * Migración 006: Crear tabla intermedia articulos_proveedores
 * para permitir múltiples proveedores por artículo
 */

export async function up(queryInterface, Sequelize) {
  console.log('Creando tabla articulos_proveedores...');

  // Crear tabla intermedia para la relación many-to-many
  await queryInterface.createTable('articulos_proveedores', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    articulo_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'articulos',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    proveedor_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'proveedores',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    costo_unitario: {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Costo del artículo con este proveedor específico'
    },
    es_preferido: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      comment: 'Indica si es el proveedor preferido para este artículo'
    },
    sku_proveedor: {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'SKU o código del proveedor para este artículo'
    },
    notas: {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Notas específicas sobre este proveedor para el artículo'
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

  // Crear índice único compuesto para evitar duplicados
  await queryInterface.addIndex('articulos_proveedores', ['articulo_id', 'proveedor_id'], {
    unique: true,
    name: 'articulos_proveedores_unique'
  });

  console.log('✅ Tabla articulos_proveedores creada');

  // Migrar datos existentes: copiar proveedor_id de articulos a articulos_proveedores
  console.log('Migrando proveedores existentes...');

  await queryInterface.sequelize.query(`
    INSERT INTO articulos_proveedores (articulo_id, proveedor_id, costo_unitario, es_preferido, created_at, updated_at)
    SELECT
      id as articulo_id,
      proveedor_id,
      costo_unitario,
      true as es_preferido,
      NOW() as created_at,
      NOW() as updated_at
    FROM articulos
    WHERE proveedor_id IS NOT NULL
  `);

  console.log('✅ Proveedores existentes migrados');
}

export async function down(queryInterface, Sequelize) {
  console.log('Eliminando tabla articulos_proveedores...');
  await queryInterface.dropTable('articulos_proveedores');
  console.log('✅ Tabla articulos_proveedores eliminada');
}
