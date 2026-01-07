import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Camioneta = sequelize.define('Camioneta', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Nombre o identificador de la camioneta (ej: CAM-001, Ford F150)'
    },
    matricula: {
        type: DataTypes.STRING(50),
        allowNull: true,
        unique: true,
        comment: 'Matrícula o placa del vehículo'
    },
    tipo_camioneta: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'general',
        validate: {
            isIn: [['instalacion', 'mantenimiento', 'supervision', 'general']]
        },
        comment: 'Tipo de trabajo que realiza la camioneta'
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Descripción de la camioneta y sus funciones'
    },
    encargado_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'usuarios',
            key: 'id'
        },
        comment: 'Encargado responsable de la camioneta'
    },
    almacen_base_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'ubicaciones',
            key: 'id'
        },
        comment: 'Almacén base donde se estaciona la camioneta'
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Si la camioneta está activa'
    }
}, {
    tableName: 'camionetas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true
});

export default Camioneta;
