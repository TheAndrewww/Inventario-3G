import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Proveedor = sequelize.define('Proveedor', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING(200),
        allowNull: false,
        comment: 'Nombre o razón social del proveedor'
    },
    rfc: {
        type: DataTypes.STRING(13),
        allowNull: true,
        unique: true,
        comment: 'RFC del proveedor (opcional)'
    },
    contacto: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: 'Nombre de la persona de contacto'
    },
    telefono: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'Teléfono de contacto'
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Correo electrónico de contacto',
        validate: {
            isEmail: true
        }
    },
    direccion: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Dirección completa del proveedor'
    },
    ciudad: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    estado: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    codigo_postal: {
        type: DataTypes.STRING(10),
        allowNull: true
    },
    notas: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas adicionales sobre el proveedor'
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
    }
}, {
    tableName: 'proveedores',
    timestamps: true,
    indexes: [
        {
            fields: ['nombre']
        },
        {
            fields: ['activo']
        },
        {
            fields: ['rfc']
        }
    ]
});

export default Proveedor;
