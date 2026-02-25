import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const ConteoArticulo = sequelize.define('ConteoArticulo', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    conteo_ciclico_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'conteos_ciclicos',
            key: 'id'
        },
        comment: 'Sesión de conteo a la que pertenece'
    },
    articulo_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'articulos',
            key: 'id'
        },
        comment: 'Artículo que fue contado'
    },
    cantidad_sistema: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Stock que marcaba el sistema al momento de contar'
    },
    cantidad_fisica: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Cantidad física contada por el usuario'
    },
    diferencia: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Diferencia = cantidad_fisica - cantidad_sistema'
    },
    observaciones: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas opcionales del conteo'
    },
    contado_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Fecha y hora en que se realizó el conteo'
    }
}, {
    tableName: 'conteo_articulos',
    timestamps: true,
    indexes: [
        {
            fields: ['conteo_ciclico_id']
        },
        {
            fields: ['articulo_id']
        },
        {
            unique: true,
            fields: ['conteo_ciclico_id', 'articulo_id'],
            name: 'unique_conteo_articulo'
        }
    ]
});

export default ConteoArticulo;
