import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const SolicitudCompra = sequelize.define('SolicitudCompra', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    ticket_id: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Formato: SC-DDMMYY-HHMM-NN'
    },
    articulo_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'articulos',
            key: 'id'
        },
        comment: 'Artículo que necesita ser comprado'
    },
    cantidad_solicitada: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Cantidad que se solicita comprar (faltante + stock_maximo)'
    },
    motivo: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Motivo de la solicitud'
    },
    pedido_origen_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'movimientos',
            key: 'id'
        },
        comment: 'ID del pedido que generó la solicitud (si aplica)'
    },
    usuario_solicitante_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'usuarios',
            key: 'id'
        },
        comment: 'Usuario que generó la solicitud'
    },
    proveedor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'proveedores',
            key: 'id'
        },
        comment: 'Proveedor sugerido para esta solicitud (detectado automáticamente del artículo)'
    },
    orden_compra_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'ordenes_compra',
            key: 'id'
        },
        comment: 'Orden de compra asociada'
    },
    estado: {
        type: DataTypes.ENUM('pendiente', 'en_orden', 'completada', 'cancelada'),
        allowNull: false,
        defaultValue: 'pendiente',
        comment: 'pendiente=sin orden, en_orden=incluida en orden, completada=recibida, cancelada=cancelada'
    },
    prioridad: {
        type: DataTypes.ENUM('baja', 'media', 'alta', 'urgente'),
        allowNull: false,
        defaultValue: 'media',
        comment: 'Prioridad de la solicitud'
    },
    observaciones: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'solicitudes_compra',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default SolicitudCompra;
