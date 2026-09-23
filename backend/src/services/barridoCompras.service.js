/**
 * Barrido de compras.
 *
 * Las solicitudes de compra nacían sueltas (una salida que deja un SKU en
 * negativo, una manual, el botón de stock bajo) y se quedaban en "Solicitudes
 * pendientes" sin que nadie las viera. Ahora, cada vez que nace una, se agenda
 * un barrido que:
 *   1. revisa TODOS los SKUs con mínimo marcado y proyecta su stock a
 *      DIAS_PROYECCION días con el consumo promedio del histórico;
 *   2. crea o actualiza (nunca duplica) la solicitud de lo que va a quedar
 *      bajo el mínimo, saltándose lo que ya está en una orden activa;
 *   3. manda UN aviso al grupo de Compras con lo nuevo y la liga a
 *      Solicitudes, donde se editan cantidades y se crea la orden.
 *
 * Los SKUs con mínimo 0 no se reponen: solo entran si una salida ya les
 * generó su solicitud por déficit.
 */

import { Op, fn, col } from 'sequelize';
import {
    Articulo, SolicitudCompra, OrdenCompra, DetalleOrdenCompra,
    DetalleMovimiento, Movimiento, Proveedor, Usuario
} from '../models/index.js';
import { enviarWhatsApp } from './whatsapp.service.js';

export const DIAS_HISTORICO = 60;   // ventana para el consumo promedio
export const DIAS_PROYECCION = 2;   // salidas que se anticipan
const TIPOS_SALIDA = ['pedido', 'retiro', 'ajuste_salida'];
const ESTADOS_ORDEN_ACTIVA = ['pendiente_aprobacion', 'borrador', 'enviada', 'parcial'];

// Varias solicitudes nacen juntas (una salida con 5 faltantes): se espera un
// poco para barrer una sola vez y mandar un solo aviso.
const ESPERA_BARRIDO_MS = 3 * 60 * 1000;
// Entre avisos al grupo; lo que salga en medio va en el siguiente.
const MIN_ENTRE_AVISOS_MS = 30 * 60 * 1000;
const MAX_LINEAS_AVISO = 25;

const MARCA_BARRIDO = '[Barrido]';

// FRONTEND_URL también alimenta CORS y en local apunta a localhost: solo se usa
// para la liga si es una dirección pública.
const urlSolicitudes = () => {
    const env = process.env.FRONTEND_URL || '';
    const base = (/^https:\/\//.test(env) && !/localhost|127\.0\.0\.1/.test(env) ? env : 'https://inventario-3-g.vercel.app').replace(/\/+$/, '');
    return `${base}/ordenes-compra?vista=solicitudes`;
};

const fmt = (n) => {
    const v = parseFloat(n) || 0;
    return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '');
};

/**
 * Consumo promedio por día de cada artículo (salidas de los últimos
 * DIAS_HISTORICO días). Map articulo_id → unidades/día.
 */
export const consumoDiarioPorArticulo = async (articuloIds = null) => {
    const desde = new Date();
    desde.setDate(desde.getDate() - DIAS_HISTORICO);

    const where = {};
    if (Array.isArray(articuloIds)) {
        if (articuloIds.length === 0) return new Map();
        where.articulo_id = { [Op.in]: articuloIds };
    }

    const filas = await DetalleMovimiento.findAll({
        where,
        attributes: ['articulo_id', [fn('SUM', col('DetalleMovimiento.cantidad')), 'total']],
        include: [{
            model: Movimiento,
            as: 'movimiento',
            attributes: [],
            where: {
                tipo: { [Op.in]: TIPOS_SALIDA },
                fecha_hora: { [Op.gte]: desde },
                estado: { [Op.notIn]: ['cancelado', 'rechazado'] }
            },
            required: true
        }],
        group: ['articulo_id'],
        raw: true
    });

    const mapa = new Map();
    for (const f of filas) {
        const total = parseFloat(f.total) || 0;
        if (total > 0) mapa.set(parseInt(f.articulo_id, 10), total / DIAS_HISTORICO);
    }
    return mapa;
};

