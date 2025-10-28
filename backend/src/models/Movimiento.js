import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Movimiento = sequelize.define('Movimiento', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    ticket_id: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'ID único del ticket (formato: DDMMYY-HHMM-NN)'
    },
    tipo: {
        type: DataTypes.ENUM('retiro', 'devolucion', 'ajuste_entrada', 'ajuste_salida', 'transferencia'),
        allowNull: false,
        comment: 'Tipo de movimiento'
    },
    fecha_hora: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'usuarios',
            key: 'id'
        },
        comment: 'Usuario que realiza el movimiento'
    },
    supervisor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'usuarios',
            key: 'id'
        },
        comment: 'Supervisor que autoriza (opcional)'
    },
    proyecto: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: 'Nombre del proyecto/obra (si aplica)'
    },
    estado: {
        type: DataTypes.ENUM('pendiente', 'aprobado', 'completado', 'cancelado'),
        defaultValue: 'completado',
        allowNull: false
    },
    observaciones: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    total_piezas: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Total de piezas en el movimiento'
    }
}, {
    tableName: 'movimientos',
    timestamps: true,
    indexes: [
        {
            fields: ['ticket_id']
        },
        {
            fields: ['tipo']
        },
        {
            fields: ['usuario_id']
        },
        {
            fields: ['fecha_hora']
        },
        {
            fields: ['estado']
        }
    ]
});

export default Movimiento;
