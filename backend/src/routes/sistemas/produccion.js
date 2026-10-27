/**
 * Carla 3G (v2 §«Planta: puerta de solo lectura» y §«Llave nueva: pareja #20») — origen «operacion», alcance
 * «produccion.leer». Operación pregunta aquí qué obras cerraron producción (llamada al supervisor, flujo C), si una obra
 * sigue cerrada justo antes de llamar, y qué hay en el taller para la llamada diaria a Calidad de las 16:00 (flujo A).
 * Solo lee: no cambia el esquema, no manda avisos y no necesita bandera (sin la llave, la puerta responde 503).
 *
 *   GET /api/sistemas/v1/produccion/cerradas?desde=<ISO>&despuesDe=<proyectoId>
 *     Obras con la producción cerrada (etapa instalacion o completado), activas y sin tipo CANCELADO…, con
 *     instalacion_completado_en después de `desde`, en orden (cerradaEn, proyectoId). 50 por página.
 *     · `desde`: ISO con zona (2026-10-27T16:00:00-06:00, …Z) o solo el día (AAAA-MM-DD = medianoche de México).
 *       Sin `desde`: los últimos 7 días. Más de 31 días atrás se recorta a 31 (la respuesta dice el que se usó).
 *       Inválido o en el futuro: 400.
 *     · Cursor: con `hayMas: true`, la página siguiente se pide con `siguiente.desde` y `siguiente.despuesDe` tal cual.
 *       `despuesDe` sin `desde`: 400. La hora se compara al milisegundo (date_trunc), con el id para desempatar.
 *     → { sistema, generado, desde, obras: [OBRA], hayMas, siguiente: { desde, despuesDe } | null }
 *
 *   GET /api/sistemas/v1/produccion/estado?obras=3G-26-0412,3G-26-0415
 *     Las obras por ID 3G (50 como máximo; sin `obras`, con un ID mal escrito o con más de 50: 400). Sirve para revisar
 *     justo antes de llamar que la obra siga cerrada (una obra se puede «descerrar» con regresarEtapa).
 *     → { sistema, generado, obras: [OBRA + { cerrada }], noEncontradas: [ID 3G] }
 *
 *   GET /api/sistemas/v1/produccion/en-curso?despuesDe=<proyectoId>
 *     Lo que hay en el taller para la llamada a Calidad: obras activas, sin cancelar, en pendiente/diseño/compras/producción
 *     que están en etapa producción o tienen planos de Manufactura o Herrería sin terminar (la misma regla de las
 *     pantallas de Manufactura y Herrería, obtenerPorArea). Orden por proyectoId, 50 por página (`despuesDe` = cursor).
 *     → { sistema, generado, fecha (hoy en México), obras: [OBRA + EN_CURSO], hayMas, siguiente: { despuesDe } | null,
 *         material (solo en la primera página): { hoy, ordenes: [ORDEN_DEL_DIA] | null }, avisos: [texto] }
 *     Si el material no se puede leer, las obras salen igual: `material` de la obra (o `material.ordenes`) va en null y
 *     `avisos` dice qué faltó.
 *
 * OBRA (las tres rutas):
 *   { proyectoId (informativo: cambia si el renglón se mueve de pestaña), obraId (ID 3G o null), proyecto, cliente,
 *     tipo, extensivo, premium, sinProduccion (MTO o GTIA no extensivos), cancelada, etapa, entregada (etapa completado),
 *     cerradaEn (ISO de México o null), cerradaConSesion (la cerró alguien con sesión, no la terminal ni el Índice),
 *     areas: { manufactura: { aplica, lista, listaEn }, herreria: { aplica, lista, listaEn, soldadura, pintura },
 *              pendientes: ['manufactura'|'herreria'|'herreria_armado'|'herreria_pintado'], sinPlanos, produccionCerrada },
 *     fechaInstalacion: { fecha: AAAA-MM-DD|null, fuente: 'calendario'|'indice'|null }, fechaIndice, pausado,
 *     pronostico: el sí o el no de Producción por WhatsApp (PLA-17, sin el autor) o null }
 *
 * EN_CURSO (se suma a OBRA en /en-curso):
 *   { prioridad (1 = más urgente), areas.diseno: { lista }, areas.compras: { lista, enProceso },
 *     observaciones: { diseno, compras, produccion } (texto o null, 400 caracteres como máximo),
 *     material: {
 *       tickets: [{ folio, estado: 'pendiente'|'aprobado', fecha: AAAA-MM-DD, surtido: 0-100 }]      (10 como máximo)
 *       ordenes: [{ folio, estado, proveedor, llegadaEstimada: AAAA-MM-DD|null, vencida,
 *                   articulos: [{ nombre, cantidad, unidad }] }]                                      (10 y 10)
 *       sinOrden: [{ nombre, cantidad, unidad }]   lo que se pidió a Compras y todavía no tiene orden (10) } }
 *   Los tickets son los abiertos del proyecto (pendiente o aprobado, empate por nombre como el aviso de las 16:00 de
 *   tickets-abiertos); las órdenes y lo «sin orden» salen de las solicitudes de compra de esos tickets.
 *
 * ORDEN_DEL_DIA (material de la primera página): órdenes enviadas o parciales, sin recibir, con llegada estimada hasta
 *   hoy (las vencidas también), 50 como máximo, las de hoy primero y luego las vencidas más recientes:
 *   { folio, estado, proveedor, llegadaEstimada, vencida, articulos: [{ nombre, cantidad, recibida, unidad }] (10),
 *     proyectos: [nombres de los proyectos de los tickets que la originaron] (10) }
 *
 * Reglas (v2):
 *   - Nunca lee Google Sheets (la cuota se agotó el 29-sep). La fecha de instalación sale de la foto que la revisión de
 *     cada 5 minutos guarda en `configuracion` (clave produccion_fechas_instalacion; calendario o Índice, ya resuelta) y,
 *     si la obra no está en la foto, de fecha_limite (Índice). `fuente: 'calendario'` cuando la foto difiere del Índice.
 *   - Nunca devuelve teléfonos, correos, direcciones, importes, costos ni llaves: los campos se eligen uno por uno y el
 *     texto libre (nombres, cliente, observaciones, artículos, proveedor y el motivo, la fecha y el texto del pronóstico)
 *     pasa por `sinDatos` (correos, calle y número, C.P., teléfonos y montos → «•••»).
 *   - Filtra por etapa con idx_produccion_etapa (y por tipo de movimiento con su índice) para no pasar de 2.8 s
 *     (la puerta responde 504). No crea índices ni toca server.js.
 *   - Las fechas para mostrar van en ISO de México (isoMexico, al segundo); los cursores van en ISO UTC con milésimas
 *     para no perder ni repetir obras entre páginas.
 */
