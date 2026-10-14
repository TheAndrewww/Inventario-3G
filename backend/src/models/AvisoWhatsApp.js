import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { esUrgente } from '../utils/horarioAvisos.js';

/**
 * Cola de avisos que deben publicarse en WhatsApp.
 *
 * El inventario no tiene sesión de WhatsApp: deja aquí el mensaje y el bot
 * contable —que sí la tiene— lo consulta y lo publica. Se hace así (el bot
 * jala en vez de que nosotros empujemos) porque el VPS del bot no expone
 * puertos a internet: su panel no tiene contraseña y abrirlo sería un riesgo.
 *
 * De paso la cola da tolerancia a fallas: si el bot está caído, los avisos se
 * acumulan y salen cuando vuelve, en lugar de perderse.
 */
const AvisoWhatsApp = sequelize.define('AvisoWhatsApp', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    destino: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'compras',
        comment: 'Destino lógico: compras | contable | produccion. El bot resuelve a qué chat corresponde'
    },
    mensaje: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    tipo: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: 'informativo',
        comment: 'informativo | aprobacion_orden | orden_aprobada | llegada (C4 paso 3). Los de aprobación esperan una reacción'
    },
    referencia_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'ID del registro al que se refiere (p. ej. la orden de compra por autorizar)'
    },
    estado: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'pendiente',
        comment: 'pendiente | enviado | error | descartado (D7 · PLA-18: reemplazado antes de salir)'
    },
    intentos: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    error: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Último error reportado por el bot'
    },
    enviado_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    reemplazado_por_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'A9 · PLA-06: aviso más nuevo de la misma orden (se volvió a pedir la autorización). Una reacción sobre este ya no aprueba'
    },
    urgente: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'D7 · PLA-18: con HORARIO_AVISOS, solo los urgentes salen de noche y en domingo. Se marca al encolar con AVISOS_URGENTES (vacía = ninguno)'
    },
    datos: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'C4 paso 3 · PLA-16 (LLEGADA_CON_DATOS): datos del aviso «Llegó material» (tipo llegada): { orden, folioFactura, fotos }. El texto no cambia'
    }
}, {
    tableName: 'avisos_whatsapp',
    timestamps: true,
    // El proyecto usa underscored global: las columnas reales son created_at /
    // updated_at. Se declaran explícitas, como en OrdenCompra, para que las
    // consultas no las busquen en camelCase.
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['estado'] }
    ],
    hooks: {
        // D7 · PLA-18: el aviso nace urgente si su tipo o su destino están en AVISOS_URGENTES (vacía por omisión).
        beforeCreate(aviso) {
            if (!aviso.urgente) aviso.urgente = esUrgente({ tipo: aviso.tipo, destino: aviso.destino });
        }
    }
});

export default AvisoWhatsApp;
