/**
 * Puertas entre sistemas de Planta (D2, D3, B8 · PLA-13; plan final §7 y CONTRATO-V2 del Inicio).
 *
 *   GET /api/inicio3g/v1/salud        alcance «inicio.leer»  config, banderas, piezas y conteos de la terminal (A4)
 *   GET /api/inicio3g/v1/pendientes   alcance «inicio.leer»  órdenes por autorizar y solicitudes de cambio (D2)
 *   GET /api/inicio3g/v1/resumen      alcance «inicio.leer»  números para «El negocio»
 *   GET /api/inicio3g/v1/agenda       alcance «inicio.leer»  los avisos que Planta manda solo (D3, utils/agendaPlanta.js)
 *   GET /api/sistemas/v1/llaves       alcance «llaves.leer»  llaves y enlaces vivos, solo metadatos (B8; lo lee Cuentas 3G)
 *   GET /api/inicio3g/v1/llaves       el mismo de arriba (el contrato acepta los dos prefijos)
 *
 * Cómo se entra (igual en los cinco sistemas):
 *   - «Authorization: Bearer <llave>» y «X-3G-Origen: <sistema>» (inicio, cuentas, finanzas, ventas…).
 *   - Planta guarda solo la HUELLA SHA-256 de cada llave y sus alcances, en variables de Railway:
 *       LLAVE_ENTRANTE_<ORIGEN>_SHA256=<64 hex>      ALCANCES_<ORIGEN>=inicio.leer,llaves.leer
 *   - Comparación en tiempo constante. Sin llaves, o sin la de ese origen: 503 «puerta sin configurar» (rutas nuevas:
 *     cerradas desde el primer día no tumban nada). Llave u origen que no corresponden: 401. Sin el alcance: 403.
 *   - 60 peticiones por minuto por origen (429 con Retry-After). Registro de hora, origen, ruta, código y duración;
 *     sin IP, sin llaves y sin contenido.
 *   - Por /api/inicio3g/v1 nadie escribe: cualquier método que no sea GET responde 405.
 *   - Las escrituras de /api/sistemas/v1 (llegan en PLA-14, PLA-16, PLA-17 y PLA-20) exigen Idempotency-Key, que se
 *     recuerda 7 días (tabla idempotencia_sistemas): la misma llave con el mismo cuerpo devuelve la misma respuesta sin
 *     volver a escribir; con otro cuerpo, 409.
 *   - Errores { "error": "texto" }; fechas ISO con la zona de México; dinero { monto, moneda: "MXN" }; listas de 50
 *     como máximo. Ninguna respuesta trae una llave, un código, una contraseña ni una huella.
 *   - Va montado en server.js ANTES de las rutas con sesión (ninguna de estas pasa por verificarToken).
 */
import crypto from 'crypto';
import express from 'express';
import { Op } from 'sequelize';
import { sequelize } from '../../config/database.js';
import LlaveSistema from '../../models/LlaveSistema.js';
import Idempotencia from '../../models/Idempotencia.js';
import { cuerpoSalud, isoMexico } from '../../utils/revisarConfig.js';

export const PREFIJO_INICIO = '/api/inicio3g/v1';
export const PREFIJO_SISTEMAS = '/api/sistemas/v1';
const LIMITE_POR_MINUTO = 60;
const ESPERA_BASE_MS = 2000; // la respuesta completa debe tardar menos de 3 s
const MAX_LISTA = 50;
const DIA_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENCIA_MS = 7 * DIA_MS;

