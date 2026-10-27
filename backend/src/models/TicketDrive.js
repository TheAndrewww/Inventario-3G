import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * Subida del ticket de cada Orden de salida a la carpeta de Drive de su proyecto, hecha por el servidor (27-oct-2026,
 * pedido del dueño). Un renglón por ticket: lo crea crearPedido al guardar la orden y lo actualiza cada intento de
 * subida (el de en seguida y, si falla, los reintentos de cada 10 minutos). Así la subida no se pierde si el servidor
 * se reinicia, y /api/inicio3g/v1/salud dice cuántos tickets no han llegado a Drive y por qué.
 *
 * Estados: pendiente (por subir) · subido · sin_carpeta (el proyecto todavía no tiene carpeta en PRODUCCION) ·
 * error (Drive falló; se reintenta) · no_aplica (el pedido se canceló o ya no tiene proyecto).
 * Tabla con su propio sync() al arrancar (crea si no existe; nunca alter).
 */
export const ESTADOS_TICKET_DRIVE = ['pendiente', 'subido', 'sin_carpeta', 'error', 'no_aplica'];

const TicketDrive = sequelize.define('TicketDrive', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    movimiento_id: { type: DataTypes.INTEGER, allowNull: false, unique: true, comment: 'El pedido (movimientos.id)' },
    ticket_id: { type: DataTypes.STRING(40), allowNull: false, comment: 'PED-DDMMAA-HHMM-NN' },
    proyecto: { type: DataTypes.STRING(200), allowNull: false },
    estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pendiente', comment: 'pendiente | subido | sin_carpeta | error | no_aplica' },
    intentos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ultimo_error: { type: DataTypes.TEXT, allowNull: true, comment: 'Por qué no se subió, en palabras' },
    siguiente_intento: { type: DataTypes.DATE, allowNull: true, comment: 'Desde cuándo se puede reintentar; null = ya no' },
    archivo_id: { type: DataTypes.STRING(100), allowNull: true, comment: 'Id del PDF en Drive' },
    archivo_url: { type: DataTypes.TEXT, allowNull: true, comment: 'Liga para abrir el PDF en Drive' },
    subido_en: { type: DataTypes.DATE, allowNull: true }
}, {
    tableName: 'tickets_drive',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ fields: ['estado'] }]
});

export default TicketDrive;
