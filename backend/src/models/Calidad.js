import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * Panel de calidad (28-oct-2026, «3G Calidad»): la hoja de control de calidad de cada obra (Manufactura y Herrería), su
 * aval, la bitácora, las sugerencias de la llamada de las 16:00 y las tabletas vinculadas.
 *
 * Seis tablas, cada una con su propio sync() al arrancar (server.js: crea si no existe; nunca alter). Se crean siempre,
 * pero con PANEL_CALIDAD apagada nada las escribe.
 *
 * Ojo con la obra: el id de produccion_proyectos cambia cuando se mueven renglones del Excel; la llave estable es el ID 3G
 * (obra_id). Por eso la hoja guarda las dos cosas y una copia del nombre (proyecto_nombre y su forma normalizada,
 * proyecto_clave) para volver a ligarla por nombre si el id cambió (services/calidad.service.js › ligarHoja).
 */
const tiempos = { timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' };

export const ESTADOS_HOJA = ['sin_revisar', 'en_revision', 'con_defectos', 'lista', 'avalada'];
export const ESTADOS_REPORTE = ['pendiente', 'subido', 'sin_carpeta', 'error', 'no_aplica'];
export const ESTADOS_SUGERENCIA = ['pendiente', 'aplicada', 'descartada', 'sin_obra'];

export const CalidadHoja = sequelize.define('CalidadHoja', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    proyecto_id: { type: DataTypes.INTEGER, allowNull: true, comment: 'produccion_proyectos.id (cambia si se mueve el renglón del Excel)' },
    obra_id: { type: DataTypes.STRING(16), allowNull: true, comment: 'ID 3G de la obra (la llave estable), si ya lo tiene' },
    proyecto_nombre: { type: DataTypes.STRING(200), allowNull: false, comment: 'Copia del nombre del proyecto' },
    proyecto_clave: { type: DataTypes.STRING(200), allowNull: false, comment: 'El nombre normalizado (sin acentos, minúsculas) para volver a ligar' },
    atributos: { type: DataTypes.JSONB, allowNull: true, comment: 'Qué lleva la obra (atributos_proyecto del checklist); null = sin decir' },
    estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'sin_revisar', comment: ESTADOS_HOJA.join(' | ') },
    observaciones_instalacion: { type: DataTypes.TEXT, allowNull: true },
    avalada_en: { type: DataTypes.DATE, allowNull: true },
    avalada_por: { type: DataTypes.STRING(120), allowNull: true, comment: 'Nombre de quien firma «Autoriza»' },
    aval_nota: { type: DataTypes.TEXT, allowNull: true },
    version_config: { type: DataTypes.STRING(20), allowNull: true, comment: 'Versión del checklist con la que se llenó' },
    reporte_estado: { type: DataTypes.STRING(20), allowNull: true, comment: `Reporte PDF en Drive: ${ESTADOS_REPORTE.join(' | ')}` },
    reporte_archivo_id: { type: DataTypes.STRING(100), allowNull: true },
    reporte_intentos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    reporte_siguiente_intento: { type: DataTypes.DATE, allowNull: true },
    reporte_error: { type: DataTypes.TEXT, allowNull: true }
}, {
    tableName: 'calidad_hojas',
    ...tiempos,
    indexes: [{ fields: ['proyecto_id'] }, { fields: ['obra_id'] }, { fields: ['proyecto_clave'] }, { fields: ['estado'] }]
});

export const CalidadPunto = sequelize.define('CalidadPunto', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    hoja_id: { type: DataTypes.INTEGER, allowNull: false },
    hoja: { type: DataTypes.STRING(20), allowNull: false, comment: 'MANUFACTURA | HERRERIA' },
    punto_id: { type: DataTypes.STRING(8), allowNull: false, comment: 'M1…M14, H1…H13' },
    estado: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'pendiente', comment: 'pendiente | ok | defecto | na' },
    nota: { type: DataTypes.TEXT, allowNull: true },
    sale_asi: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, comment: 'Defecto que sale así a instalación' },
    actualizado_por: { type: DataTypes.STRING(120), allowNull: true, comment: 'Nombre o dispositivo' },
    actualizado_en: { type: DataTypes.DATE, allowNull: true, comment: 'Cuándo se marcó (en la tableta, aunque llegue después)' },
    origen: { type: DataTypes.STRING(12), allowNull: true, comment: 'tableta | web | carla' },
    cambio_id: { type: DataTypes.STRING(80), allowNull: true, unique: true, comment: 'Último cambio aplicado (idempotencia de la app sin señal)' }
}, {
    tableName: 'calidad_puntos',
    ...tiempos,
    indexes: [{ unique: true, fields: ['hoja_id', 'punto_id'] }]
});

