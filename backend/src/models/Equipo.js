import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Equipo = sequelize.define('Equipo', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Nombre del equipo de instalación/supervisión'
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Descripción del equipo y sus funciones'
    },
    matricula: {
        type: DataTypes.STRING(50),
        allowNull: true,
        unique: true,
        comment: 'Matrícula o placa del vehículo'
    },
    tipo_camioneta: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'general',
        validate: {
            isIn: [['instalacion', 'mantenimiento', 'supervision', 'general']]
        },
        comment: 'Tipo de trabajo que realiza la camioneta'
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
    encargado_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'usuarios',
            key: 'id'
        },
        comment: 'Encargado responsable de la camioneta (antes supervisor)'
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Si el equipo está activo'
    }
}, {
    tableName: 'camionetas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true
});

export default Equipo;