import { Op } from 'sequelize';
import { sequelize } from '../../config/database.js';
import {
    ProduccionProyecto, Configuracion, Movimiento, DetalleMovimiento, SolicitudCompra, OrdenCompra, DetalleOrdenCompra,
    Articulo, Proveedor
} from '../../models/index.js';
import { isoMexico } from '../../utils/revisarConfig.js';
import { resumenProduccion, sumarDias } from '../../services/fechaInstalacion.service.js';
import { obraIdsDeProyectos, ES_ID3G } from '../../services/obraId.service.js';
import { mismosProyectos } from '../../services/pedidosCleanup.service.js';
import { pronosticoParaTablero } from './pronostico.js';

export const ALCANCE_PRODUCCION = 'produccion.leer';
export const MAX_LISTA = 50;
export const DIAS_POR_OMISION = 7;
export const DIAS_MAXIMO = 31;
const DIA_MS = 24 * 60 * 60 * 1000;
const FUTURO_MS = 5 * 60 * 1000; // relojes un poco adelantados
const MAX_TEXTO = 400;
const MAX_MATERIAL = 10;
const MAX_TICKETS_LEIDOS = 2000;
const MAX_SOLICITUDES_LEIDAS = 1000;
const CLAVE_FOTO = 'produccion_fechas_instalacion'; // la de fechaInstalacion.service.js (revisarAdelantos)
const ETAPAS_CERRADAS = ['instalacion', 'completado'];
const ETAPAS_EN_CURSO = ['pendiente', 'diseno', 'compras', 'produccion'];
const TICKETS_ABIERTOS = ['pendiente', 'aprobado']; // los del aviso de las 16:00 (tickets-abiertos)
const ORDENES_ABIERTAS = ['pendiente_aprobacion', 'borrador', 'enviada', 'parcial'];
const ORDENES_EN_CAMINO = ['enviada', 'parcial'];
const SIN_CANCELADOS = { [Op.or]: [{ tipo_proyecto: null }, { tipo_proyecto: { [Op.notILike]: 'CANCELADO%' } }] };

// Solo estas columnas salen de la base (nada de archivos, carpetas de Drive ni descripción libre).
const CAMPOS_OBRA = [
    'id', 'nombre', 'cliente', 'tipo_proyecto', 'es_extensivo', 'es_premium', 'etapa_actual', 'activo', 'fecha_limite',
    'instalacion_completado_en', 'instalacion_completado_por', 'tiene_manufactura', 'tiene_herreria',
    'manufactura_completado', 'manufactura_completado_en', 'herreria_completado', 'herreria_completado_en',
    'herreria_armado_completado', 'herreria_pintado_completado', 'pausado'
];
const CAMPOS_EN_CURSO = [
    ...CAMPOS_OBRA, 'prioridad', 'diseno_completado_en', 'compras_completado_en', 'compras_en_proceso',
    'observaciones_diseno', 'observaciones_compras', 'observaciones_produccion'
];

// ---------- Funciones puras ----------

