import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import bcrypt from 'bcryptjs';

const Usuario = sequelize.define('Usuario', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    rol: {
        type: DataTypes.ENUM('administrador', 'diseñador', 'compras', 'almacen', 'encargado'),
        defaultValue: 'almacen',
        allowNull: false,
        comment: 'Roles: administrador (acceso total), diseñador (diseño de productos), compras (gestión de compras), almacen (gestión de inventario), encargado (supervisión general)'
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    telefono: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    puesto: {
        type: DataTypes.STRING(100),
        allowNull: true
    }
}, {
    tableName: 'usuarios',
    timestamps: true
});

// Hook para encriptar password antes de crear
Usuario.beforeCreate(async (usuario) => {
    if (usuario.password) {
        const salt = await bcrypt.genSalt(10);
        usuario.password = await bcrypt.hash(usuario.password, salt);
    }
});

// Hook para encriptar password antes de actualizar
Usuario.beforeUpdate(async (usuario) => {
    if (usuario.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        usuario.password = await bcrypt.hash(usuario.password, salt);
    }
});

// Método para comparar password
Usuario.prototype.compararPassword = async function(passwordIngresado) {
    return await bcrypt.compare(passwordIngresado, this.password);
};

// Método para ocultar password en respuestas JSON
Usuario.prototype.toJSON = function() {
    const valores = Object.assign({}, this.get());
    delete valores.password;
    return valores;
};

export default Usuario;
