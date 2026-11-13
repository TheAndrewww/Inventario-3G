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
 *   3. manda UN aviso AL DÍA al grupo de Compras con lo nuevo y la liga a
 *      Solicitudes, donde se editan cantidades y se crea la orden.
 *
 * Los SKUs con mínimo 0 no se reponen: solo entran si una salida ya les
 * generó su solicitud por déficit.
 */

import { Op, fn, col } from 'sequelize';
import {
    Articulo, SolicitudCompra, OrdenCompra, DetalleOrdenCompra,
    DetalleMovimiento, Movimiento, Proveedor, Usuario, AvisoWhatsApp
} from '../models/index.js';
import { enviarWhatsApp } from './whatsapp.service.js';
import { articuloCorto, unidadCorta, numeroCorto, nombrePropio, plural } from '../utils/textoCorto.js';

export const DIAS_HISTORICO = 60;   // ventana para el consumo promedio
export const DIAS_PROYECCION = 2;   // salidas que se anticipan
const TIPOS_SALIDA = ['pedido', 'retiro', 'ajuste_salida'];
const ESTADOS_ORDEN_ACTIVA = ['pendiente_aprobacion', 'borrador', 'enviada', 'parcial'];

// Varias solicitudes nacen juntas (una salida con 5 faltantes): se espera un
// poco para barrer una sola vez y mandar un solo aviso.
const ESPERA_BARRIDO_MS = 3 * 60 * 1000;

const MARCA_BARRIDO = '[Barrido]';

