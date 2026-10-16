import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * B1 paso 1 · PLA-14 — Bitácora de los avisos que Carla y Julia mandan a Producción por la línea del contable.
 *
 * Finanzas la llena con POST /api/sistemas/v1/bitacora-avisos (FIN-09, bandera BITACORA_A_PLANTA) después de cada
 * envío que SÍ salió: recordatorios del grupo Producción, Producción en privado (Charly), la confirmación del
 * calendario (Susana) y la cita confirmada al asesor. Planta › Producción › Avisos la junta con la cola propia.
 *
 * Solo se agregan renglones (nadie los edita). Una entrega repetida no se anota dos veces: además de la
 * Idempotency-Key de la puerta, `huella` (origen, destino, hora de envío y texto) es única.
 * Tabla con su propio sync() al arrancar (crea si no existe; nunca alter).
 */
const BitacoraAviso = sequelize.define('BitacoraAviso', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    origen: {
        type: DataTypes.STRING(20),
        allowNull: false,
        comment: 'Quién lo mandó: carla | julia'
    },
    destino: {
        type: DataTypes.STRING(20),
        allowNull: false,
        comment: 'A quién: produccion (el grupo) | charly | susana | asesor'
    },
    texto: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'El mensaje tal como salió (los teléfonos de 10 dígitos se guardan como •••)'
    },
    enviado_en: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Cuándo salió por WhatsApp (lo dice Finanzas)'
    },
    proyecto: {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    obra_id: {
        type: DataTypes.STRING(12),
        allowNull: true,
        comment: 'ID 3G de la obra (C1), si Finanzas lo trae'
    },
    referencia: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Referencia propia de Finanzas (opcional)'
    },
    huella: {
        type: DataTypes.STRING(64),
        allowNull: false,
        comment: 'SHA-256 de origen, destino, hora de envío y texto: la misma entrega no se anota dos veces'
    }
}, {
    tableName: 'bitacora_avisos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        { unique: true, fields: ['huella'] },
        { fields: ['enviado_en'] }
    ]
});

export default BitacoraAviso;
