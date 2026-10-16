import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * E1 · PLA-23 — Entrada a Planta con Cuentas 3G.
 *
 * Dos tablas chicas, cada una con su propio sync() al arrancar, y SOLO si CUENTAS3G_MODO no está apagado (apagado =
 * la base queda idéntica a hoy). Crean si no existen; nunca alter.
 *
 *   cuentas3g_entradas  Una fila por entrada que NO es la de siempre: con cuenta 3G (via 'cuentas3g', con el sub de la
 *                       persona) o con la llave de emergencia (via 'emergencia', PLA-24). Sirve para el reporte «quién no
 *                       ha entrado con su cuenta 3G» y deja registro de cada emergencia. Sin correos, IP ni fichas.
 *                       usuario_id sin llave foránea a propósito: borrar un usuario para siempre sigue igual que hoy.
 *   cuentas3g_estado    Lo que el paquete cuentas3g-cliente guarda para arrancar aunque Cuentas 3G no responda: la última
 *                       lista de versiones buena ({sub, ver, activo}, sin nombres) y los avisos de baja recientes.
 */
export const Cuentas3gEntrada = sequelize.define('Cuentas3gEntrada', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    usuario_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Usuario de Planta con el que entró (empate por correo o por «correo en Planta»)'
    },
    via: {
        type: DataTypes.STRING(20),
        allowNull: false,
        comment: "cuentas3g | emergencia"
    },
    c3g_sub: {
        type: DataTypes.STRING(64),
        allowNull: true,
        comment: 'Identificador de la persona en Cuentas 3G (p_…); vacío en emergencia'
    },
    empate: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: "correo | correo_en_planta (cómo se encontró al usuario)"
    }
}, {
    tableName: 'cuentas3g_entradas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [{ fields: ['usuario_id'] }, { fields: ['via', 'created_at'] }]
});

export const Cuentas3gEstado = sequelize.define('Cuentas3gEstado', {
    clave: {
        type: DataTypes.STRING(40),
        primaryKey: true
    },
    valor: {
        type: DataTypes.JSONB,
        allowNull: true
    }
}, {
    tableName: 'cuentas3g_estado',
    timestamps: true,
    createdAt: false,
    updatedAt: 'updated_at'
});

export default { Cuentas3gEntrada, Cuentas3gEstado };
