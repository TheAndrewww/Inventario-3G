import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * Tabla clave-valor para configuraciones globales del sistema.
 * Ej: 'almacen_ajuste_directo' = 'true' permite que el rol almacen
 * aplique entradas/salidas de stock sin requerir aprobación de admin.
 */
const Configuracion = sequelize.define('Configuracion', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  clave: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  valor: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'configuracion',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['clave'] }
  ]
});

export default Configuracion;
