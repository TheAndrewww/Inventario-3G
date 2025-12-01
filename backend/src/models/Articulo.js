import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Articulo = sequelize.define('Articulo', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    codigo_ean13: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Código de barras del artículo (soporta múltiples formatos)',
        field: 'codigo_ean13' // Mantiene compatibilidad con BD existente
    },
    codigo_tipo: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'EAN13',
        comment: 'Tipo de código: EAN13, EAN8, UPCA, UPCE, CODE128, CODE39, QRCODE, DATAMATRIX',
        validate: {
            isIn: [['EAN13', 'EAN8', 'UPCA', 'UPCE', 'CODE128', 'CODE39', 'QRCODE', 'DATAMATRIX']]
        }
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
        comment: 'Stock actual del artículo (puede ser negativo si hay faltante)'
    },
    stock_minimo: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: 0
        }
    },
    stock_maximo: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Stock máximo recomendado para el artículo',
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
    proveedor_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'proveedores',
            key: 'id'
        },
        comment: 'Proveedor del artículo'
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
    },
    es_herramienta: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Indica si el artículo es una herramienta que se renta/presta'
    },
    pendiente_revision: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Indica si el artículo fue creado por almacén y está pendiente de revisión por admin'
    },
    etiquetado: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Indica si el artículo tiene etiquetas generadas'
    }
}, {
    tableName: 'articulos',
    timestamps: true,
    indexes: [
        {
            fields: ['codigo_ean13']
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
