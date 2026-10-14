import { DataTypes, Op } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * C4 · PLA-16 — Una sola historia de la orden de compra.
 *
 * Renglones que SOLO se agregan (nadie los edita ni los borra):
 *   - origen «finanzas», tipo «estado»: lo que Julia sabe de la orden y Planta no (FIN-10, bandera SEGUIMIENTO_A_PLANTA en
 *     Finanzas): autorizada_sin_pago → pagada → pedida → llego, o vencida; con la fecha estimada de llegada que Julia
 *     maneja. Llegan por POST /api/sistemas/v1/ordenes/:folio/seguimiento (alcance «ordenes.seguimiento»).
 *   - origen «planta», tipo «llegada» (paso 3, bandera LLEGADA_CON_DATOS): la recepción en Planta, con el folio de la
 *     factura y la foto, los mismos datos que viajan en el aviso «Llegó material».
 * Planta lo muestra en el detalle de la orden (franja «Pago y pedido (Julia)», Diseño 3G) y, con VENCIDAS_USA_JULIA,
 * el aviso de órdenes vencidas usa la fecha estimada de Julia si es más nueva que la de la orden (cronJobs.js).
 * Tabla con su propio sync() al arrancar (crea si no existe; nunca alter).
 */
export const ESTADOS_SEGUIMIENTO = ['autorizada_sin_pago', 'pagada', 'pedida', 'llego', 'vencida'];

/** Texto y tono (para g3-estado) de cada estado, iguales en la pantalla y en las pruebas. */
export const TEXTO_ESTADO = {
    autorizada_sin_pago: { texto: 'Autorizada, sin pago', tono: 'aviso' },
    pagada: { texto: 'Pagada', tono: 'info' },
    pedida: { texto: 'Pedida al proveedor', tono: 'info' },
    llego: { texto: 'Llegó', tono: 'ok' },
    vencida: { texto: 'Vencida: no llegó en su plazo', tono: 'mal' }
};

const SI = ['1', 'true', 'si', 'sí', 'on'];
/** C4 paso 2: el aviso de vencidas usa la fecha de Julia cuando es más nueva (apagada = como hoy). */
export const vencidasUsaJulia = () => SI.includes(String(process.env.VENCIDAS_USA_JULIA ?? '').trim().toLowerCase());
/** C4 paso 3: «Llegó material» viaja con tipo 'llegada', la orden, el folio de la factura y la foto (apagada = como hoy). */
export const llegadaConDatos = () => SI.includes(String(process.env.LLEGADA_CON_DATOS ?? '').trim().toLowerCase());

const OrdenSeguimiento = sequelize.define('OrdenSeguimiento', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    orden_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    folio: {
        type: DataTypes.STRING(30),
        allowNull: false,
        comment: 'Folio de la orden (OC-…) tal como estaba al anotar'
    },
    origen: {
        type: DataTypes.STRING(20),
        allowNull: false,
        comment: 'finanzas (Julia) | planta (la recepción)'
    },
    tipo: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'estado',
        comment: 'estado (de Julia) | llegada (recepción en Planta, paso 3)'
    },
    estado: {
        type: DataTypes.STRING(30),
        allowNull: false,
        comment: 'autorizada_sin_pago | pagada | pedida | llego | vencida'
    },
    fecha: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Cuándo pasó (lo dice quien lo anota)'
    },
    fecha_estimada: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Llegada estimada que maneja Julia (AAAA-MM-DD)'
    },
    nota: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    datos: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Paso 3: { folioFactura, fotos: [url], movimiento }'
    },
    huella: {
        type: DataTypes.STRING(64),
        allowNull: false,
        comment: 'SHA-256 del renglón: la misma entrega no se anota dos veces'
    }
}, {
    tableName: 'orden_seguimiento',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        { unique: true, fields: ['huella'] },
        { fields: ['orden_id'] }
    ]
});

/**
 * La fecha estimada más reciente que Julia dio para cada orden: Map(orden_id → 'AAAA-MM-DD').
 * «Más reciente» = la del último renglón de Julia que trae fecha estimada.
 */
OrdenSeguimiento.fechasEstimadasJulia = async function (ordenIds) {
    const ids = [...new Set((ordenIds || []).filter(Boolean))];
    const mapa = new Map();
    if (!ids.length) return mapa;
    const filas = await this.findAll({
        where: { orden_id: { [Op.in]: ids }, origen: 'finanzas', fecha_estimada: { [Op.ne]: null } },
        attributes: ['orden_id', 'fecha_estimada', 'fecha', 'id'],
        order: [['fecha', 'DESC'], ['id', 'DESC']]
    });
    for (const f of filas) if (!mapa.has(f.orden_id)) mapa.set(f.orden_id, f.fecha_estimada);
    return mapa;
};

/**
 * C4 paso 2: la fecha con la que se decide si una orden ya venció. La de Julia manda si es más nueva (posterior) que
 * la de la orden, o si la orden no tiene. Devuelve Date (medianoche del servidor, como `hoy` en cronJobs.js) o null.
 */
export const fechaLlegadaEfectiva = (fechaOrden, fechaJulia) => {
    const deOrden = fechaOrden ? new Date(fechaOrden) : null;
    let deJulia = null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fechaJulia || ''));
    if (m) deJulia = new Date(+m[1], +m[2] - 1, +m[3]);
    if (deJulia && (!deOrden || deJulia.getTime() > deOrden.getTime())) return { fecha: deJulia, deJulia: true };
    return deOrden ? { fecha: deOrden, deJulia: false } : null;
};

export default OrdenSeguimiento;