const sha256 = (texto) => crypto.createHash('sha256').update(String(texto), 'utf8').digest();
const frontend = () => (process.env.FRONTEND_URL || 'https://inventario-3-g.vercel.app').replace(/\/+$/, '');
const dinero = (v) => ({ monto: Math.round((Number.parseFloat(v) || 0) * 100) / 100, moneda: 'MXN' });
const pesos = (v) => `$${(Number.parseFloat(v) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Llaves entrantes (solo huellas) y sus alcances, de las variables de entorno. */
export const leerRegistro = (env = process.env) => {
    const registro = new Map();
    for (const [nombre, valor] of Object.entries(env)) {
        const m = /^LLAVE_ENTRANTE_([A-Z0-9_]+)_SHA256$/.exec(nombre);
        if (!m) continue;
        const origen = m[1].toLowerCase().replace(/_/g, '-');
        const huella = String(valor || '').trim().toLowerCase();
        const alcances = String(env[`ALCANCES_${m[1]}`] || '').split(/[\s,]+/).map((a) => a.trim()).filter(Boolean);
        registro.set(origen, { origen, huella: /^[0-9a-f]{64}$/.test(huella) ? Buffer.from(huella, 'hex') : null, alcances });
    }
    return registro;
};

const error = (res, codigo, texto, extra = {}) => res.status(codigo).set(extra).json({ error: texto });

// ---------- Uso de cada llave (para /llaves: creada y último uso), sin la llave ni su huella ----------
const usoEnMemoria = new Map();
const anotarUso = (entrada) => {
    const ahora = new Date();
    usoEnMemoria.set(entrada.origen, ahora);
    const marca = crypto.createHash('sha256').update(entrada.huella).digest('hex').slice(0, 12);
    const alcances = entrada.alcances.join(',');
    (async () => {
        const fila = await LlaveSistema.findOne({ where: { origen: entrada.origen } });
        if (!fila) await LlaveSistema.create({ origen: entrada.origen, marca, alcances, creada: ahora, ultimo_uso: ahora, usos: 1 });
        else if (fila.marca !== marca) await fila.update({ marca, alcances, creada: ahora, ultimo_uso: ahora, usos: 1 });
        else await fila.update({ alcances, ultimo_uso: ahora, usos: fila.usos + 1 });
    })().catch(() => { /* el registro de uso nunca tumba la puerta */ });
};

/**
 * Intermediario de la llave por origen. Deja en req.puerta = { origen, alcances }.
 * `registro` se lee una vez al crear las puertas (las variables cambian al reiniciar, como en Railway).
 */
export const autenticarPuerta = (registro, { ventanas = new Map() } = {}) => (req, res, next) => {
    const origen = String(req.get('X-3G-Origen') || '').trim().toLowerCase();
    req.puertaOrigen = origen;
    const llave = (/^Bearer\s+(.+)$/i.exec(req.get('Authorization') || '') || [])[1];
    if (!registro.size) return error(res, 503, 'Puerta sin configurar: Planta todavía no tiene llaves de otros sistemas.');
    if (!origen || !llave) return error(res, 401, 'Falta la llave o el origen (Authorization y X-3G-Origen).');
    if (!/^[a-z0-9-]{2,30}$/.test(origen)) return error(res, 401, 'Origen no válido.');
    const entrada = registro.get(origen);
    if (!entrada || !entrada.huella || !entrada.alcances.length) return error(res, 503, `Puerta sin configurar para «${origen}».`);
    if (!crypto.timingSafeEqual(sha256(String(llave).trim()), entrada.huella)) return error(res, 401, 'Llave no válida.');
    // 60 por minuto por origen (ventana fija de un minuto)
    const ahora = Date.now();
    const v = ventanas.get(origen);
    if (!v || ahora - v.desde >= 60000) ventanas.set(origen, { desde: ahora, cuenta: 1 });
    else if (++v.cuenta > LIMITE_POR_MINUTO) {
        return error(res, 429, 'Demasiadas peticiones de este sistema; intenta de nuevo en un minuto.', { 'Retry-After': String(Math.ceil((60000 - (ahora - v.desde)) / 1000)) });
    }
    anotarUso(entrada);
    req.puerta = { origen, alcances: entrada.alcances };
    return next();
};

export const exigirAlcance = (alcance) => (req, res, next) => (req.puerta?.alcances.includes(alcance)
    ? next()
    : error(res, 403, `Esta llave no tiene el alcance «${alcance}».`));

/**
 * Escrituras entre sistemas: Idempotency-Key obligatoria y recordada 7 días por origen y ruta.
 * Las tareas que agreguen escrituras (PLA-14, PLA-16, PLA-17, PLA-20) las montan detrás de esto.
 */
let ultimaLimpieza = 0;
export const idempotente = async (req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const clave = String(req.get('Idempotency-Key') || '').trim();
    if (!clave || clave.length > 200) return error(res, 400, 'Falta la cabecera Idempotency-Key: las escrituras entre sistemas la exigen.');
    const origen = req.puerta?.origen || '—';
    const ruta = `${req.method} ${req.originalUrl.split('?')[0]}`.slice(0, 200);
    const huella = sha256(JSON.stringify(req.body ?? null)).toString('hex');
    const ahora = new Date();
    try {
        if (Date.now() - ultimaLimpieza > 60 * 60 * 1000) {
            ultimaLimpieza = Date.now();
            await Idempotencia.destroy({ where: { vence: { [Op.lte]: ahora } } });
        }
        const previa = await Idempotencia.findOne({ where: { origen, clave, ruta } });
        if (previa && new Date(previa.vence) > ahora) {
            if (previa.huella_cuerpo !== huella) return error(res, 409, 'Esa Idempotency-Key ya se usó con otro contenido.');
            if (previa.estado_http == null) return error(res, 409, 'Esa escritura todavía se está procesando; intenta de nuevo en unos segundos.');
            res.set('Idempotent-Replayed', 'true');
            return res.status(previa.estado_http).json(previa.respuesta);
        }
        if (previa) await previa.destroy(); // vencida: se puede volver a usar
        const registro = await Idempotencia.create({ origen, clave, ruta, huella_cuerpo: huella, vence: new Date(ahora.getTime() + IDEMPOTENCIA_MS) });
        const json = res.json.bind(res);
        res.json = (cuerpo) => {
            const estado = res.statusCode;
            // Un error del servidor no se recuerda: el otro sistema puede reintentar con la misma llave.
            (estado >= 500 ? registro.destroy() : registro.update({ estado_http: estado, respuesta: cuerpo ?? null })).catch(() => {});
            return json(cuerpo);
        };
        return next();
    } catch (e) {
        if (e?.name === 'SequelizeUniqueConstraintError') return error(res, 409, 'Esa escritura todavía se está procesando; intenta de nuevo en unos segundos.');
        console.error('[puerta] idempotencia:', e.message);
        return error(res, 503, 'No se pudo registrar la escritura; intenta de nuevo.');
    }
};

// ---------- Piezas extra de /salud (las que piden la base) ----------
const conTope = (promesa, ms) => {
    let t;
    return Promise.race([promesa, new Promise((_, mal) => { t = setTimeout(() => mal(new Error('tiempo')), ms); })]).finally(() => clearTimeout(t));
};
let baseMalDesde = null;
const piezasConBase = async () => {
    const piezas = [];
    const t0 = Date.now();
    try {
        await conTope(sequelize.query('SELECT 1'), ESPERA_BASE_MS);
        baseMalDesde = null;
        piezas.push({ id: 'base', nombre: 'Base de datos de Planta', estado: 'ok', mensaje: `Responde (${Date.now() - t0} ms)` });
    } catch (e) {
        if (!baseMalDesde) baseMalDesde = new Date();
        piezas.push({ id: 'base', nombre: 'Base de datos de Planta', estado: 'mal', mensaje: e?.message === 'tiempo' ? `No respondió en ${ESPERA_BASE_MS / 1000} s` : 'No responde', desde: isoMexico(baseMalDesde) });
        return piezas; // sin base no tiene caso preguntar por la cola
    }
    // La cola de avisos que recoge Julia (la línea del contable): si hay avisos que esperan de más, Julia no los está recogiendo.
    try {
        const { ventanaAvisos, dentroDeHorario } = await import('../../utils/horarioAvisos.js');
        const ventana = ventanaAvisos();
        const [[c]] = await conTope(sequelize.query(
            `SELECT COUNT(*)::int AS pendientes, MIN(created_at) AS mas_viejo,
                    COUNT(*) FILTER (WHERE estado = 'error' AND updated_at > NOW() - INTERVAL '24 hours')::int AS errores
               FROM avisos_whatsapp WHERE estado IN ('pendiente', 'error') AND (estado = 'error' OR intentos < 5)`
        ), ESPERA_BASE_MS);
        const espera = c.mas_viejo ? Date.now() - new Date(c.mas_viejo).getTime() : 0;
        const enHorario = dentroDeHorario(new Date(), ventana);
        let pieza = { id: 'cola-avisos', nombre: 'Avisos de Planta a WhatsApp (la cola que recoge Julia)', estado: 'ok', mensaje: c.pendientes ? `${c.pendientes} por salir` : 'Al día' };
        if (c.pendientes && !enHorario) pieza.mensaje = `${c.pendientes} esperan al horario (HORARIO_AVISOS)`;
        else if (c.pendientes && espera > 10 * 60000) {
            pieza = { ...pieza, estado: 'aviso', mensaje: `${c.pendientes} sin recoger; el más viejo espera desde hace ${Math.round(espera / 60000)} min`, desde: isoMexico(new Date(c.mas_viejo)) };
        }
        if (c.errores) pieza = { ...pieza, estado: pieza.estado === 'ok' ? 'aviso' : pieza.estado, mensaje: `${pieza.mensaje} · ${c.errores} no salieron en 24 h` };
        piezas.push(pieza);
    } catch (e) {
        piezas.push({ id: 'cola-avisos', nombre: 'Avisos de Planta a WhatsApp (la cola que recoge Julia)', estado: 'aviso', mensaje: 'No se pudo revisar la cola' });
    }
    // De dónde salen los festivos (PLA-07)
    try {
        const { estadoCalendarioLaboral } = await import('../../utils/calendarioLaboral.js');
        const cal = estadoCalendarioLaboral();
        piezas.push(!cal.operacionConfigurada
            ? { id: 'festivos', nombre: 'Días festivos', estado: 'ok', mensaje: 'Solo los oficiales (Operación sin conectar)' }
            : cal.leidoEn
                ? { id: 'festivos', nombre: 'Días festivos', estado: 'ok', mensaje: `Oficiales y ${cal.festivosNegocio} del negocio (Operación)` }
                : { id: 'festivos', nombre: 'Días festivos', estado: 'aviso', mensaje: 'No se ha podido leer el calendario de Operación: solo los oficiales' });
    } catch { /* sin pieza */ }
    return piezas;
};

// ---------- /pendientes (D2) ----------
const TITULO_CAMBIO = {
    cambio_ubicacion: 'Autorizar un cambio de ubicación',
    entrada_stock: 'Autorizar una entrada de material',
    salida_stock: 'Autorizar una salida de material',
    crear_articulo: 'Autorizar un artículo nuevo',
    desactivar_articulo: 'Autorizar que se desactive un artículo',
    reactivar_articulo: 'Autorizar que se reactive un artículo',
    cambio_codigo: 'Autorizar un cambio de código'
};
const PUESTOS = ['dir', 'oficina', 'asesor', 'supervisor', 'conta', 'almacen', 'compras', 'diseno'];

export const pendientesPlanta = async ({ puesto = null } = {}) => {
    const { OrdenCompra, Proveedor, SolicitudCambio, Articulo, Usuario } = await import('../../models/index.js');
    const { cancelacionProgramadaEncendida } = await import('../../controllers/ordenesCompra.controller.js');
    const ahora = Date.now();
    const lista = [];
    if (!puesto || ['dir', 'compras'].includes(puesto)) {
        const ordenes = await OrdenCompra.findAll({
            where: { estado: 'pendiente_aprobacion' },
            attributes: ['id', 'ticket_id', 'total_estimado', 'created_at'],
            include: [{ model: Proveedor, as: 'proveedor', attributes: ['nombre'], required: false }],
            order: [['created_at', 'ASC'], ['id', 'ASC']],
            limit: MAX_LISTA
        });
        for (const o of ordenes) {
            const dias = (ahora - new Date(o.created_at).getTime()) / DIA_MS;
            lista.push({
                id: `planta-oc-${String(o.ticket_id || o.id).toLowerCase().replace(/^oc-/, '')}`,
                titulo: `Aprobar la orden de compra ${o.ticket_id}`,
                detalle: `${o.proveedor?.nombre || 'Sin proveedor'} · ${pesos(o.total_estimado)}`,
                monto: dinero(o.total_estimado),
                urgencia: dias >= 2 ? 'alta' : 'media',
                hora: null,
                // La regla de los 3 días solo es un plazo real con la cancelación programada (D6 · PLA-18).
                vence: cancelacionProgramadaEncendida() ? isoMexico(new Date(new Date(o.created_at).getTime() + 3 * DIA_MS)) : null,
                desde: isoMexico(new Date(o.created_at)),
                etapa: 'material',
                area: 'Compras',
                fuente: 'planta',
                tipo: 'orden',
                obra: null,
                persona: null,
                accion: 'Aprobar',
                url: `${frontend()}/ordenes-compra?orden=${encodeURIComponent(o.ticket_id)}`,
                puestos: ['dir', 'compras']
            });
        }
    }
    if (!puesto || puesto === 'dir') {
        const cambios = await SolicitudCambio.findAll({
            where: { estado: 'pendiente' },
            attributes: ['id', 'tipo', 'payload', 'created_at'],
            include: [
                { model: Articulo, as: 'articulo', attributes: ['nombre'], required: false },
                { model: Usuario, as: 'solicitante', attributes: ['nombre'], required: false }
            ],
            order: [['created_at', 'ASC'], ['id', 'ASC']],
            limit: MAX_LISTA
        });
        for (const c of cambios) {
            lista.push({
                id: `planta-cambio-${c.id}`,
                titulo: TITULO_CAMBIO[c.tipo] || 'Autorizar un cambio en el inventario',
                detalle: `${c.articulo?.nombre || c.payload?.nombre || 'Artículo'}${c.solicitante?.nombre ? ` · lo pidió ${c.solicitante.nombre}` : ''}`,
                urgencia: 'media',
                hora: null,
                vence: null,
                desde: isoMexico(new Date(c.created_at)),
                etapa: null,
                area: 'Almacén',
                fuente: 'planta',
                tipo: 'decision',
                obra: null,
                persona: null,
                accion: 'Autorizar',
                url: `${frontend()}/solicitudes-cambio`,
                puestos: ['dir']
            });
        }
    }
    const peso = { alta: 0, media: 1, baja: 2 };
    lista.sort((a, b) => peso[a.urgencia] - peso[b.urgencia] || a.desde.localeCompare(b.desde));
    return { sistema: 'planta', generado: isoMexico(), pendientes: lista.slice(0, MAX_LISTA) };
};

// ---------- /resumen («El negocio») ----------
export const resumenPlanta = async ({ puesto = null } = {}) => {
    const { ProduccionProyecto, OrdenCompra, Movimiento, SolicitudCambio, SolicitudCompra } = await import('../../models/index.js');
    const F = frontend();
    const [enMaterial, enProduccion, porAutorizar, ticketsPorSurtir, cambios, solicitudes] = await Promise.all([
        ProduccionProyecto.count({ where: { etapa_actual: { [Op.in]: ['diseno', 'compras'] } } }),
        ProduccionProyecto.count({ where: { etapa_actual: 'produccion' } }),
        OrdenCompra.count({ where: { estado: 'pendiente_aprobacion' } }),
        Movimiento.count({ where: { tipo: 'pedido', estado: { [Op.in]: ['pendiente', 'aprobado'] } } }),
        SolicitudCambio.count({ where: { estado: 'pendiente' } }),
        SolicitudCompra.count({ where: { estado: 'pendiente' } })
    ]);
    const numero = {
        ordenes: { id: 'ordenes-por-autorizar', valor: porAutorizar, texto: porAutorizar === 1 ? 'orden de compra por autorizar' : 'órdenes de compra por autorizar', estado: porAutorizar ? 'aviso' : 'ok', url: `${F}/ordenes-compra` },
        tickets: { id: 'tickets-por-surtir', valor: ticketsPorSurtir, texto: ticketsPorSurtir === 1 ? 'ticket por surtir' : 'tickets por surtir', estado: 'ok', url: `${F}/pedidos-pendientes` },
        cambios: { id: 'cambios-por-autorizar', valor: cambios, texto: cambios === 1 ? 'cambio de inventario por autorizar' : 'cambios de inventario por autorizar', estado: cambios ? 'aviso' : 'ok', url: `${F}/solicitudes-cambio` },
        solicitudes: { id: 'solicitudes-de-compra', valor: solicitudes, texto: solicitudes === 1 ? 'solicitud de compra sin orden' : 'solicitudes de compra sin orden', estado: 'ok', url: `${F}/solicitudes-compra` }
    };
    const porPuesto = {
        dir: ['ordenes', 'tickets', 'cambios'],
        compras: ['ordenes', 'solicitudes'],
        almacen: ['tickets', 'cambios'],
        diseno: ['solicitudes']
    };
    const ids = puesto ? (porPuesto[puesto] || []) : porPuesto.dir;
    return {
        sistema: 'planta',
        generado: isoMexico(),
        etapas: [
            { etapa: 'material', cuenta: enMaterial, texto: enMaterial === 1 ? 'proyecto en diseño y compras' : 'proyectos en diseño y compras', detalle: `${porAutorizar} ${porAutorizar === 1 ? 'orden' : 'órdenes'} por autorizar`, estado: 'ok', url: `${F}/produccion` },
            { etapa: 'produccion', cuenta: enProduccion, texto: enProduccion === 1 ? 'proyecto en producción' : 'proyectos en producción', detalle: null, estado: 'ok', url: `${F}/produccion` }
        ],
        numeros: ids.slice(0, 3).map((k) => numero[k])
    };
};

// ---------- /llaves (B8) ----------
const NOMBRE_AREA = { diseno: 'Diseño', compras: 'Compras', manufactura: 'Manufactura', herreria: 'Herrería', instalacion: 'Instalación' };
export const llavesPlanta = async (registro) => {
    const llaves = [];
    if (String(process.env.WHATSAPP_PUENTE_TOKEN || '').trim()) {
        llaves.push({ id: 'planta-puente-whatsapp', tipo: 'llave-entre-sistemas', paraQuien: 'Finanzas (Julia, la línea del contable)', alcance: 'La cola de avisos de Planta, las decisiones de las órdenes por WhatsApp y los costos de las facturas', creada: null, ultimoUso: null, vence: null, revocarEn: null });
    }
    llaves.push({
        id: 'planta-correo-ordenes', tipo: 'firma-de-ligas', paraQuien: 'Dirección (correo de órdenes de compra)',
        alcance: `Aprobar o rechazar una orden desde el correo, 72 h por liga${String(process.env.OC_CORREO_SECRETO || '').trim() ? '' : ' (firma con la llave de sesiones: falta OC_CORREO_SECRETO)'}`,
        creada: null, ultimoUso: null, vence: null, revocarEn: null
    });
    try {
        const { configTerminal, AREAS_TERMINAL } = await import('../../middleware/codigoTerminal.middleware.js');
        const cfg = configTerminal();
        const conPropio = new Set(cfg.codigos.values());
        for (const area of AREAS_TERMINAL) {
            llaves.push({
                id: `planta-terminal-${area}`, tipo: 'codigo-de-area', paraQuien: `Tabletas y pantallas de la terminal de ${NOMBRE_AREA[area]}`,
                alcance: `Ver y cerrar las etapas de ${NOMBRE_AREA[area]}${conPropio.has(area) ? '' : ' (código de fábrica)'}`,
                creada: null, ultimoUso: null, vence: null, revocarEn: null
            });
        }
    } catch { /* sin terminal */ }
    let filas = [];
    try { filas = await LlaveSistema.findAll({ attributes: ['origen', 'creada', 'ultimo_uso'] }); } catch { /* sin tabla */ }
    const porOrigen = new Map(filas.map((f) => [f.origen, f]));
    for (const e of [...registro.values()].filter((x) => x.huella).sort((a, b) => a.origen.localeCompare(b.origen))) {
        const f = porOrigen.get(e.origen);
        const uso = usoEnMemoria.get(e.origen) || f?.ultimo_uso;
        llaves.push({
            id: `planta-puerta-${e.origen}`, tipo: 'llave-entre-sistemas', paraQuien: e.origen, alcance: e.alcances.join(', '),
            creada: f?.creada ? isoMexico(new Date(f.creada)) : null, ultimoUso: uso ? isoMexico(new Date(uso)) : null, vence: null, revocarEn: null
        });
    }
    if (String(process.env.LLAVE_HACIA_OPERACION || '').trim()) {
        llaves.push({ id: 'planta-hacia-operacion', tipo: 'llave-hacia-otro-sistema', paraQuien: 'Operación (Planta la usa para leer el calendario laboral)', alcance: 'calendario.leer', creada: null, ultimoUso: null, vence: null, revocarEn: null });
    }
    return { sistema: 'planta', generado: isoMexico(), llaves: llaves.slice(0, MAX_LISTA) };
};

/**
 * @param {object} [opciones]
 * @param {object} [opciones.env]     variables de entorno (process.env)
 * @param {Function} [opciones.anotar] (fila) => void, registro sin datos personales
 */
export const crearPuertas = ({ env = process.env, anotar } = {}) => {
    const router = express.Router();
    const registro = leerRegistro(env);
    const escribir = anotar || ((fila) => console.log('[puerta] ' + JSON.stringify(fila)));

    // Registro de cada petición (hora, origen, ruta, código y duración; sin IP ni contenido)
    router.use([PREFIJO_INICIO, PREFIJO_SISTEMAS], (req, res, next) => {
        const inicio = Date.now();
        const ruta = req.originalUrl.split('?')[0];
        res.set('Cache-Control', 'no-store');
        res.on('finish', () => {
            escribir({
                hora: isoMexico(),
                origen: req.puerta ? req.puerta.origen : (/^[a-z0-9-]{2,30}$/.test(req.puertaOrigen || '') ? req.puertaOrigen : '—'),
                ruta,
                codigo: res.statusCode,
                ms: Date.now() - inicio
            });
        });
        next();
    });
    router.use([PREFIJO_INICIO, PREFIJO_SISTEMAS], autenticarPuerta(registro));
    // Por inicio3g solo se lee
    router.use(PREFIJO_INICIO, (req, res, next) => (['GET', 'HEAD'].includes(req.method)
        ? next()
        : error(res, 405, 'Solo lectura: por /api/inicio3g nadie escribe.', { Allow: 'GET' })));
    // Las escrituras entre sistemas exigen Idempotency-Key (no hay ninguna todavía: llegan con PLA-14 y siguientes)
    router.use(PREFIJO_SISTEMAS, idempotente);

    const leer = (alcance, fn) => [exigirAlcance(alcance), async (req, res) => {
        try {
            res.json(await conTope(fn(req), 2800));
        } catch (e) {
            console.error(`[puerta] ${req.originalUrl.split('?')[0]}:`, e.message);
            error(res, e?.message === 'tiempo' ? 504 : 500, 'Planta no pudo armar la respuesta; intenta de nuevo.');
        }
    }];
    const puestoDe = (req) => {
        const p = String(req.query.puesto || '').trim().toLowerCase();
        return PUESTOS.includes(p) ? p : (p ? '__otro__' : null);
    };

    router.get(`${PREFIJO_INICIO}/salud`, ...leer('inicio.leer', async () => cuerpoSalud({ detalle: true, piezasExtra: await piezasConBase() })));
    router.get(`${PREFIJO_INICIO}/pendientes`, ...leer('inicio.leer', async (req) => {
        const puesto = puestoDe(req);
        return puesto === '__otro__' ? { sistema: 'planta', generado: isoMexico(), pendientes: [] } : pendientesPlanta({ puesto });
    }));
    router.get(`${PREFIJO_INICIO}/resumen`, ...leer('inicio.leer', async (req) => {
        const puesto = puestoDe(req);
        return resumenPlanta({ puesto: puesto === '__otro__' ? '__otro__' : puesto });
    }));
    router.get(`${PREFIJO_INICIO}/agenda`, ...leer('inicio.leer', async () => {
        const { agendaPlanta } = await import('../../utils/agendaPlanta.js');
        return agendaPlanta();
    }));
    router.get(`${PREFIJO_SISTEMAS}/llaves`, ...leer('llaves.leer', async () => llavesPlanta(registro)));
    router.get(`${PREFIJO_INICIO}/llaves`, ...leer('llaves.leer', async () => llavesPlanta(registro)));

    // Cualquier otra ruta de las puertas
    router.use([PREFIJO_INICIO, PREFIJO_SISTEMAS], (req, res) => error(res, 404, 'No existe esa puerta en Planta.'));
    return router;
};

export default crearPuertas;
