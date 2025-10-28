import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Ubicacion = sequelize.define('Ubicacion', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    codigo: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
        comment: 'Código de ubicación (ej: A-12, B-05)'
    },
    almacen: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: 'Principal',
        comment: 'Nombre del almacén'
    },
    pasillo: {
        type: DataTypes.STRING(10),
        allowNull: true,
        comment: 'Pasillo (A, B, C, etc.)'
    },
    estante: {
        type: DataTypes.STRING(10),
        allowNull: true,
        comment: 'Número de estante (01-20)'
    },
    nivel: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Nivel del estante (1-5)'
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'ubicaciones',
    timestamps: true
});

export default Ubicacion;
