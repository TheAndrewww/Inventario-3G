import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Seccion = sequelize.define('Seccion', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    almacen_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'almacenes',
            key: 'id'
        }
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'secciones',
    timestamps: true,
    indexes: [
        { unique: true, fields: ['nombre', 'almacen_id'], name: 'secciones_nombre_almacen_unique' }
    ]
});

export default Seccion;
