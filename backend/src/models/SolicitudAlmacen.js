import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * Pedidos de los encargados a Almacén (23-oct-2026, pedido del jefe): desde su tableta, el encargado (GERAS, MIGUEL,
 * MANE…) le pide a Charly reposición de stock o el uso de una herramienta especial. La tableta habla con Operación y
 * Operación lo deja aquí por la puerta entre sistemas (POST /api/sistemas/v1/almacen/solicitudes, alcance
 * «almacen.solicitar»), para que quede registrado en Planta. Charly lo atiende en «Pedidos de encargados».
 *
 * `referencia` es el id del pedido en Operación: la misma referencia no se anota dos veces.
 * Tabla con su propio sync() al arrancar (crea si no existe; nunca alter).
 */
export const TIPOS_SOLICITUD_ALMACEN = ['REPOSICION', 'HERRAMIENTA_ESPECIAL'];
export const ESTADOS_SOLICITUD_ALMACEN = ['pendiente', 'surtida', 'parcial', 'rechazada'];

const SolicitudAlmacen = sequelize.define('SolicitudAlmacen', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    encargado: { type: DataTypes.STRING(40), allowNull: false, comment: 'Quién lo pide: GERAS, MIGUEL, MANE…' },
    tipo: { type: DataTypes.STRING(30), allowNull: false, comment: 'REPOSICION | HERRAMIENTA_ESPECIAL' },
    texto: { type: DataTypes.TEXT, allowNull: false, comment: 'Lo que pide, como lo escribió' },
    para_fecha: { type: DataTypes.DATEONLY, allowNull: true, comment: 'Para cuándo lo necesita (AAAA-MM-DD)' },
    proyecto: { type: DataTypes.STRING(200), allowNull: true },
    obra_id: { type: DataTypes.STRING(12), allowNull: true, comment: 'ID 3G «3G-AA-NNNN»' },
    referencia: { type: DataTypes.STRING(100), allowNull: false, unique: true, comment: 'Id del pedido en Operación' },
    estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pendiente', comment: 'pendiente | surtida | parcial | rechazada' },
    nota_almacen: { type: DataTypes.TEXT, allowNull: true, comment: 'Lo que contestó Almacén' },
    atendida_por: { type: DataTypes.STRING(100), allowNull: true, comment: 'Nombre de quien lo atendió' },
    atendida_en: { type: DataTypes.DATE, allowNull: true }
}, {
    tableName: 'solicitudes_almacen',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ fields: ['encargado'] }, { fields: ['estado'] }]
});

export default SolicitudAlmacen;
