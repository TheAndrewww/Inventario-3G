import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const UnidadHerramientaRenta = sequelize.define('UnidadHerramientaRenta', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    tipo_herramienta_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'tipos_herramienta_renta',
            key: 'id'
        }
    },
    codigo_unico: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Código único de la unidad (ej: PP-001, CP-005)'
    },
    codigo_ean13: {
        type: DataTypes.STRING(13),
        allowNull: true,
        unique: true,
        comment: 'Código de barras EAN-13 para la unidad'
    },
    numero_serie: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Número de serie del fabricante (opcional)'
    },
    estado: {
        type: DataTypes.ENUM('disponible', 'asignada', 'en_reparacion', 'perdida', 'baja'),
        allowNull: false,
        defaultValue: 'disponible'
    },
    usuario_asignado_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'usuarios',
            key: 'id'
        }
    },
    equipo_asignado_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'equipos',
            key: 'id'
        }
    },
    fecha_asignacion: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de la asignación actual'
    },
    fecha_adquisicion: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha de compra/adquisición'
    },
    observaciones: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    etiquetado: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Indica si la unidad tiene etiqueta generada'
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
    tableName: 'unidades_herramienta_renta',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true
});

export default UnidadHerramientaRenta;
