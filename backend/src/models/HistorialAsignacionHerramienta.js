import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const HistorialAsignacionHerramienta = sequelize.define('HistorialAsignacionHerramienta', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    unidad_herramienta_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'unidades_herramienta_renta',
            key: 'id'
        }
    },
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'usuarios',
            key: 'id'
        }
    },
    equipo_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'equipos',
            key: 'id'
        }
    },
    tipo_movimiento: {
        type: DataTypes.ENUM('asignacion', 'devolucion', 'reparacion', 'baja'),
        allowNull: false
    },
    fecha_asignacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    fecha_devolucion: {
        type: DataTypes.DATE,
        allowNull: true
    },
    observaciones: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    registrado_por_usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'usuarios',
            key: 'id'
        }
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
    tableName: 'historial_asignaciones_herramienta',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true
});

export default HistorialAsignacionHerramienta;
