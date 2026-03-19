import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const ChecklistItem = sequelize.define('ChecklistItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING(200),
        allowNull: false,
        comment: 'Nombre genérico del ítem (ej. Rotomartillo, Esmeril)'
    },
    especificacion: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: 'Especificación adicional (ej. 3/16", 30m, Pato)'
    },
    seccion: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Sección o categoría dentro de la checklist (ej. ELECTRICA, HERRAMIENTA DE MANO, BROCAS, EPP)'
    },
    tipo: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'herramienta',
        validate: {
            isIn: [['herramienta', 'material']]
        },
        comment: 'Tipo de ítem: herramienta o material/consumible'
    },
    cantidad_requerida: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Cantidad requerida por defecto (puede sobreescribirse por equipo)'
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'checklist_items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true
});

export default ChecklistItem;
