import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const RolloMembrana = sequelize.define('RolloMembrana', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    articulo_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'articulos',
            key: 'id'
        },
        comment: 'Artículo tipo membrana/malla al que pertenece este rollo'
    },
    identificador: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Código único del rollo (ej: R-001, MALLA-HDPE-001)'
    },
    metraje_total: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0
        },
        comment: 'Metros lineales totales del rollo al ingresar'
    },
    metraje_restante: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0
        },
        comment: 'Metros lineales disponibles actualmente'
    },
    color: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Color de la membrana (opcional)'
    },
    estado: {
        type: DataTypes.ENUM('disponible', 'en_uso', 'agotado'),
        defaultValue: 'disponible',
        allowNull: false,
        comment: 'Estado del rollo'
    },
    fecha_ingreso: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Fecha en que se registró el rollo'
    },
    observaciones: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'rollos_membrana',
    timestamps: true,
    indexes: [
        {
            fields: ['articulo_id']
        },
        {
            fields: ['identificador']
        },
        {
            fields: ['estado']
        },
        {
            fields: ['activo']
        }
    ]
});

export default RolloMembrana;
