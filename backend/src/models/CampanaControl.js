import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const CampanaControl = sequelize.define('CampanaControl', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    quarter: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1,
            max: 4
        },
        comment: 'Trimestre (1-4)'
    },
    area: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Área: diseno, manufactura, herreria, equipo1-4'
    },
    week: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1,
            max: 52
        },
        comment: 'Semana del año (1-52)'
    },
    status: {
        type: DataTypes.ENUM('good', 'bad'),
        allowNull: true,
        comment: 'Estado: good (✓) o bad (✗)'
    },
    note: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Nota explicativa'
    },
    year: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 2026,
        comment: 'Año de la campaña'
    }
}, {
    tableName: 'campana_control',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            unique: true,
            fields: ['year', 'quarter', 'area', 'week']
        }
    ]
});

export default CampanaControl;
