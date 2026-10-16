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

/**
 * B3 paso 3 · PLA-20 — Ficha maestra del proveedor (una por proveedor; tabla propia para que el JSON de proveedores,
 * artículos y órdenes no cambie). Nombre corto, razones sociales (cada una con su RFC), alias, contactos y el trato
 * para Julia (tú/usted, si pide estado de cuenta y qué pide al pagar). La llena Compras en Planta › Proveedores (Diseño 3G);
 * Julia la lee por la puerta (FIN-23). Se crea al arrancar con su propio sync (nunca alter); si se borra el proveedor,
 * se borra su ficha (ON DELETE CASCADE).
 */
export const ProveedorFicha = sequelize.define('ProveedorFicha', {
    proveedor_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: { model: 'proveedores', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    },
    nombre_corto: {
        type: DataTypes.STRING(60),
        allowNull: true,
        comment: 'Cómo se le dice en la oficina (p. ej. «Aceros Bajío»)'
    },
    razones_sociales: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        comment: '[{ razon, rfc }] con las que factura'
    },
    alias: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        comment: 'Otros nombres con los que aparece (carpetas, calendario, comprobantes)'
    },
    contactos: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        comment: '[{ nombre, telefono, correo, puesto, avisos }]; avisos = le escribe Julia'
    },
    trato: {
        type: DataTypes.STRING(10),
        allowNull: true,
        comment: 'tu | usted (cómo le escribe Julia)'
    },
    pide_edo_cta: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        comment: 'Si pide estado de cuenta antes del corte'
    },
    pide_al_pagar: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'complemento | factura (qué se le pide después de pagar)'
    },
    actualizado_por_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'proveedores_ficha',
    timestamps: true,
    underscored: true
});

/**
 * B3 paso 3 · PLA-20 — Crédito y plazo según CTAS CRÉDITO (decisión D-9: los mantiene Contabilidad). Julia manda la lista
 * completa por POST /api/sistemas/v1/proveedores/credito (FIN-23); Planta solo la guarda y la muestra. Un renglón por
 * pestaña de CTAS CRÉDITO; las que ya no vienen quedan «vigente = false».
 */
export const ProveedorCredito = sequelize.define('ProveedorCredito', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    pestana: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true,
        comment: 'Pestaña de CTAS CRÉDITO'
    },
    rfc: {
        type: DataTypes.STRING(13),
        allowNull: true
    },
    nombre: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    plazo_dias: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    vigente: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    recibido_en: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'proveedores_credito',
    timestamps: true,
    underscored: true
});

export default Proveedor;
