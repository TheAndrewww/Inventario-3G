import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const ChecklistItemArticulo = sequelize.define('ChecklistItemArticulo', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    checklist_item_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'checklist_items',
            key: 'id'
        }
    },
    articulo_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'articulos',
            key: 'id'
        }
    }
}, {
    tableName: 'checklist_item_articulos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
        {
            unique: true,
            fields: ['checklist_item_id', 'articulo_id'],
            name: 'unique_checklist_item_articulo'
        }
    ]
});

export default ChecklistItemArticulo;
