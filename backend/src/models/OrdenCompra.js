import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const OrdenCompra = sequelize.define('OrdenCompra', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    ticket_id: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Formato: OC-DDMMYY-HHMM-NN'
    },
    proveedor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'proveedores',
            key: 'id'
        },
        comment: 'Proveedor asignado a la orden de compra'
    },
    usuario_creador_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'usuarios',
            key: 'id'
        },
        comment: 'Usuario que creó la orden (diseñador o almacenista)'
    },
    estado: {
        type: DataTypes.ENUM('borrador', 'enviada', 'parcial', 'recibida', 'cancelada'),
        allowNull: false,
        defaultValue: 'borrador',
        comment: 'Estado de la orden de compra'
    },
    total_estimado: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Total estimado de la orden'
    },
    observaciones: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    fecha_envio: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha en que se envió la orden al proveedor'
    },
    fecha_recepcion: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha en que se recibió completamente'
    },
    fecha_llegada_estimada: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha estimada de llegada de la orden'
    }
}, {
    tableName: 'ordenes_compra',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default OrdenCompra;