/** Stock que se espera tener dentro de DIAS_PROYECCION días. */
export const stockProyectado = (stockActual, consumoDiario) =>
    (parseFloat(stockActual) || 0) - (consumoDiario || 0) * DIAS_PROYECCION;

/** Artículos que ya van en una orden de compra sin recibir. */
const articulosEnOrdenActiva = async () => {
    const detalles = await DetalleOrdenCompra.findAll({
        attributes: ['articulo_id'],
        include: [{
            model: OrdenCompra,
            as: 'ordenCompra',
            attributes: [],
            where: { estado: { [Op.in]: ESTADOS_ORDEN_ACTIVA } },
            required: true
        }],
        raw: true
    });
    return new Set(detalles.map(d => d.articulo_id));
};

/** Proveedor preferido del artículo (relación muchos-a-muchos), si no el directo. */
const proveedorDe = (articulo) => {
    const preferido = articulo.proveedores?.find(p => p.ArticuloProveedor?.es_preferido === true);
    return preferido?.id || articulo.proveedor_id || articulo.proveedores?.[0]?.id || null;
};

// `transaction` para que vea las solicitudes que se van creando dentro de ella
export const siguienteTicket = async (transaction = undefined) => {
    const now = new Date();
    const ddmmyy = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear()).slice(-2)}`;
    const hhmm = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    let n = await SolicitudCompra.count({
        where: { created_at: { [Op.gte]: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } },
        transaction
    });
    // El folio es único: si otro proceso tomó el número, se prueba el siguiente
    for (let intento = 0; intento < 20; intento++) {
        n++;
        const ticket = `SC-${ddmmyy}-${hhmm}-${String(n).padStart(2, '0')}`;
        const existe = await SolicitudCompra.count({ where: { ticket_id: ticket }, transaction });
        if (!existe) return ticket;
    }
    return `SC-${ddmmyy}-${hhmm}-${Date.now().toString().slice(-4)}`;
};

/**
 * Ejecuta el barrido. Devuelve { nuevas, actualizadas } con el detalle de lo
 * que cambió (para el aviso).
 */
export const ejecutarBarridoCompras = async ({ usuarioId = null } = {}) => {
    let solicitanteId = usuarioId;
    if (!solicitanteId) {
        const admin = await Usuario.findOne({ where: { rol: 'administrador', activo: true }, order: [['id', 'ASC']] });
        solicitanteId = admin?.id;
    }
    if (!solicitanteId) {
        console.log('⚠️ [barridoCompras] Sin usuario para firmar las solicitudes, se omite');
        return { nuevas: [], actualizadas: [] };
    }

    const articulos = await Articulo.findAll({
        where: {
            activo: true,
            es_herramienta: false,
            pendiente_revision: { [Op.not]: true },
            stock_minimo: { [Op.gt]: 0 }
        },
        attributes: ['id', 'nombre', 'unidad', 'stock_actual', 'stock_minimo', 'stock_maximo', 'proveedor_id'],
        include: [
            { model: Proveedor, as: 'proveedores', attributes: ['id', 'nombre'], through: { attributes: ['es_preferido'] }, required: false },
            { model: Proveedor, as: 'proveedor', attributes: ['id', 'nombre'], required: false }
        ]
    });

    const consumo = await consumoDiarioPorArticulo(articulos.map(a => a.id));
    const enOrden = await articulosEnOrdenActiva();
    const pendientes = await SolicitudCompra.findAll({ where: { estado: 'pendiente' } });
    const pendientePorArticulo = new Map(pendientes.map(s => [s.articulo_id, s]));

    const nuevas = [];
    const actualizadas = [];

    for (const art of articulos) {
        if (enOrden.has(art.id)) continue;

        const stockActual = parseFloat(art.stock_actual) || 0;
        const minimo = parseFloat(art.stock_minimo) || 0;
        const diario = consumo.get(art.id) || 0;
        const proyectado = stockProyectado(stockActual, diario);
        if (proyectado >= minimo) continue;

        // Reponer hasta el máximo (o el doble del mínimo si no tiene máximo),
        // contando lo que se va a consumir en los próximos días.
        const maximo = parseFloat(art.stock_maximo) || 0;
        const objetivo = maximo > minimo ? maximo : minimo * 2;
        const cantidad = Math.ceil(Math.max(objetivo - proyectado, minimo - proyectado));
        if (cantidad <= 0) continue;

        const prioridad = stockActual <= 0 ? 'urgente'
            : stockActual < minimo * 0.5 ? 'alta'
            : stockActual < minimo ? 'media'
            : 'baja'; // aún arriba del mínimo, solo lo alcanza la proyección
        const motivo = `${MARCA_BARRIDO} Stock ${fmt(stockActual)} ${art.unidad}, mínimo ${fmt(minimo)}` +
            (diario > 0
                ? `, consumo ~${fmt(diario)}/día → en ${DIAS_PROYECCION} días ~${fmt(proyectado)}.`
                : '.');
        const proveedorNombre = (art.proveedores?.find(p => p.id === proveedorDe(art)) || art.proveedor)?.nombre || null;
        const item = { articulo: art.nombre, unidad: art.unidad, cantidad, proveedor: proveedorNombre };

        const existente = pendientePorArticulo.get(art.id);
        if (existente) {
            // Se respeta lo que alguien ya pidió de más; solo se sube si hace falta
            const actual = parseFloat(existente.cantidad_solicitada) || 0;
            if (cantidad > actual) {
                await existente.update({
                    cantidad_solicitada: cantidad,
                    ...(existente.proveedor_id ? {} : { proveedor_id: proveedorDe(art) }),
                    motivo: `${existente.motivo || ''}\n\n${motivo} Cantidad ajustada de ${fmt(actual)} a ${cantidad}.`.trim()
                });
                actualizadas.push({ ...item, anterior: actual });
            }
            continue;
        }

        await SolicitudCompra.create({
            ticket_id: await siguienteTicket(),
            articulo_id: art.id,
            cantidad_solicitada: cantidad,
            motivo,
            usuario_solicitante_id: solicitanteId,
            proveedor_id: proveedorDe(art),
            prioridad,
            estado: 'pendiente'
        });
        nuevas.push(item);
    }

    console.log(`🧮 [barridoCompras] ${articulos.length} SKUs revisados: ${nuevas.length} nuevas, ${actualizadas.length} ajustadas`);
    return { nuevas, actualizadas };
};

// ---------------------------------------------------------------------------
// Aviso al grupo de Compras
// ---------------------------------------------------------------------------

let ultimoAviso = 0;
let timerAviso = null;
// Tras un reinicio no se sabe cuándo fue el último aviso: se toma este margen
const MARGEN_SIN_HISTORIAL_MS = 12 * 60 * 60 * 1000;

const fechaCambio = (s) => new Date(s.updatedAt || s.updated_at || s.createdAt || s.created_at || 0);

/**
 * Lista las solicitudes pendientes que nacieron o cambiaron desde el último
 * aviso —vengan del barrido, de una salida o capturadas a mano— agrupadas
 * por proveedor. null si no hay nada nuevo.
 */
const armarAviso = async (desde) => {
    const pendientes = await SolicitudCompra.findAll({
        where: { estado: 'pendiente' },
        include: [
            { model: Proveedor, as: 'proveedor', attributes: ['nombre'], required: false },
            { model: Articulo, as: 'articulo', attributes: ['nombre', 'unidad'], required: false }
        ],
        order: [['prioridad', 'DESC'], ['id', 'ASC']]
    });
    const recientes = pendientes.filter(s => fechaCambio(s) >= desde);
    if (recientes.length === 0) return null;

    const proveedores = new Set(pendientes.map(s => s.proveedor?.nombre || 'Sin proveedor'));
    const agrupados = new Map();
    for (const s of recientes) {
        const k = s.proveedor?.nombre || 'Sin proveedor';
        if (!agrupados.has(k)) agrupados.set(k, []);
        const urgente = s.prioridad === 'urgente' ? ' ⚠️' : '';
        agrupados.get(k).push(`${s.articulo?.nombre || 'Artículo'}: ${fmt(s.cantidad_solicitada)} ${s.articulo?.unidad || ''}`.trimEnd() + urgente);
    }

    const lineas = [
        '🧾 *Solicitudes de compra por revisar*',
        `Stock mínimo + salidas previstas de los próximos ${DIAS_PROYECCION} días.`,
        ''
    ];
    let usadas = 0;
    for (const [prov, items] of agrupados) {
        if (usadas >= MAX_LINEAS_AVISO) break;
        lineas.push(`*${prov}*`);
        for (const t of items) {
            if (usadas >= MAX_LINEAS_AVISO) break;
            lineas.push(`• ${t}`);
            usadas++;
        }
    }
    if (recientes.length > usadas) lineas.push(`…y ${recientes.length - usadas} más`);

    lineas.push('');
    lineas.push(`En total hay ${pendientes.length} pendiente(s) de ${proveedores.size} proveedor(es).`);
    lineas.push('Revisa, ajusta cantidades y crea la orden aquí:');
    lineas.push(urlSolicitudes());
    return lineas.join('\n');
};

const enviarAvisoPendiente = async () => {
    timerAviso = null;
    const desde = new Date(ultimoAviso || (Date.now() - MARGEN_SIN_HISTORIAL_MS));
    const marca = Date.now();
    try {
        const mensaje = await armarAviso(desde);
        if (!mensaje) return;
        if (await enviarWhatsApp(mensaje, 'compras')) ultimoAviso = marca;
    } catch (e) {
        console.error('⚠️ [barridoCompras] No se pudo armar el aviso:', e.message);
    }
};

const agendarAviso = () => {
    if (timerAviso) return; // ya hay uno en camino; lo nuevo entra en él
    const espera = Math.max(0, ultimoAviso + MIN_ENTRE_AVISOS_MS - Date.now());
    timerAviso = setTimeout(enviarAvisoPendiente, espera);
};

// ---------------------------------------------------------------------------
// Disparador
// ---------------------------------------------------------------------------

let timerBarrido = null;
let usuarioBarrido = null;

/**
 * Llamar cada vez que se crea (o se va a crear) una solicitud de compra.
 * Agrupa las llamadas cercanas en un solo barrido y un solo aviso.
 * Nunca lanza.
 */
export const programarBarridoCompras = ({ usuarioId = null } = {}) => {
    if (usuarioId) usuarioBarrido = usuarioId;
    if (timerBarrido) return;
    timerBarrido = setTimeout(async () => {
        timerBarrido = null;
        const usuario = usuarioBarrido;
        usuarioBarrido = null;
        try {
            await ejecutarBarridoCompras({ usuarioId: usuario });
        } catch (e) {
            console.error('❌ [barridoCompras] Error:', e.message);
        }
        // Aunque el barrido no agregue nada, la solicitud que lo disparó se avisa
        agendarAviso();
    }, ESPERA_BARRIDO_MS);
};

/** Barrido programado (cron): solo avisa si encontró algo. */
export const barridoComprasProgramado = async () => {
    try {
        const { nuevas, actualizadas } = await ejecutarBarridoCompras();
        if (nuevas.length || actualizadas.length) agendarAviso();
    } catch (e) {
        console.error('❌ [barridoCompras] Error en el barrido programado:', e.message);
    }
};
