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
    supervisor_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'usuarios',
            key: 'id'
        },
        comment: 'Supervisor responsable del equipo'
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Si el equipo está activo'
    }
}, {
    tableName: 'equipos',
    timestamps: true
});

export default Equipo;
