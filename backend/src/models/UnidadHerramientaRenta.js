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
        comment: 'DEPRECATED: Ya no se usa, se mantiene por compatibilidad'
    },
    numero_serie: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Número de serie del fabricante (opcional)'
    },
    // ===== NUEVOS CAMPOS (Refactorización 2026-01-08) =====
    condicion: {
        type: DataTypes.ENUM('bueno', 'regular', 'malo', 'perdido', 'baja'),
        allowNull: false,
        defaultValue: 'bueno',
        comment: 'Condición física de la herramienta: bueno, regular, malo, perdido, baja'
    },
    estatus: {
        type: DataTypes.ENUM('disponible', 'asignado', 'en_reparacion', 'en_transito'),
        allowNull: false,
        defaultValue: 'disponible',
        comment: 'Estatus de disponibilidad: disponible, asignado, en_reparacion, en_transito'
    },
    // ===== CAMPO DEPRECATED (mantener temporalmente para compatibilidad) =====
    estado: {
        type: DataTypes.ENUM('buen_estado', 'estado_regular', 'mal_estado', 'asignada', 'disponible', 'en_reparacion', 'perdida', 'baja', 'en_transito', 'pendiente_devolucion'),
        allowNull: true,
        defaultValue: 'buen_estado',
        comment: 'DEPRECATED: Usar condicion + estatus en su lugar. Se mantiene por compatibilidad.'
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
    fecha_vencimiento_asignacion: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha límite para devolver la herramienta asignada'
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
    ubicacion_actual: {
        type: DataTypes.ENUM('almacen', 'camioneta', 'empleado', 'asignada'),
        allowNull: false,
        defaultValue: 'almacen',
        comment: 'Ubicación actual de la unidad'
    },
    camioneta_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'camionetas',
            key: 'id'
        },
        comment: 'ID de la camioneta donde está ubicada (si aplica)'
    },
    empleado_propietario_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'usuarios',
            key: 'id'
        },
        comment: 'ID del empleado propietario de la herramienta personal (si aplica)'
    },
    etiquetado: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Indica si la unidad tiene etiqueta generada'
    },
    motivo_estado: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Motivo del cambio de estado (reparación, pérdida, baja, etc.)'
    },
    fecha_cambio_estado: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha del último cambio de estado'
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
