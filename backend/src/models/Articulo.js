import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Articulo = sequelize.define('Articulo', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    codigo_qr: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        comment: 'Código QR único del artículo'
    },
    nombre: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    categoria_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'categorias',
            key: 'id'
        }
    },
    ubicacion_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'ubicaciones',
            key: 'id'
        }
    },
    stock_actual: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0
        }
    },
    stock_minimo: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0
        }
    },
    unidad: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'piezas',
        comment: 'Unidad de medida: piezas, kg, metros, litros, cajas, etc.'
    },
    costo_unitario: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0
        }
    },
    imagen_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'URL de la imagen del artículo'
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    sku: {
        type: DataTypes.STRING(100),
        allowNull: true,
        unique: true,
        comment: 'SKU del proveedor (opcional)'
    }
}, {
    tableName: 'articulos',
    timestamps: true,
    indexes: [
        {
            fields: ['codigo_qr']
        },
        {
            fields: ['nombre']
        },
        {
            fields: ['categoria_id']
        },
        {
            fields: ['activo']
        }
    ]
});

export default Articulo;
