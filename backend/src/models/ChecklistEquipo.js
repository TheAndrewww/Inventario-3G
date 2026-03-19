import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const ChecklistEquipo = sequelize.define('ChecklistEquipo', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    equipo_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'camionetas',
            key: 'id'
        },
        comment: 'Equipo al que se asigna el ítem'
    },
    checklist_item_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'checklist_items',
            key: 'id'
        },
        comment: 'Ítem de checklist asignado'
    },
    cantidad_requerida: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Cantidad requerida para este equipo (override del valor por defecto del ítem)'
    },
    notas: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas adicionales sobre el ítem para este equipo'
    }
}, {
    tableName: 'checklist_equipos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ['equipo_id', 'checklist_item_id'],
            name: 'unique_equipo_checklist_item'
        }
    ]
});

export default ChecklistEquipo;
