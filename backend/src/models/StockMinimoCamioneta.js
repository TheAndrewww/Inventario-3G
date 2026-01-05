import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const StockMinimoCamioneta = sequelize.define('StockMinimoCamioneta', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    camioneta_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'camionetas',
            key: 'id'
        }
    },
    tipo_herramienta_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'tipos_herramienta_renta',
            key: 'id'
        }
    },
    cantidad_minima: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Cantidad mínima de unidades de este tipo que deben estar en la camioneta'
    },
    observaciones: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas sobre este stock mínimo'
    }
}, {
    tableName: 'stock_minimo_camioneta',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ['camioneta_id', 'tipo_herramienta_id'],
            name: 'unique_camioneta_tipo_herramienta'
        }
    ]
});

export default StockMinimoCamioneta;
