import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const FCMToken = sequelize.define('FCMToken', {
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
  fcm_token: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true
  },
  device_type: {
    type: DataTypes.ENUM('ios', 'android', 'web'),
    allowNull: false
  },
  browser: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  last_used_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'fcm_tokens',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['usuario_id'] },
    { fields: ['fcm_token'] },
    { fields: ['device_type'] }
  ]
});

export default FCMToken;