// Lo que `sinDatos` tapa. Las palabras se delimitan con letras de Unicode (\b no ve la «ó» de «pagó»).
const RE_CORREO = /\S+@\S+/g;
// Calle o avenida con su número («Av. Siempre Viva 742», «Calle 5 de Mayo #120 int. 3») y, si sigue, la colonia.
const RE_DIRECCION = new RegExp(
    String.raw`(?<![\p{L}\d])(?:av|avda|avenida|calle|blvd|boulevard|bulevar|calz|calzada|carr|carretera|priv|privada|prol|prolongaci[oó]n|andador)\.?\s+`
    + String.raw`[^\n,;:()]{1,40}?\s?(?:#\s?|n[oú]m?\.\s?)?\d{1,5}(?!\d)\p{L}?(?![\p{L}\d])`
    + String.raw`(?:\s*(?:int|ext|interior|exterior)\.?\s*[\p{L}\d-]{1,5})?`
    + String.raw`(?:[\s,]+(?:col\.|colonia|fracc\.?|fraccionamiento)\s+[^\n,;:()]{1,30})?`,
    'giu'
);
const RE_CODIGO_POSTAL = /(?<![\p{L}\d])c\.?\s?p\.?\s?\d{5}(?!\d)/giu;
// Teléfonos: 10 dígitos o más, con espacios, guiones, puntos o paréntesis entre ellos («(462) 123 4567», «462.123.4567»).
// Es la regla de sinTelefonos de la bitácora (que solo ve espacios y guiones), ampliada.
const RE_TELEFONO = /\+?\(?\d[\d\s().-]{8,}\d/g;
const MONEDA = String.raw`(?:mxn|usd|dlls?|dls|d[oó]lares|pesos|m\.\s?n\.)`;
const RE_MONTO_CON_PESOS = /\$\s?\d[\d,.]*/g;
const RE_MONEDA_ANTES = new RegExp(String.raw`(?<![\p{L}\d])(?:mxn|usd|dlls?|dls)\.?\s?\$?\s?\d[\d,.]*`, 'giu');
const RE_MONEDA_DESPUES = new RegExp(String.raw`(?<![\p{L}\d])\d[\d,.]*\s?${MONEDA}(?![\p{L}])`, 'giu');
// Un número de 4 cifras o más (12,500 · 8500 · 3,000.00) que no es parte de una fecha ni de un folio (2026-11-03, OC-0501).
const CANTIDAD = String.raw`(?<![\p{L}\d/-])(?:\d{1,3}(?:[,.]\d{3})+(?:[.,]\d{1,2})?|\d{4,}(?:[.,]\d{1,2})?)(?![\d/-]|[.,]\d)`;
const DE_DINERO = String.raw`(?:anticipos?|saldos?|pagos?|pag[oó]|pagaron|pagar|abonos?|costos?|total(?:es)?|importes?|montos?|precios?|adeudos?|dep[oó]sitos?|transferencias?|liquidaci[oó]n|iva)`;
const RE_DINERO_Y_CANTIDAD = new RegExp(String.raw`((?<![\p{L}\d])${DE_DINERO}(?![\p{L}\d])[^\d\n]{0,20}?)${CANTIDAD}`, 'giu');
const RE_CANTIDAD_Y_DINERO = new RegExp(String.raw`${CANTIDAD}(\s(?:de\s|del\s|en\s|para\s)?${DE_DINERO}(?![\p{L}\d]))`, 'giu');

/**
 * Lo que nunca sale de la puerta, fuera del texto libre: correos, direcciones (calle y número, colonia, C.P.), teléfonos
 * (10 dígitos o más con cualquier separador) y montos ($, MXN/USD/dlls antes o después, y números de 4 cifras o más junto
 * a anticipo, saldo, pago, costo, total…). Junta los espacios y pone tope de largo. null si no queda nada.
 */
export const sinDatos = (texto, max = MAX_TEXTO) => {
    if (texto === undefined || texto === null) return null;
    let t = String(texto)
        .replace(RE_CORREO, '•••')
        .replace(RE_DIRECCION, '•••')
        .replace(RE_CODIGO_POSTAL, '•••')
        .replace(RE_TELEFONO, (m) => (m.replace(/\D/g, '').length >= 10 ? '•••' : m))
        .replace(RE_MONTO_CON_PESOS, '$•••')
        .replace(RE_MONEDA_ANTES, '•••')
        .replace(RE_MONEDA_DESPUES, '•••')
        .replace(RE_DINERO_Y_CANTIDAD, '$1•••')
        .replace(RE_CANTIDAD_Y_DINERO, '•••$1')
        .replace(/\s+/g, ' ')
        .trim();
    if (!t) return null;
    if (t.length > max) t = `${t.slice(0, max - 1)}…`;
    return t;
};

const iso = (v) => (v ? isoMexico(v instanceof Date ? v : new Date(v)) : null);
/** fecha_llegada_estimada se guarda a la medianoche UTC del día que se capturó: el día es el de UTC. */
const diaUTC = (v) => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
const DIA_MX = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' });
const diaMexico = (v) => (v ? DIA_MX.format(v instanceof Date ? v : new Date(v)) : null);
const numero = (v) => {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;
const RE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/;
const RE_ID = /^\d{1,10}$/;

const unValor = (v) => (Array.isArray(v) ? { repetido: true } : { valor: v === undefined || v === null ? '' : String(v).trim() });

/** El cursor `despuesDe` (id del proyecto). { valor: number|null } o { error }. */
export const leerDespuesDe = (query = {}) => {
    const { repetido, valor } = unValor(query.despuesDe);
    if (repetido) return { error: '«despuesDe» va una sola vez' };
    if (!valor) return { valor: null };
    if (!RE_ID.test(valor) || Number(valor) <= 0) return { error: '«despuesDe» debe ser el proyectoId de la última obra de la página' };
    return { valor: Number(valor) };
};

/**
 * `desde` y `despuesDe` de /cerradas. Devuelve { desde: Date, despuesDe: number|null, recortado } o { error }.
 * El «+» de la zona llega como espacio si el que llama no lo codifica: se acepta igual.
 */
export const leerDesde = (query = {}, ahora = new Date()) => {
    const d = unValor(query.desde);
    if (d.repetido) return { error: '«desde» va una sola vez' };
    const cursor = leerDespuesDe(query);
    if (cursor.error) return { error: cursor.error };
    let desde;
    if (!d.valor) {
        if (cursor.valor !== null) return { error: '«despuesDe» va junto con «desde» (los dos salen de «siguiente»)' };
        desde = new Date(ahora.getTime() - DIAS_POR_OMISION * DIA_MS);
    } else {
        const texto = d.valor.replace(/ (\d{2}:\d{2})$/, '+$1');
        if (texto.length > 40 || !(RE_DIA.test(texto) || RE_ISO.test(texto))) {
            return { error: '«desde» debe ser una fecha ISO con zona (2026-10-27T16:00:00-06:00) o un día (2026-10-27)' };
        }
        desde = new Date(RE_DIA.test(texto) ? `${texto}T00:00:00-06:00` : texto);
        const dia = texto.slice(0, 10);
        // new Date acepta el 31 de febrero y lo corre al 3 de marzo: se revisa que el día exista.
        if (Number.isNaN(desde.getTime()) || new Date(`${dia}T12:00:00Z`).toISOString().slice(0, 10) !== dia) {
            return { error: '«desde» no es una fecha válida' };
        }
        if (desde.getTime() > ahora.getTime() + FUTURO_MS) return { error: '«desde» está en el futuro' };
    }
    const minimo = new Date(ahora.getTime() - DIAS_MAXIMO * DIA_MS);
    if (desde < minimo) return { desde: minimo, despuesDe: null, recortado: true };
    return { desde, despuesDe: cursor.valor, recortado: false };
};

/** `obras` de /estado: lista de ID 3G sin repetir. { obras } o { error }. */
export const leerObras = (query = {}) => {
    const { repetido, valor } = unValor(query.obras);
    if (repetido) return { error: '«obras» va una sola vez, separada por comas' };
    const obras = [...new Set(valor.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean))];
    if (!obras.length) return { error: 'Falta «obras»: los ID 3G separados por comas (3G-26-0412,3G-26-0415)' };
    if (obras.length > MAX_LISTA) return { error: `«obras» trae ${obras.length}; el máximo es ${MAX_LISTA}` };
    const malas = obras.filter((o) => !ES_ID3G.test(o));
    if (malas.length) return { error: `Estos no son ID 3G (3G-AA-NNNN): ${malas.slice(0, 5).map((m) => m.slice(0, 20)).join(', ')}` };
    return { obras };
};

/** Mapa id → fecha (AAAA-MM-DD o null) de la foto que guarda la revisión de cada 5 min. */
export const leerFoto = (valor) => {
    const foto = new Map();
    try {
        const obj = valor ? JSON.parse(valor) : {};
        for (const [id, fecha] of Object.entries(obj)) foto.set(Number(id), typeof fecha === 'string' && RE_DIA.test(fecha) ? fecha : null);
    } catch { /* foto ilegible: todo sale del Índice */ }
    return foto;
};

/** La fecha de instalación sin leer Sheets: la de la foto (ya cruzada con el calendario) o la del Índice. */
export const fechaDeObra = (p, foto) => {
    const indice = p.fecha_limite || null;
    const deFoto = foto?.get(p.id) || null;
    if (deFoto) return { fecha: deFoto, fuente: deFoto === indice ? 'indice' : 'calendario' };
    return { fecha: indice, fuente: indice ? 'indice' : null };
};

/**
 * El pronóstico de PLA-17 como lo ve el tablero, con su texto libre limpio: `motivo` (300) y `fechaPropuesta` (120, «lo
 * que dijo») llegan escritos por la persona, y `texto` los repite («Reagendar: motivo · fecha»).
 */
const pronosticoLimpio = (p) => ({
    ...p,
    texto: sinDatos(p.texto, 460),
    motivo: sinDatos(p.motivo, 300),
    fechaPropuesta: sinDatos(p.fechaPropuesta, 120)
});

/** Lo que Operación ve de cada obra. Pura. */
export const armarObra = (p, { obraId = null, foto = null, pronostico = null, ahora = new Date() } = {}) => {
    const tipo = p.tipo_proyecto ? String(p.tipo_proyecto).trim().toUpperCase() : null;
    const r = resumenProduccion(p);
    return {
        proyectoId: p.id,
        obraId: obraId || null,
        proyecto: sinDatos(p.nombre, 200),
        cliente: sinDatos(p.cliente, 200),
        tipo,
        extensivo: !!p.es_extensivo,
        premium: !!p.es_premium,
        sinProduccion: (tipo === 'MTO' || tipo === 'GTIA') && !p.es_extensivo,
        cancelada: !!tipo && tipo.startsWith('CANCELADO'),
        etapa: p.etapa_actual,
        entregada: p.etapa_actual === 'completado',
        cerradaEn: iso(p.instalacion_completado_en),
        cerradaConSesion: p.instalacion_completado_por !== null && p.instalacion_completado_por !== undefined,
        areas: {
            manufactura: { aplica: !!p.tiene_manufactura, lista: !!p.manufactura_completado, listaEn: iso(p.manufactura_completado_en) },
            herreria: {
                aplica: !!p.tiene_herreria,
                lista: !!p.herreria_completado,
                listaEn: iso(p.herreria_completado_en),
                soldadura: !!p.herreria_armado_completado,
                pintura: !!p.herreria_pintado_completado
            },
            pendientes: r.pendientes,
            sinPlanos: r.sin_planos,
            produccionCerrada: r.produccion_cerrada
        },
        fechaInstalacion: fechaDeObra(p, foto),
        fechaIndice: p.fecha_limite || null,
        pausado: !!p.pausado,
        pronostico: pronostico ? pronosticoLimpio(pronosticoParaTablero(pronostico, ahora)) : null
    };
};

const articulo = (a, cantidad, extra = {}) => ({
    nombre: sinDatos(a?.nombre, 120) || 'Artículo',
    cantidad: numero(cantidad),
    ...extra,
    unidad: a?.unidad || null
});

const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * La obra de un ticket por su nombre, con la regla de siempre (mismosProyectos: «THELMA PADILLA / MTO» ≈ «THELMA
 * PADILLA»). Si empata con dos obras, gana la de nombre idéntico. null si no es de ninguna.
 */
export const obraDelTicket = (ticketProyecto, obras) => {
    const candidatas = obras.filter((o) => mismosProyectos(ticketProyecto, o.nombre));
    if (candidatas.length < 2) return candidatas[0] || null;
    const n = normalizar(ticketProyecto);
    return candidatas.find((o) => normalizar(o.nombre) === n) || candidatas[0];
};

/**
 * El material de cada obra: tickets abiertos (empate por nombre, como tickets-abiertos) y, de sus solicitudes de
 * compra, las órdenes abiertas y lo que aún no tiene orden. Pura: recibe lo leído de la base.
 * @returns {Map<number, {tickets, ordenes, sinOrden}>}
 */
export const materialPorObra = (obras, tickets, solicitudes, hoy, surtido = new Map()) => {
    const res = new Map(obras.map((p) => [p.id, { tickets: [], ordenes: [], sinOrden: [] }]));
    const obraDeTicket = new Map();
    for (const t of tickets) {
        const p = obraDelTicket(t.proyecto, obras);
        if (!p) continue;
        obraDeTicket.set(t.id, p.id);
        const m = res.get(p.id);
        if (m.tickets.length >= MAX_MATERIAL) continue;
        const { total = 0, surtidos = 0 } = surtido.get(t.id) || {};
        m.tickets.push({ folio: t.ticket_id, estado: t.estado, fecha: diaMexico(t.fecha_hora), surtido: total ? Math.round((surtidos / total) * 100) : 0 });
    }
    const ordenesPorObra = new Map();
    for (const s of solicitudes) {
        const pid = obraDeTicket.get(s.pedido_origen_id);
        if (!pid) continue;
        const m = res.get(pid);
        const oc = s.ordenCompra;
        if (s.estado === 'pendiente' && !oc) {
            if (m.sinOrden.length < MAX_MATERIAL) m.sinOrden.push(articulo(s.articulo, s.cantidad_solicitada));
            continue;
        }
        if (!oc || !ORDENES_ABIERTAS.includes(oc.estado) || oc.fecha_recepcion) continue;
        const porObra = ordenesPorObra.get(pid) || new Map();
        ordenesPorObra.set(pid, porObra);
        let o = porObra.get(oc.id);
        if (!o) {
            if (porObra.size >= MAX_MATERIAL) continue;
            const llegada = diaUTC(oc.fecha_llegada_estimada);
            o = {
                folio: oc.ticket_id,
                estado: oc.estado,
                proveedor: sinDatos(oc.proveedor?.nombre, 120),
                llegadaEstimada: llegada,
                vencida: !!llegada && llegada < hoy && ORDENES_EN_CAMINO.includes(oc.estado),
                articulos: []
            };
            porObra.set(oc.id, o);
            m.ordenes.push(o);
        }
        if (o.articulos.length < MAX_MATERIAL) o.articulos.push(articulo(s.articulo, s.cantidad_solicitada));
    }
    return res;
};

/** Las órdenes que se esperaban hasta hoy (material de la primera página de /en-curso). Pura. */
export const ordenesDelDia = (ordenes, proyectosDeOrden, hoy) => ordenes.slice(0, MAX_LISTA).map((oc) => {
    const llegada = diaUTC(oc.fecha_llegada_estimada);
    return {
        folio: oc.ticket_id,
        estado: oc.estado,
        proveedor: sinDatos(oc.proveedor?.nombre, 120),
        llegadaEstimada: llegada,
        vencida: !!llegada && llegada < hoy,
        articulos: (oc.detalles || []).slice(0, MAX_MATERIAL).map((d) => articulo(d.articulo, d.cantidad_solicitada, { recibida: numero(d.cantidad_recibida) })),
        proyectos: [...(proyectosDeOrden.get(oc.id) || [])].slice(0, MAX_MATERIAL)
    };
});

// ---------- Consultas ----------

const leerFotoDeBase = async () => {
    try {
        const fila = await Configuracion.findOne({ where: { clave: CLAVE_FOTO }, attributes: ['valor'] });
        return leerFoto(fila?.valor);
    } catch (e) {
        console.error('[puerta] produccion: no se pudo leer la foto de fechas (sale el Índice):', e.message);
        return new Map();
    }
};

/** ID 3G, foto de fechas y pronósticos de una página de obras, en paralelo. */
const complementos = async (filas) => {
    const ids = filas.map((p) => p.id);
    const [obraIds, foto, pronosticos] = await Promise.all([
        obraIdsDeProyectos(ids),
        leerFotoDeBase(),
        ProduccionProyecto.pronosticosVigentes(ids)
    ]);
    return { obraIds, foto, pronosticos };
};

const armarPagina = (filas, { obraIds, foto, pronosticos }, ahora) => filas.map((p) => armarObra(p, {
    obraId: obraIds.get(p.id), foto, pronostico: pronosticos.get(p.id), ahora
}));

const cuerpoError = (texto) => ({ codigo: 400, cuerpo: { error: texto } });

/** GET /produccion/cerradas → { codigo, cuerpo } */
export const leerCerradas = async (req, { ahora = new Date() } = {}) => {
    const l = leerDesde(req.query, ahora);
    if (l.error) return cuerpoError(`No se pudo leer: ${l.error}.`);
    // El cursor compara al milisegundo (lo que cabe en un Date de JS): una hora guardada con microsegundos (NOW() de
    // SQL) repetiría obras entre páginas. Orden y corte usan el mismo valor; el empate lo rompe el id.
    const cerradaMs = sequelize.fn('date_trunc', 'milliseconds', sequelize.col('instalacion_completado_en'));
    const corte = l.despuesDe === null
        ? sequelize.where(cerradaMs, { [Op.gt]: l.desde })
        : { [Op.or]: [
            sequelize.where(cerradaMs, { [Op.gt]: l.desde }),
            { [Op.and]: [sequelize.where(cerradaMs, { [Op.eq]: l.desde }), { id: { [Op.gt]: l.despuesDe } }] }
        ] };
    const filas = await ProduccionProyecto.findAll({
        where: {
            etapa_actual: { [Op.in]: ETAPAS_CERRADAS }, // idx_produccion_etapa
            activo: true,
            [Op.and]: [SIN_CANCELADOS, corte]
        },
        attributes: CAMPOS_OBRA,
        order: [[cerradaMs, 'ASC'], ['id', 'ASC']],
        limit: MAX_LISTA + 1
    });
    const hayMas = filas.length > MAX_LISTA;
    const pagina = filas.slice(0, MAX_LISTA);
    const obras = armarPagina(pagina, await complementos(pagina), ahora);
    const ultima = pagina[pagina.length - 1];
    return {
        codigo: 200,
        cuerpo: {
            sistema: 'planta',
            generado: isoMexico(ahora),
            desde: l.desde.toISOString(),
            desdeRecortado: l.recortado,
            obras,
            hayMas,
            siguiente: hayMas ? { desde: new Date(ultima.instalacion_completado_en).toISOString(), despuesDe: ultima.id } : null
        }
    };
};

/** Proyectos activos con esos ID 3G (la columna obra_id va fuera del modelo, como en obraId.service.js). */
const proyectosDeObras = async (obras) => {
    const [filas] = await sequelize.query(
        'SELECT id, obra_id FROM produccion_proyectos WHERE obra_id IN (:obras) AND activo = true',
        { replacements: { obras } }
    );
    return filas;
};

/** GET /produccion/estado → { codigo, cuerpo } */
export const leerEstado = async (req, { ahora = new Date() } = {}) => {
    const l = leerObras(req.query);
    if (l.error) return cuerpoError(`No se pudo leer: ${l.error}.`);
    const ligas = await proyectosDeObras(l.obras);
    const ids = [...new Set(ligas.map((f) => f.id))];
    const filas = ids.length
        ? await ProduccionProyecto.findAll({ where: { id: { [Op.in]: ids }, activo: true }, attributes: CAMPOS_OBRA, order: [['id', 'ASC']], limit: MAX_LISTA })
        : [];
    const extra = await complementos(filas);
    // El ID que se pidió manda (la liga ya dice cuál es de cada proyecto)
    for (const f of ligas) extra.obraIds.set(f.id, f.obra_id);
    const obras = armarPagina(filas, extra, ahora).map((o) => ({ ...o, cerrada: ETAPAS_CERRADAS.includes(o.etapa) }));
    const vistas = new Set(obras.map((o) => o.obraId));
    return {
        codigo: 200,
        cuerpo: {
            sistema: 'planta',
            generado: isoMexico(ahora),
            obras: obras.sort((a, b) => l.obras.indexOf(a.obraId) - l.obras.indexOf(b.obraId)),
            noEncontradas: l.obras.filter((o) => !vistas.has(o))
        }
    };
};

/** Tickets abiertos (los más nuevos primero) con lo surtido de cada uno. */
const leerTicketsAbiertos = () => Movimiento.findAll({
    where: { tipo: 'pedido', estado: { [Op.in]: TICKETS_ABIERTOS } }, // índice de tipo
    attributes: ['id', 'ticket_id', 'proyecto', 'estado', 'fecha_hora'],
    order: [['fecha_hora', 'DESC'], ['id', 'DESC']],
    limit: MAX_TICKETS_LEIDOS
});

/** Map id del ticket → { total, surtidos } (renglones y renglones ya entregados), solo de los tickets de la página. */
const leerSurtido = async (ticketIds) => {
    const mapa = new Map();
    if (!ticketIds.length) return mapa;
    const filas = await DetalleMovimiento.findAll({
        where: { movimiento_id: { [Op.in]: ticketIds } },
        attributes: [
            'movimiento_id',
            [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
            [sequelize.literal('COUNT(*) FILTER (WHERE dispersado)'), 'surtidos']
        ],
        group: ['movimiento_id'],
        raw: true
    });
    for (const f of filas) mapa.set(Number(f.movimiento_id), { total: Number(f.total) || 0, surtidos: Number(f.surtidos) || 0 });
    return mapa;
};

const leerSolicitudesDeTickets = (ticketIds) => (ticketIds.length ? SolicitudCompra.findAll({
    where: { pedido_origen_id: { [Op.in]: ticketIds }, estado: { [Op.in]: ['pendiente', 'en_orden'] } },
    attributes: ['id', 'pedido_origen_id', 'cantidad_solicitada', 'estado'],
    include: [
        { model: Articulo, as: 'articulo', attributes: ['nombre', 'unidad'], required: false },
        {
            model: OrdenCompra, as: 'ordenCompra', required: false,
            attributes: ['id', 'ticket_id', 'estado', 'fecha_llegada_estimada', 'fecha_recepcion'],
            include: [{ model: Proveedor, as: 'proveedor', attributes: ['nombre'], required: false }]
        }
    ],
    order: [['id', 'ASC']],
    limit: MAX_SOLICITUDES_LEIDAS
}) : []);

/** Órdenes en camino con llegada estimada hasta hoy y los proyectos de los tickets que las originaron. */
const leerOrdenesDelDia = async (hoy) => {
    const ordenes = await OrdenCompra.findAll({
        where: {
            estado: { [Op.in]: ORDENES_EN_CAMINO },
            fecha_recepcion: null,
            fecha_llegada_estimada: { [Op.lt]: new Date(`${sumarDias(hoy, 1)}T00:00:00Z`) }
        },
        attributes: ['id', 'ticket_id', 'estado', 'fecha_llegada_estimada'],
        include: [
            { model: Proveedor, as: 'proveedor', attributes: ['nombre'], required: false },
            {
                model: DetalleOrdenCompra, as: 'detalles', required: false,
                attributes: ['cantidad_solicitada', 'cantidad_recibida'],
                include: [{ model: Articulo, as: 'articulo', attributes: ['nombre', 'unidad'], required: false }]
            }
        ],
        // Las de hoy primero y luego las vencidas más recientes: una orden vencida hace meses no tapa a las de hoy.
        order: [['fecha_llegada_estimada', 'DESC'], ['id', 'ASC']],
        limit: MAX_LISTA
    });
    const proyectosDeOrden = new Map();
    if (ordenes.length) {
        const sols = await SolicitudCompra.findAll({
            where: { orden_compra_id: { [Op.in]: ordenes.map((o) => o.id) } },
            attributes: ['orden_compra_id'],
            include: [{ model: Movimiento, as: 'pedidoOrigen', attributes: ['proyecto'], required: true }],
            limit: 500
        });
        for (const s of sols) {
            const nombre = sinDatos(s.pedidoOrigen?.proyecto, 200);
            if (!nombre) continue;
            const set = proyectosDeOrden.get(s.orden_compra_id) || new Set();
            set.add(nombre);
            proyectosDeOrden.set(s.orden_compra_id, set);
        }
    }
    return ordenesDelDia(ordenes, proyectosDeOrden, hoy);
};

/** GET /produccion/en-curso → { codigo, cuerpo } */
export const leerEnCurso = async (req, { ahora = new Date() } = {}) => {
    const cursor = leerDespuesDe(req.query);
    if (cursor.error) return cuerpoError(`No se pudo leer: ${cursor.error}.`);
    const hoy = diaMexico(ahora);
    const primeraPagina = cursor.valor === null;
    const avisos = [];
    // Lo de las obras es lo principal: si el material no se puede leer, las obras salen igual y `avisos` lo dice.
    const sinMaterial = (texto) => (e) => {
        console.error(`[puerta] produccion/en-curso: ${texto}:`, e.message);
        avisos.push(`No se pudo leer ${texto}.`);
        return null;
    };
    // El material del día no depende de la página: se pide a la par.
    const delDia = primeraPagina ? leerOrdenesDelDia(hoy).catch(sinMaterial('el material que se esperaba hoy')) : null;
    const filas = await ProduccionProyecto.findAll({
        where: {
            etapa_actual: { [Op.in]: ETAPAS_EN_CURSO }, // idx_produccion_etapa
            activo: true,
            ...(primeraPagina ? {} : { id: { [Op.gt]: cursor.valor } }),
            [Op.and]: [
                SIN_CANCELADOS,
                { [Op.or]: [
                    { etapa_actual: 'produccion' },
                    { tiene_manufactura: true, manufactura_completado: false },
                    { tiene_herreria: true, herreria_completado: false }
                ] }
            ]
        },
        attributes: CAMPOS_EN_CURSO,
        order: [['id', 'ASC']],
        limit: MAX_LISTA + 1
    });
    const hayMas = filas.length > MAX_LISTA;
    const pagina = filas.slice(0, MAX_LISTA);
    const [extra, tickets] = await Promise.all([
        complementos(pagina),
        pagina.length ? leerTicketsAbiertos().catch(sinMaterial('los tickets abiertos')) : []
    ]);
    let material = null;
    if (tickets) {
        if (tickets.length >= MAX_TICKETS_LEIDOS) avisos.push(`Hay más de ${MAX_TICKETS_LEIDOS} tickets abiertos: solo se vieron los más nuevos.`);
        // Primero los tickets: dicen de qué renglones y de qué solicitudes de compra hay que leer.
        const ticketIds = tickets.filter((t) => obraDelTicket(t.proyecto, pagina)).map((t) => t.id);
        const [surtido, solicitudes] = await Promise.all([
            leerSurtido(ticketIds).catch(sinMaterial('lo surtido de los tickets')),
            Promise.resolve(leerSolicitudesDeTickets(ticketIds)).catch(sinMaterial('las órdenes de compra de los tickets'))
        ]);
        if (solicitudes && solicitudes.length >= MAX_SOLICITUDES_LEIDAS) avisos.push(`Las obras de esta página tienen más de ${MAX_SOLICITUDES_LEIDAS} solicitudes de compra abiertas: no se vieron todas.`);
        material = materialPorObra(pagina, tickets, solicitudes || [], hoy, surtido || new Map());
    }
    const obras = armarPagina(pagina, extra, ahora).map((o, i) => {
        const p = pagina[i];
        return {
            ...o,
            prioridad: p.prioridad ?? null,
            areas: {
                diseno: { lista: !!p.diseno_completado_en },
                compras: { lista: !!p.compras_completado_en, enProceso: !!p.compras_en_proceso },
                ...o.areas
            },
            observaciones: {
                diseno: sinDatos(p.observaciones_diseno),
                compras: sinDatos(p.observaciones_compras),
                produccion: sinDatos(p.observaciones_produccion)
            },
            material: material ? material.get(p.id) : null
        };
    });
    const ordenes = primeraPagina ? await delDia : null;
    const ultima = pagina[pagina.length - 1];
    return {
        codigo: 200,
        cuerpo: {
            sistema: 'planta',
            generado: isoMexico(ahora),
            fecha: hoy,
            obras,
            hayMas,
            siguiente: hayMas ? { despuesDe: ultima.id } : null,
            ...(primeraPagina ? { material: { hoy, ordenes } } : {}),
            avisos
        }
    };
};
