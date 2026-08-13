import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

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
        comment: 'Destino lógico: compras | contable. El bot resuelve a qué chat corresponde'
    },
    mensaje: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    estado: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'pendiente',
        comment: 'pendiente | enviado | error'
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
    }
}, {
    tableName: 'avisos_whatsapp',
    timestamps: true,
    indexes: [
        { fields: ['estado'] }
    ]
});

export default AvisoWhatsApp;
