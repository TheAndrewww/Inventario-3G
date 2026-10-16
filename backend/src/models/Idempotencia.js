import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * Escrituras entre sistemas ya atendidas (plan §7.1 · PLA-13): cada POST/PUT/PATCH de /api/sistemas/v1 trae
 * `Idempotency-Key`; si la misma llave llega otra vez del mismo origen a la misma ruta en 7 días, se devuelve la misma
 * respuesta sin volver a escribir. `huella_cuerpo` (SHA-256 del cuerpo) detecta una llave reusada con otro cuerpo (409).
 * Sin datos personales: solo la respuesta que ya se dio. Tabla nueva: su propio sync() si no existe (nunca alter).
 */
const Idempotencia = sequelize.define('Idempotencia', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    origen: { type: DataTypes.STRING(30), allowNull: false },
    clave: { type: DataTypes.STRING(200), allowNull: false },
    ruta: { type: DataTypes.STRING(200), allowNull: false },
    huella_cuerpo: { type: DataTypes.STRING(64), allowNull: false },
    estado_http: { type: DataTypes.INTEGER, allowNull: true, comment: 'null mientras la primera petición sigue en curso' },
    respuesta: { type: DataTypes.JSONB, allowNull: true },
    vence: { type: DataTypes.DATE, allowNull: false }
}, {
    tableName: 'idempotencia_sistemas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { unique: true, fields: ['origen', 'clave', 'ruta'] },
        { fields: ['vence'] }
    ]
});

export default Idempotencia;