// FRONTEND_URL también alimenta CORS y en local apunta a localhost: solo se usa
// para la liga si es una dirección pública.
export const urlSolicitudes = () => {
    const env = process.env.FRONTEND_URL || '';
    const base = (/^https:\/\//.test(env) && !/localhost|127\.0\.0\.1/.test(env) ? env : 'https://inventario-3-g.vercel.app').replace(/\/+$/, '');
    return `${base}/solicitudes-compra`;
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
                    // Deja de ser un rebote: el stock se movió de verdad, así que vuelve a
                    // avisarse. Solo se borra la marca del rebote, nunca una nota de alguien.
                    ...(esRebote(existente) ? { observaciones: null } : {}),
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

let timerAviso = null;
// Solo si NUNCA se ha mandado un aviso (base recién estrenada).
const MARGEN_SIN_HISTORIAL_MS = 12 * 60 * 60 * 1000;
// En «lo más urgente» se nombran a lo más estos proveedores y artículos; el resto se cuenta.
const MAX_PROVEEDORES_AVISO = 2;
const MAX_ARTICULOS_AVISO = 4;

// Marcas para reconocer estos avisos en la cola: la de hoy y la de antes del 13-nov-2026.
const PREFIJO_AVISO = '🧾 Hay ';
const ENCABEZADO_ANTERIOR = '🧾 *Solicitudes de compra por revisar*';
const esAvisoDeSolicitudes = {
    [Op.or]: [
        { mensaje: { [Op.like]: `${PREFIJO_AVISO}%solicitud%` } },
        { mensaje: { [Op.like]: `${ENCABEZADO_ANTERIOR}%` } }
    ]
};

const ORDEN_PRIORIDAD = { urgente: 0, alta: 1, media: 2, baja: 3 };
const SIN_PROVEEDOR = 'Sin proveedor';

/**
 * Texto del aviso, en corto (13-nov-2026, pedido de Isa: «parece spam, nadie lo lee»).
 * Dos renglones: cuántas hay, lo más urgente de lo nuevo (2 proveedores / 4 artículos) y la liga.
 *
 *   🧾 Hay 19 solicitudes de compra (8 proveedores). Lo más urgente: Formalasser — cerramiento
 *   recto grande 189, soporte medio muro 43; Re.ba.ce / Baleros — balero grande 6.
 *   Ver: https://inventario-3-g.vercel.app/solicitudes-compra
 *
 * `recientes`: [{ proveedor, articulo, cantidad, unidad, prioridad }]. Pura.
 */
export const construirAvisoSolicitudes = ({ total, proveedores, recientes = [], url = urlSolicitudes() }) => {
    // Lo que no tiene proveedor va al final (no es lo que se puede pedir hoy); luego por prioridad.
    const ordenados = [...recientes].sort((x, y) =>
        (x.proveedor ? 0 : 1) - (y.proveedor ? 0 : 1)
        || (ORDEN_PRIORIDAD[x.prioridad] ?? 9) - (ORDEN_PRIORIDAD[y.prioridad] ?? 9));

    const grupos = new Map();
    let nombrados = 0;
    for (const r of ordenados) {
        if (nombrados >= MAX_ARTICULOS_AVISO) break;
        const prov = r.proveedor || SIN_PROVEEDOR;
        if (!grupos.has(prov)) {
            if (grupos.size >= MAX_PROVEEDORES_AVISO) continue;
            grupos.set(prov, []);
        }
        const unidad = unidadCorta(r.unidad);
        grupos.get(prov).push(`${articuloCorto(r.articulo)} ${numeroCorto(r.cantidad)}${unidad ? ` ${unidad}` : ''}`);
        nombrados++;
    }

    let urgente = [...grupos].map(([prov, items]) =>
        `${prov === SIN_PROVEEDOR ? 'sin proveedor' : nombrePropio(prov)} — ${items.join(', ')}`).join('; ');
    const faltan = recientes.length - nombrados;
    if (urgente && faltan > 0) urgente += `; y ${faltan} más`;

    const cabeza = `${PREFIJO_AVISO}${plural(total, 'solicitud', 'solicitudes')} de compra` +
        (proveedores > 0 ? ` (${plural(proveedores, 'proveedor', 'proveedores')}).` : '.');
    return [
        urgente ? `${cabeza} Lo más urgente: ${urgente}.` : cabeza,
        `Ver: ${url}`
    ].join('\n');
};

/** Fecha (AAAA-MM-DD) en la hora de México: «hoy» es el día de Planta, no el del servidor. */
export const diaMexico = (fecha) => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date(fecha));

/**
 * Regla del jefe: UN aviso al día en Compras. Con los avisos de la cola decide:
 *  - 'esperar':    el de hoy ya salió → lo nuevo espera al aviso de mañana (si quedó otro en
 *                  cola sin salir, se descarta: serían dos en el día, lo que pasó el 12-nov);
 *  - 'actualizar': hay uno que aún no sale (espera el horario o a Julia) → se le cambia el
 *                  texto, no se encola otro;
 *  - 'nuevo':      hoy no ha salido ninguno.
 * `ultimo` = el más reciente de la cola; `ultimoEnviado` = el más reciente que sí salió. Pura.
 */
export const decidirAvisoDelDia = (ultimo, ultimoEnviado, ahora = new Date()) => {
    if (ultimoEnviado && diaMexico(fechaDeAviso(ultimoEnviado)) === diaMexico(ahora)) return 'esperar';
    if (ultimo?.estado === 'pendiente') return 'actualizar';
    return 'nuevo';
};

/**
 * Los últimos avisos de solicitudes en la cola. La fecha vive en la base (no en memoria):
 * Railway reinicia el backend en cada despliegue y, con la memoria en blanco, el siguiente
 * aviso salía con TODA la cola.
 */
const avisosEnLaCola = async () => AvisoWhatsApp.findAll({
    where: { destino: 'compras', estado: { [Op.in]: ['pendiente', 'enviado'] }, ...esAvisoDeSolicitudes },
    order: [['id', 'DESC']],
    limit: 5
});

const fechaDeAviso = (a) => new Date(a.enviado_at || a.created_at || a.createdAt || 0);

const fechaCambio = (s) => new Date(s.updatedAt || s.updated_at || s.createdAt || s.created_at || 0);

// Una solicitud vuelve a "pendiente" cuando su orden se rechaza, se cancela o se borra.
// Eso NO es material nuevo: es el mismo que se acaba de ver en la orden. Se anunciaba otra
// vez minutos después del rechazo —la misma lista de FERREMAG que el jefe acababa de
// rechazar— y por eso el aviso se volvió ruido. El rechazo ya se avisa por su cuenta.
const REVERTIDA = /^\s*\[Revertida automáticamente\]/;
const esRebote = (s) => REVERTIDA.test(String(s.observaciones || ''));

/**
 * Aviso con las solicitudes pendientes que nacieron o cambiaron desde `desde` —vengan del
 * barrido, de una salida o capturadas a mano—. null si no hay nada nuevo.
 */
const armarAviso = async (desde) => {
    const pendientes = await SolicitudCompra.findAll({
        where: { estado: 'pendiente' },
        include: [
            { model: Proveedor, as: 'proveedor', attributes: ['nombre'], required: false },
            { model: Articulo, as: 'articulo', attributes: ['nombre', 'unidad'], required: false }
        ],
        order: [['id', 'ASC']]
    });
    const recientes = pendientes.filter(s => fechaCambio(s) >= desde && !esRebote(s));
    if (recientes.length === 0) return null;

    return construirAvisoSolicitudes({
        total: pendientes.length,
        proveedores: new Set(pendientes.map(s => s.proveedor?.nombre).filter(Boolean)).size,
        recientes: recientes.map(s => ({
            proveedor: s.proveedor?.nombre || null,
            articulo: s.articulo?.nombre || 'Artículo',
            cantidad: s.cantidad_solicitada,
            unidad: s.articulo?.unidad,
            prioridad: s.prioridad
        }))
    });
};

const enviarAvisoPendiente = async () => {
    timerAviso = null;
    try {
        const avisos = await avisosEnLaCola();
        const ultimo = avisos[0] || null;
        const ultimoEnviado = avisos.find(a => a.estado === 'enviado') || null;
        const decision = decidirAvisoDelDia(ultimo, ultimoEnviado);
        if (decision === 'esperar') {
            // Ya salió el de hoy: lo nuevo se junta para el de mañana (lo recoge el barrido diario).
            for (const a of avisos.filter(x => x.estado === 'pendiente')) {
                await a.update({ estado: 'descartado', error: 'Ya salió el aviso de solicitudes de hoy (uno al día)' });
            }
            console.log('🧾 [barridoCompras] Ya salió el aviso de hoy; lo nuevo espera a mañana');
            return;
        }
        // Lo que cambió desde el último aviso que SÍ salió (también al actualizar uno que aún
        // no sale: así no pierde lo que ya llevaba).
        const desde = ultimoEnviado ? fechaDeAviso(ultimoEnviado) : new Date(Date.now() - MARGEN_SIN_HISTORIAL_MS);
        const mensaje = await armarAviso(desde);
        if (!mensaje) return;
        if (decision === 'actualizar') {
            await ultimo.update({ mensaje });
            console.log(`🧾 [barridoCompras] Aviso #${ultimo.id} aún en cola: se actualizó en vez de encolar otro`);
            return;
        }
        await enviarWhatsApp(mensaje, 'compras');
    } catch (e) {
        console.error('⚠️ [barridoCompras] No se pudo armar el aviso:', e.message);
    }
};

const agendarAviso = () => {
    if (timerAviso) return; // ya hay uno en camino; lo nuevo entra en él
    timerAviso = setTimeout(enviarAvisoPendiente, 0);
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

/**
 * Barrido programado (cron). Siempre revisa el aviso: si ayer algo se quedó esperando porque
 * ya había salido el aviso del día, hoy es cuando sale. Sin nada nuevo no se manda nada.
 */
export const barridoComprasProgramado = async () => {
    try {
        await ejecutarBarridoCompras();
        agendarAviso();
    } catch (e) {
        console.error('❌ [barridoCompras] Error en el barrido programado:', e.message);
    }
};
