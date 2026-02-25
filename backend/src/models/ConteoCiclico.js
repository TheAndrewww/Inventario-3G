import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const ConteoCiclico = sequelize.define('ConteoCiclico', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    fecha: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        unique: true,
        comment: 'Fecha del día de conteo (un registro por día)'
    },
    nombre: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Nombre descriptivo del conteo del día'
    },
    estado: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'pendiente',
        validate: {
            isIn: [['pendiente', 'completado']]
        },
        comment: 'Estado: pendiente o completado'
    },
    total_asignados: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total de artículos asignados para contar este día'
    },
    articulos_contados: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Cantidad de artículos ya contados'
    },
    completado_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de finalización del conteo'
    }
}, {
    tableName: 'conteos_ciclicos',
    timestamps: true,
    indexes: [
        {
            fields: ['estado']
        },
        {
            unique: true,
            fields: ['fecha']
        }
    ]
});

export default ConteoCiclico;
