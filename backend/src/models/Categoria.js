import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Categoria = sequelize.define('Categoria', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    color: {
        type: DataTypes.STRING(20),
        allowNull: true,
        defaultValue: '#6B7280', // gray-500
        comment: 'Color hex para identificación visual'
    },
    icono: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Nombre del icono (lucide-react)'
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'categorias',
    timestamps: true
});

export default Categoria;
