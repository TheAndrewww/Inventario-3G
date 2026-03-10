import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Almacen = sequelize.define('Almacen', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Nombre del almacén'
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
    tableName: 'almacenes',
    timestamps: true
});

export default Almacen;
