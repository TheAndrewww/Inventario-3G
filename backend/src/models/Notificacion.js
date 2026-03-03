import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Notificacion = sequelize.define('Notificacion', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  usuario_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'usuarios',
      key: 'id'
    }
  },
  tipo: {
    type: DataTypes.ENUM(
      'solicitud_compra_creada',
      'solicitud_creada',
      'solicitud_cancelada',
      'solicitud_urgente',
      'orden_compra_creada',
      'orden_creada',
      'orden_estado_cambiado',
      'orden_enviada',
      'orden_recibida',
      'orden_anulada',
      'orden_completada_manual',
      'pedido_aprobado',
      'pedido_rechazado',
      'pedido_creado',
      'pedido_pendiente',
      'pedido_pendiente_aprobacion',
      'stock_bajo'
    ),
    allowNull: false
  },
  titulo: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  mensaje: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  leida: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'URL para navegar cuando se hace clic en la notificación'
  },
  datos_adicionales: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Datos adicionales en formato JSON (IDs, nombres, etc.)'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'notificaciones',
  timestamps: false,
  indexes: [
    {
      fields: ['usuario_id']
    },
    {
      fields: ['leida']
    },
    {
      fields: ['tipo']
    },
    {
      fields: ['created_at']
    }
  ]
});

export default Notificacion;
