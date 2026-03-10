import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const AlmacenCategoria = sequelize.define('AlmacenCategoria', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    almacen_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'almacenes',
            key: 'id'
        }
    },
    categoria_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'categorias',
            key: 'id'
        }
    }
}, {
    tableName: 'almacen_categorias',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['almacen_id', 'categoria_id']
        }
    ]
});

export default AlmacenCategoria;
