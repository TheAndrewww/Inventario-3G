import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const DetalleMovimiento = sequelize.define('DetalleMovimiento', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    movimiento_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'movimientos',
            key: 'id'
        }
    },
    articulo_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'articulos',
            key: 'id'
        }
    },
    cantidad: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0
        }
    },
    costo_unitario: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Costo unitario al momento del movimiento'
    },
    observaciones: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'detalle_movimientos',
    timestamps: true,
    indexes: [
        {
            fields: ['movimiento_id']
        },
        {
            fields: ['articulo_id']
        }
    ]
});

export default DetalleMovimiento;
