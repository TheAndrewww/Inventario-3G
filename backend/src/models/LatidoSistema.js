import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * D1 · PLA-15 — Último latido de la línea del contable (Julia, Finanzas).
 *
 * Julia consulta cada minuto la cola de avisos de Planta (GET /api/avisos-whatsapp/pendientes) y desde FIN-08 agrega a
 * esa consulta las cabeceras X-3G-Latido-*: estado de su WhatsApp, último envío, versión y piezas (checador,
 * impresora). Planta guarda aquí el último latido de cada sistema (un renglón por sistema, se reemplaza) para que
 * sobreviva a un reinicio, y Ventas lo lee con GET /api/sistemas/v1/latidos (VEN-11). Sin teléfonos ni mensajes.
 * Tabla con su propio sync() al arrancar (crea si no existe; nunca alter).
 */
const LatidoSistema = sequelize.define('LatidoSistema', {
    sistema: {
        type: DataTypes.STRING(30),
        primaryKey: true,
        comment: 'Quién late: finanzas (la línea del contable)'
    },
    visto: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Cuándo llegó el latido a Planta (hora de Planta)'
    },
    whatsapp: {
        type: DataTypes.STRING(30),
        allowNull: true,
        comment: 'Estado de la sesión tal como lo dice Julia: WORKING, STARTING, SCAN_QR_CODE, FAILED, STOPPED, UNKNOWN'
    },
    whatsapp_desde: {
        type: DataTypes.DATE,
        allowNull: true
    },
    ultimo_envio: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Último mensaje que salió por la línea (lo dice Julia)'
    },
    version: {
        type: DataTypes.STRING(40),
        allowNull: true
    },
    piezas: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: '[{ id, estado: ok|aviso|mal|sin_dato, ultimo }] (checador, impresora)'
    }
}, {
    tableName: 'latidos_sistemas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default LatidoSistema;
