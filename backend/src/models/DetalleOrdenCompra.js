import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const DetalleOrdenCompra = sequelize.define('DetalleOrdenCompra', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    orden_compra_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'ordenes_compra',
            key: 'id'
        },
        comment: 'FK a ordenes_compra'
    },
    articulo_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'articulos',
            key: 'id'
        },
        comment: 'Artículo a comprar'
    },
    cantidad_solicitada: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Cantidad solicitada'
    },
    cantidad_recibida: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Cantidad recibida hasta el momento'
    },
    costo_unitario: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Costo unitario cotizado'
    },
    subtotal: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        comment: 'Subtotal de esta línea (cantidad * costo)'
    },
    observaciones: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'detalle_ordenes_compra',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default DetalleOrdenCompra;
