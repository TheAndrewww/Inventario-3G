import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const SolicitudCambio = sequelize.define('SolicitudCambio', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tipo: {
    type: DataTypes.ENUM(
      'cambio_ubicacion',
      'entrada_stock',
      'salida_stock',
      'crear_articulo',
      'desactivar_articulo'
    ),
    allowNull: false
  },
  articulo_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'articulos', key: 'id' }
  },
  solicitante_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'usuarios', key: 'id' }
  },
  estado: {
    type: DataTypes.ENUM('pendiente', 'aprobada', 'rechazada'),
    defaultValue: 'pendiente',
    allowNull: false
  },
  payload: {
    type: DataTypes.JSONB,
    allowNull: false,
    comment: 'Valores nuevos solicitados'
  },
  snapshot: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Estado anterior del artículo (para auditoría)'
  },
  aprobador_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'usuarios', key: 'id' }
  },
  fecha_resolucion: {
    type: DataTypes.DATE,
    allowNull: true
  },
  motivo_rechazo: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  observaciones: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notas opcionales del solicitante'
  }
}, {
  tableName: 'solicitudes_cambio',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['estado'] },
    { fields: ['solicitante_id'] },
    { fields: ['articulo_id'] },
    { fields: ['tipo'] }
  ]
});

export default SolicitudCambio;
