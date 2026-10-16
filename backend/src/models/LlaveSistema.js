import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * Llaves de otros sistemas que entran a las puertas de Planta (D2, D3, B8 · PLA-13; plan §7.1).
 *
 * La llave y su huella NO se guardan aquí: la huella SHA-256 vive en LLAVE_ENTRANTE_<ORIGEN>_SHA256 y los alcances en
 * ALCANCES_<ORIGEN> (variables de Railway). Esta tabla solo guarda lo que necesita /llaves (B8) para decir desde cuándo
 * existe cada llave y cuándo se usó por última vez. `marca` son los primeros 12 caracteres de un SHA-256 de la huella:
 * sirve para notar que la llave se cambió (entonces `creada` vuelve a empezar) sin guardar la huella.
 * Tabla nueva: se crea con su propio sync() si no existe (nunca alter).
 */
const LlaveSistema = sequelize.define('LlaveSistema', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    origen: { type: DataTypes.STRING(30), allowNull: false, unique: true, comment: 'inicio, cuentas, finanzas, ventas…' },
    marca: { type: DataTypes.STRING(12), allowNull: false, comment: 'Para notar un cambio de llave; no es la huella' },
    alcances: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' },
    creada: { type: DataTypes.DATE, allowNull: false, comment: 'Primera vez que Planta vio esta llave' },
    ultimo_uso: { type: DataTypes.DATE, allowNull: true },
    usos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
    tableName: 'llaves_sistemas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

export default LlaveSistema;
