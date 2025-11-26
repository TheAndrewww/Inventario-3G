import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const TipoHerramientaRenta = sequelize.define('TipoHerramientaRenta', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    imagen_url: {
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
        allowNull: false,
        references: {
            model: 'ubicaciones',
            key: 'id'
        }
    },
    proveedor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'proveedores',
            key: 'id'
        }
    },
    precio_unitario: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
    },
    prefijo_codigo: {
        type: DataTypes.STRING(10),
        allowNull: false,
        comment: 'Prefijo para generar códigos únicos (ej: PP, CP, TD)'
    },
    total_unidades: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total de unidades creadas'
    },
    unidades_disponibles: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Unidades actualmente disponibles'
    },
    unidades_asignadas: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Unidades actualmente asignadas'
    },
    articulo_origen_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'ID del artículo original si fue migrado',
        references: {
            model: 'articulos',
            key: 'id'
        }
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated_at'
    }
}, {
    tableName: 'tipos_herramienta_renta',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true
});

export default TipoHerramientaRenta;