export const CalidadEvento = sequelize.define('CalidadEvento', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    hoja_id: { type: DataTypes.INTEGER, allowNull: true },
    proyecto_id: { type: DataTypes.INTEGER, allowNull: true },
    tipo: { type: DataTypes.STRING(30), allowNull: false, comment: 'marco | atributos | avalo | reabrio | defecto_reabrio | preparado_manual | espera_calidad | sugerencia_aplicada | sugerencia_descartada | religo' },
    punto_id: { type: DataTypes.STRING(8), allowNull: true },
    detalle: { type: DataTypes.TEXT, allowNull: true },
    quien: { type: DataTypes.STRING(120), allowNull: true },
    origen: { type: DataTypes.STRING(12), allowNull: true },
    cambio_id: { type: DataTypes.STRING(80), allowNull: true, unique: true, comment: 'El cambio de la tableta que lo produjo (un mismo cambio no se aplica dos veces)' },
    datos: { type: DataTypes.JSONB, allowNull: true }
}, {
    tableName: 'calidad_eventos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [{ fields: ['hoja_id'] }]
});

export const CalidadSugerencia = sequelize.define('CalidadSugerencia', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    hoja_id: { type: DataTypes.INTEGER, allowNull: true },
    proyecto_id: { type: DataTypes.INTEGER, allowNull: true },
    obra_id: { type: DataTypes.STRING(16), allowNull: true },
    obra_ref: { type: DataTypes.STRING(200), allowNull: true, comment: 'Cómo llegó la obra (ID 3G o folio)' },
    punto_id: { type: DataTypes.STRING(8), allowNull: true, comment: 'null si el punto no existe en el checklist' },
    punto_texto: { type: DataTypes.STRING(120), allowNull: true, comment: 'El punto tal como llegó' },
    estado: { type: DataTypes.STRING(12), allowNull: true, comment: 'ok | defecto | na | pendiente (lo que dijo la llamada)' },
    nota: { type: DataTypes.TEXT, allowNull: true },
    sale_asi: { type: DataTypes.BOOLEAN, allowNull: true },
    discrepancia: { type: DataTypes.TEXT, allowNull: true },
    fecha_llamada: { type: DataTypes.DATEONLY, allowNull: true },
    llamada_id: { type: DataTypes.STRING(120), allowNull: true },
    origen: { type: DataTypes.STRING(30), allowNull: true, comment: 'Sistema que la mandó (operacion)' },
    estado_sugerencia: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'pendiente', comment: ESTADOS_SUGERENCIA.join(' | ') },
    resuelta_en: { type: DataTypes.DATE, allowNull: true },
    resuelta_por: { type: DataTypes.STRING(120), allowNull: true }
}, {
    tableName: 'calidad_sugerencias',
    ...tiempos,
    indexes: [{ fields: ['hoja_id'] }, { fields: ['estado_sugerencia'] }]
});

export const CalidadDispositivo = sequelize.define('CalidadDispositivo', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(80), allowNull: false },
    token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true, comment: 'SHA-256 del token (el token solo se ve una vez)' },
    ultimo_uso: { type: DataTypes.DATE, allowNull: true },
    revocado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    revocado_en: { type: DataTypes.DATE, allowNull: true },
    creado_por: { type: DataTypes.STRING(120), allowNull: true, comment: 'Quién generó el código con el que se vinculó' }
}, { tableName: 'calidad_dispositivos', ...tiempos });

export const CalidadCodigo = sequelize.define('CalidadCodigo', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    codigo_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true, comment: 'SHA-256 del código de 8 caracteres' },
    vence: { type: DataTypes.DATE, allowNull: false },
    usado_en: { type: DataTypes.DATE, allowNull: true },
    dispositivo_id: { type: DataTypes.INTEGER, allowNull: true },
    creado_por: { type: DataTypes.STRING(120), allowNull: true }
}, { tableName: 'calidad_codigos', ...tiempos });

export const MODELOS_CALIDAD = [CalidadHoja, CalidadPunto, CalidadEvento, CalidadSugerencia, CalidadDispositivo, CalidadCodigo];

export default { CalidadHoja, CalidadPunto, CalidadEvento, CalidadSugerencia, CalidadDispositivo, CalidadCodigo, MODELOS_CALIDAD };
