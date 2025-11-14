import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const ArticuloProveedor = sequelize.define('ArticuloProveedor', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  articulo_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'articulos',
      key: 'id'
    }
  },
  proveedor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'proveedores',
      key: 'id'
    }
  },
  costo_unitario: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Costo del artículo con este proveedor específico'
  },
  es_preferido: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Indica si es el proveedor preferido para este artículo'
  },
  sku_proveedor: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'SKU o código del proveedor para este artículo'
  },
  notas: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notas específicas sobre este proveedor para el artículo'
  }
}, {
  tableName: 'articulos_proveedores',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['articulo_id', 'proveedor_id'],
      name: 'articulos_proveedores_unique'
    }
  ]
});

export default ArticuloProveedor;
