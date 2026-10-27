/**
 * Puerta de solo lectura de producción para Operación (Carla 3G · v2 «Planta: puerta de solo lectura», pareja #20):
 *   GET /api/sistemas/v1/produccion/cerradas · /estado · /en-curso   origen «operacion», alcance «produccion.leer».
 *
 * Arma las puertas con crearPuertas() y una llave inventada, y cambia por dobles en memoria lo que leería de la base:
 * ProduccionProyecto.findAll (con un evaluador pequeño de los filtros de Sequelize que usa la puerta), la foto de fechas
 * de `configuracion`, los ID 3G y pronósticos (sequelize.query), los tickets, las solicitudes y las órdenes de compra.
 * Las peticiones van por un socket local (sin puertos de red). No toca ninguna base, ni Sheets, ni WhatsApp.
 *
 * Correr:  cd backend && npm test      (o: node --test tests/puerta-produccion.test.js)
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

// console.log va por el mismo canal que los resultados de `node --test` y a veces lo rompe; console.error sigue.
for (const m of ['log', 'info', 'debug']) console[m] = () => {};

// Antes de cargar los modelos: base inexistente y avisos apagados, aunque exista un backend/.env.
process.env.DATABASE_URL = 'postgres://prueba:prueba@127.0.0.1:9/prueba_sin_base';
process.env.WHATSAPP_PUENTE_TOKEN = '';

const express = (await import('express')).default;
const { Op } = await import('sequelize');
const { sequelize } = await import('../src/config/database.js');
const { ProduccionProyecto, Configuracion, Movimiento, DetalleMovimiento, SolicitudCompra, OrdenCompra } = await import('../src/models/index.js');
const { default: LlaveSistema } = await import('../src/models/LlaveSistema.js');
const { ProveedorFicha } = await import('../src/models/Proveedor.js');
const { default: OrdenSeguimiento, fechaLlegadaEfectiva } = await import('../src/models/OrdenSeguimiento.js');
const { crearPuertas } = await import('../src/routes/sistemas/index.js');
const P = await import('../src/routes/sistemas/produccion.js');
const { mismosProyectos } = await import('../src/services/pedidosCleanup.service.js');

// ---------- Llaves inventadas (nunca reales) ----------
const LLAVE = 'llave-operacion-de-prueba-0020-no-es-real';
const huella = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');
const ENV_BUENO = { LLAVE_ENTRANTE_OPERACION_SHA256: huella(LLAVE), ALCANCES_OPERACION: 'almacen.solicitar,produccion.leer' };

// ---------- Fechas ----------
const AHORA = Date.now();
const horasAtras = (h) => new Date(AHORA - h * 3600 * 1000);
const DIA_MX = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' });
const HOY = DIA_MX.format(new Date(AHORA));
const sumarDias = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const AYER = sumarDias(HOY, -1);

// ---------- Datos inventados ----------
const base = (datos) => ({
    cliente: null, tipo_proyecto: 'A', es_extensivo: false, es_premium: false, activo: true, prioridad: 3, fecha_limite: null,
    instalacion_completado_en: null, instalacion_completado_por: null, tiene_manufactura: false, tiene_herreria: false,
    manufactura_completado: false, manufactura_completado_en: null, herreria_completado: false, herreria_completado_en: null,
    herreria_armado_completado: false, herreria_pintado_completado: false, pausado: false, diseno_completado_en: null,
    compras_completado_en: null, compras_en_proceso: false, observaciones_diseno: null, observaciones_compras: null,
    observaciones_produccion: null, obra: null, ...datos
});

const CERRADAS = [
    base({ id: 1, nombre: 'LONA SOMBRA ESCOLAR', cliente: 'ANA LÓPEZ (462) 123 4567 ana@empresa.mx', etapa_actual: 'instalacion', instalacion_completado_en: horasAtras(48),
        instalacion_completado_por: 5, tiene_manufactura: true, manufactura_completado: true, manufactura_completado_en: horasAtras(60),
        tiene_herreria: true, herreria_completado: true, herreria_armado_completado: true, herreria_pintado_completado: true,
        fecha_limite: '2026-11-05', obra: '3G-26-0101' }),
    base({ id: 2, nombre: 'VELARIA PARQUE', etapa_actual: 'completado', instalacion_completado_en: horasAtras(24), fecha_limite: '2026-10-30' }),
    base({ id: 3, nombre: 'CERRADA HACE DIEZ DÍAS', etapa_actual: 'instalacion', instalacion_completado_en: horasAtras(240) }),
    base({ id: 4, nombre: 'CANCELADA', tipo_proyecto: 'CANCELADO A', etapa_actual: 'instalacion', instalacion_completado_en: horasAtras(20) }),
    base({ id: 5, nombre: 'DADA DE BAJA', activo: false, etapa_actual: 'instalacion', instalacion_completado_en: horasAtras(20) }),
    base({ id: 6, nombre: 'SIGUE EN PRODUCCIÓN', etapa_actual: 'produccion', instalacion_completado_en: horasAtras(20) }),
    base({ id: 7, nombre: 'MANTENIMIENTO MTO', tipo_proyecto: 'MTO', etapa_actual: 'instalacion', instalacion_completado_en: horasAtras(3), obra: '3G-26-0107' }),
    base({ id: 8, nombre: 'SIN TIPO', tipo_proyecto: null, etapa_actual: 'instalacion', instalacion_completado_en: horasAtras(120) }),
    base({ id: 9, nombre: 'CERRADA HACE CUARENTA DÍAS', etapa_actual: 'completado', instalacion_completado_en: horasAtras(40 * 24) }),
    base({ id: 10, nombre: 'DESCERRADA', etapa_actual: 'produccion', obra: '3G-26-0110' }),
    base({ id: 11, nombre: 'CANCELADA CON ID', tipo_proyecto: 'CANCELADO A', etapa_actual: 'instalacion', instalacion_completado_en: horasAtras(20), obra: '3G-26-0111' })
];

const EN_CURSO = [
    base({ id: 21, nombre: 'TOLDO RESTAURANTE', etapa_actual: 'produccion', prioridad: 1, tiene_manufactura: true, tiene_herreria: true,
        herreria_armado_completado: true, diseno_completado_en: horasAtras(300), compras_completado_en: horasAtras(200),
        observaciones_produccion: 'Falta costura; llamar al 4621234567, anticipo $12,500', observaciones_compras: 'Pagaron 8500 pesos al proveedor',
        observaciones_diseno: 'Dueña: ana@empresa.mx tel (462) 123 4567; instalar en Av. Siempre Viva 742 Col. Centro',
        fecha_limite: '2026-11-12', obra: '3G-26-0201' }),
    base({ id: 22, nombre: 'PÉRGOLA CASA CLUB', etapa_actual: 'diseno', tiene_manufactura: true,
        observaciones_compras: 'Saldo 12,500 + iva; anticipo 8500; MXN 4,000 y USD 300; proveedor 462.123.4567' }),
    base({ id: 23, nombre: 'EN COMPRAS SIN PLANOS', etapa_actual: 'compras' }),
    base({ id: 24, nombre: 'YA CERRADA', etapa_actual: 'instalacion', instalacion_completado_en: horasAtras(5), tiene_manufactura: true, manufactura_completado: true }),
    base({ id: 25, nombre: 'CANCELADA EN TALLER', tipo_proyecto: 'CANCELADO', etapa_actual: 'produccion' }),
    base({ id: 26, nombre: 'INACTIVA EN TALLER', activo: false, etapa_actual: 'produccion' }),
    base({ id: 27, nombre: 'HERRERÍA LISTA EN DISEÑO', etapa_actual: 'diseno', tiene_herreria: true, herreria_completado: true }),
    base({ id: 28, nombre: 'THELMA PADILLA', cliente: 'THELMA 462.123.9999 thelma@correo.example', etapa_actual: 'produccion' }),
    base({ id: 29, nombre: 'THELMA PADILLA / MTO', etapa_actual: 'produccion', tipo_proyecto: 'MTO', es_extensivo: true })
];

const FOTO = { 1: '2026-11-03', 2: null, 21: '2026-11-10', 22: null };

// `nombre_corto` NO es columna de proveedores (vive en la ficha): si la puerta lo leyera de aquí saldría «ACEROS».
const PROVEEDOR = { id: 7, nombre: 'ACEROS DEL BAJÍO SA DE CV', nombre_corto: 'ACEROS', telefono: '4625550101', email: 'ventas@aceros.example', direccion: 'Av. Siempre Viva 742' };
const llegadaAyer = new Date(`${AYER}T00:00:00Z`);
const TICKETS = [
    { id: 101, ticket_id: 'T-0101', proyecto: 'Toldo Restaurante / MTO', estado: 'pendiente', fecha_hora: horasAtras(30), detalles: [{ dispersado: true }, { dispersado: false }] },
    { id: 102, ticket_id: 'T-0102', proyecto: 'THELMA PADILLA / MTO', estado: 'aprobado', fecha_hora: horasAtras(20), detalles: [] },
    { id: 103, ticket_id: 'T-0103', proyecto: 'thelma padilla', estado: 'pendiente', fecha_hora: horasAtras(10), detalles: [{ dispersado: true }] },
    { id: 104, ticket_id: 'T-0104', proyecto: 'OTRA OBRA', estado: 'pendiente', fecha_hora: horasAtras(5), detalles: [] },
    { id: 105, ticket_id: 'T-0105', proyecto: null, estado: 'pendiente', fecha_hora: horasAtras(4), detalles: [] }
];
const SOLICITUDES = [
    { id: 1, pedido_origen_id: 101, estado: 'en_orden', cantidad_solicitada: '12.00', articulo: { nombre: 'Cable acero 1/4', unidad: 'metros' },
        ordenCompra: { id: 501, ticket_id: 'OC-0501', estado: 'enviada', fecha_llegada_estimada: llegadaAyer, fecha_recepcion: null, total_estimado: '12500.00', proveedor: PROVEEDOR } },
    { id: 2, pedido_origen_id: 101, estado: 'pendiente', cantidad_solicitada: '4', articulo: { nombre: 'Tensor 3/8', unidad: 'piezas' }, ordenCompra: null },
    { id: 3, pedido_origen_id: 101, estado: 'en_orden', cantidad_solicitada: '1', articulo: { nombre: 'Ya llegó', unidad: 'piezas' },
        ordenCompra: { id: 502, ticket_id: 'OC-0502', estado: 'recibida', fecha_llegada_estimada: llegadaAyer, fecha_recepcion: horasAtras(2), proveedor: PROVEEDOR } },
    { id: 4, pedido_origen_id: 102, estado: 'en_orden', cantidad_solicitada: '30', articulo: { nombre: 'Lona PVC 650', unidad: 'metros' },
        ordenCompra: { id: 503, ticket_id: 'OC-0503', estado: 'pendiente_aprobacion', fecha_llegada_estimada: null, fecha_recepcion: null, total_estimado: '3000.00', proveedor: null } },
    { id: 5, pedido_origen_id: 104, estado: 'pendiente', cantidad_solicitada: '1', articulo: { nombre: 'De otra obra', unidad: 'piezas' }, ordenCompra: null }
];
const ORDENES_DEL_DIA = [
    { id: 501, ticket_id: 'OC-0501', estado: 'enviada', fecha_llegada_estimada: llegadaAyer, total_estimado: '12500.00', proveedor: PROVEEDOR,
        detalles: [{ cantidad_solicitada: '12.00', cantidad_recibida: '0.00', costo_unitario: '1041.67', subtotal: '12500.00', articulo: { nombre: 'Cable acero 1/4', unidad: 'metros' } }] },
    { id: 504, ticket_id: 'OC-0504', estado: 'parcial', fecha_llegada_estimada: new Date(`${HOY}T00:00:00Z`), total_estimado: '999.00', proveedor: null, detalles: [] }
];

// Fichas de proveedor (proveedores_ficha, PLA-20): el 7 con nombre corto, el 8 con el nombre corto en blanco y el 9 con
// un teléfono metido en el nombre corto (sale tapado). El 10 no tiene ficha.
const FICHAS = [
    { proveedor_id: 7, nombre_corto: 'Aceros Bajío', contactos: [{ telefono: '4625550101', correo: 'ventas@aceros.example' }] },
    { proveedor_id: 8, nombre_corto: '   ' },
    { proveedor_id: 9, nombre_corto: 'Toldos tel 462 555 0101' }
];

// ---------- Evaluador pequeño de los filtros de Sequelize que usa la puerta ----------
// Postgres guarda la hora con microsegundos (NOW() de SQL) y un Date de JS solo llega al milisegundo. Una fila de la
// prueba puede traer los microsegundos aparte, en «<columna>_us» (0 a 999): la columna sola compara y ordena con ellos y
// date_trunc('milliseconds', columna) sin ellos, como en Postgres. Las horas se comparan en microsegundos.
const campoDe = (attr) => (typeof attr === 'string' ? attr : attr?.col ?? attr?.args?.find((a) => a?.col)?.col);
const truncaAlMilisegundo = (attr) => attr?.fn === 'date_trunc' && attr.args?.[0] === 'milliseconds';
const valorDe = (fila, attr) => {
    const campo = campoDe(attr);
    const v = fila[campo];
    if (!(v instanceof Date)) return v;
    return v.getTime() * 1000 + (truncaAlMilisegundo(attr) ? 0 : (fila[`${campo}_us`] || 0));
};
const tiempo = (v) => (v instanceof Date ? v.getTime() * 1000 : v);
const condicion = (valor, cond) => {
    if (cond === null) return valor === null || valor === undefined;
    if (cond instanceof Date) return valor === tiempo(cond);
    if (typeof cond !== 'object') return valor === cond;
    for (const op of Reflect.ownKeys(cond)) {
        const x = cond[op];
        if (op === Op.in) { if (!x.includes(valor)) return false; } else if (op === Op.eq) {
            if (tiempo(valor) !== tiempo(x)) return false;
        } else if (op === Op.gt) {
            if (valor === null || valor === undefined || !(tiempo(valor) > tiempo(x))) return false;
        } else if (op === Op.lt) {
            if (valor === null || valor === undefined || !(tiempo(valor) < tiempo(x))) return false;
        } else if (op === Op.notILike) {
            // Como en SQL: NULL NOT ILIKE … no es verdadero
            if (valor === null || valor === undefined) return false;
            if (new RegExp(`^${x.replace(/%/g, '.*')}$`, 'i').test(valor)) return false;
        } else throw new Error(`La prueba no conoce el operador ${String(op)}`);
    }
    return true;
};
const cumple = (fila, where = {}) => {
    if (where?.constructor?.name === 'Where') return condicion(valorDe(fila, where.attribute), where.logic);
    return Reflect.ownKeys(where).every((k) => {
        if (k === Op.or) return where[k].some((w) => cumple(fila, w));
        if (k === Op.and) return where[k].every((w) => cumple(fila, w));
        return condicion(valorDe(fila, k), where[k]);
    });
};
const ordenar = (filas, order = []) => [...filas].sort((a, b) => {
    for (const [columna, dir] of order) {
        const x = valorDe(a, columna);
        const y = valorDe(b, columna);
        if (x === y) continue;
        // Como Postgres: ASC deja los NULL al final y DESC al principio, salvo que se diga NULLS FIRST/LAST.
        const desc = /^DESC/.test(dir || '');
        const nulosPrimero = /NULLS FIRST/.test(dir || '') || (desc && !/NULLS LAST/.test(dir || ''));
        if (x === null || x === undefined) return nulosPrimero ? -1 : 1;
        if (y === null || y === undefined) return nulosPrimero ? 1 : -1;
        return (x < y ? -1 : 1) * (desc ? -1 : 1);
    }
    return 0;
});

// ---------- Dobles ----------
let proyectos = [];
let foto = FOTO;
let pronosticos = [];
let lentoMs = 0;
let fallarTickets = false;
let tickets = TICKETS;
let solicitudes = SOLICITUDES;
let ordenesCompra = ORDENES_DEL_DIA;
let fichas = FICHAS;
let fallarFichas = false;
let fechasJulia = new Map(); // orden_id → AAAA-MM-DD (lo que daría OrdenSeguimiento.fechasEstimadasJulia)
let fallarJulia = false;
const llamadasJulia = []; // los orden_id que se pidieron a Julia, por llamada
const consultas = [];
const originales = {
    findAll: ProduccionProyecto.findAll, cfg: Configuracion.findOne, query: sequelize.query, mov: Movimiento.findAll, det: DetalleMovimiento.findAll,
    sol: SolicitudCompra.findAll, oc: OrdenCompra.findAll, llFind: LlaveSistema.findOne, llCreate: LlaveSistema.create,
    ficha: ProveedorFicha.findAll, julia: OrdenSeguimiento.fechasEstimadasJulia
};

before(() => {
    ProduccionProyecto.findAll = async (opciones) => {
        consultas.push({ modelo: 'ProduccionProyecto', opciones });
        if (lentoMs) await new Promise((r) => setTimeout(r, lentoMs));
        const filas = ordenar(proyectos.filter((p) => cumple(p, opciones.where)), opciones.order);
        return filas.slice(0, opciones.limit ?? filas.length).map((p) => ProduccionProyecto.build(p));
    };
    Configuracion.findOne = async ({ where }) => (where.clave === 'produccion_fechas_instalacion' && foto ? { valor: JSON.stringify(foto) } : null);
    sequelize.query = async (sql, { replacements = {} } = {}) => {
        consultas.push({ sql });
        if (/SELECT id, obra_id FROM produccion_proyectos WHERE id IN/.test(sql)) {
            const filas = proyectos.filter((p) => replacements.ids.includes(p.id) && p.obra).map((p) => ({ id: p.id, obra_id: p.obra }));
            return [filas, filas];
        }
        // Las obras abiertas para el dueño de cada ticket (los criterios de obrasAbiertas de obraId.service.js)
        if (/SELECT id, nombre, obra_id FROM produccion_proyectos/.test(sql)) {
            assert.match(sql, /activo = true AND etapa_actual <> 'completado'/);
            assert.match(sql, /tipo_proyecto IS NULL OR tipo_proyecto NOT ILIKE 'CANCELADO%'/);
            const filas = proyectos.filter((p) => p.activo && p.etapa_actual !== 'completado' && !/^CANCELADO/i.test(p.tipo_proyecto || ''))
                .map((p) => ({ id: p.id, nombre: p.nombre, obra_id: p.obra }));
            return [filas, filas];
        }
        if (/WHERE obra_id IN \(:obras\) AND activo = true/.test(sql)) {
            const filas = proyectos.filter((p) => p.activo && replacements.obras.includes(p.obra)).map((p) => ({ id: p.id, obra_id: p.obra }));
            return [filas, filas];
        }
        if (/pronostico_whatsapp/.test(sql)) {
            const filas = pronosticos.filter((x) => replacements.ids.includes(x.id));
            return [filas, filas];
        }
        throw new Error(`consulta inesperada en la prueba: ${sql.slice(0, 60)}`);
    };
    Movimiento.findAll = async (opciones) => {
        consultas.push({ modelo: 'Movimiento', opciones });
        if (fallarTickets) throw new Error('base caída (prueba)');
        return tickets.filter((t) => t.estado === 'pendiente' || t.estado === 'aprobado').map(({ detalles, ...t }) => ({ obra_id: null, ...t }));
    };
    // Renglones de los tickets: total y surtidos por ticket (lo que da el GROUP BY)
    DetalleMovimiento.findAll = async ({ where }) => tickets.filter((t) => where.movimiento_id[Op.in].includes(t.id) && t.detalles.length)
        .map((t) => ({ movimiento_id: t.id, total: String(t.detalles.length), surtidos: String(t.detalles.filter((d) => d.dispersado).length) }));
    SolicitudCompra.findAll = async ({ where }) => {
        if (where.pedido_origen_id) return solicitudes.filter((s) => where.pedido_origen_id[Op.in].includes(s.pedido_origen_id));
        if (where.orden_compra_id) return [{ orden_compra_id: 501, pedidoOrigen: { proyecto: 'Toldo Restaurante / MTO' } }, { orden_compra_id: 501, pedidoOrigen: { proyecto: 'Toldo Restaurante / MTO' } }];
        throw new Error('solicitudes: filtro inesperado');
    };
    OrdenCompra.findAll = async (opciones) => {
        consultas.push({ modelo: 'OrdenCompra', opciones });
        const filas = ordenar(ordenesCompra.filter((o) => cumple(o, opciones.where)), opciones.order);
        return filas.slice(0, opciones.limit ?? filas.length);
    };
    // Solo se pide el nombre corto (nunca contactos ni razones sociales)
    ProveedorFicha.findAll = async (opciones) => {
        consultas.push({ modelo: 'ProveedorFicha', opciones });
        if (fallarFichas) throw new Error('fichas caídas (prueba)');
        assert.deepEqual(opciones.attributes, ['proveedor_id', 'nombre_corto']);
        return fichas.filter((f) => opciones.where.proveedor_id[Op.in].includes(f.proveedor_id))
            .map((f) => ({ proveedor_id: f.proveedor_id, nombre_corto: f.nombre_corto }));
    };
    OrdenSeguimiento.fechasEstimadasJulia = async (ids) => {
        llamadasJulia.push([...ids].sort((a, b) => a - b));
        if (fallarJulia) throw new Error('orden_seguimiento caída (prueba)');
        return new Map([...fechasJulia].filter(([id]) => ids.includes(id)));
    };
    LlaveSistema.findOne = async () => null;
    LlaveSistema.create = async () => ({});
});

after(() => {
    ProduccionProyecto.findAll = originales.findAll;
    Configuracion.findOne = originales.cfg;
    sequelize.query = originales.query;
    Movimiento.findAll = originales.mov;
    DetalleMovimiento.findAll = originales.det;
    SolicitudCompra.findAll = originales.sol;
    OrdenCompra.findAll = originales.oc;
    LlaveSistema.findOne = originales.llFind;
    LlaveSistema.create = originales.llCreate;
    ProveedorFicha.findAll = originales.ficha;
    OrdenSeguimiento.fechasEstimadasJulia = originales.julia;
});

// ---------- Servidor de prueba (socket local) ----------
let numero = 0;
const servir = async (env, anotar = () => {}) => {
    const app = express();
    app.use(express.json());
    app.use(crearPuertas({ env, anotar }));
    const socket = path.join(os.tmpdir(), `puerta-produccion-${process.pid}-${++numero}.sock`);
    fs.rmSync(socket, { force: true });
    const servidor = http.createServer(app);
    await new Promise((r) => servidor.listen(socket, r));
    const pedir = (ruta, { llave = LLAVE, origen = 'operacion' } = {}) => new Promise((resolve, reject) => {
        const headers = {};
        if (llave) headers.Authorization = `Bearer ${llave}`;
        if (origen) headers['X-3G-Origen'] = origen;
        const req = http.request({ socketPath: socket, path: ruta, method: 'GET', headers }, (res) => {
            let texto = '';
            res.setEncoding('utf8');
            res.on('data', (c) => { texto += c; });
            res.on('end', () => resolve({ status: res.statusCode, texto, json: texto ? JSON.parse(texto) : null }));
        });
        req.on('error', reject);
        req.end();
    });
    const cerrar = () => new Promise((r) => servidor.close(() => { fs.rmSync(socket, { force: true }); r(); }));
    return { pedir, cerrar };
};

const RUTAS = ['/api/sistemas/v1/produccion/cerradas', '/api/sistemas/v1/produccion/estado?obras=3G-26-0101', '/api/sistemas/v1/produccion/en-curso'];
const respuestas = []; // todo lo que sale, para revisar al final que no haya datos personales ni importes

const conPuerta = async (fn, env = ENV_BUENO, anotar) => {
    const s = await servir(env, anotar);
    try {
        await fn(async (ruta, opciones) => { const r = await s.pedir(ruta, opciones); respuestas.push(r.texto); return r; });
    } finally {
        await s.cerrar();
    }
};

// ---------- La llave ----------

test('503 sin llaves: la puerta cerrada hace de bandera (también si solo hay llave de otro sistema)', async () => {
    proyectos = CERRADAS;
    await conPuerta(async (pedir) => {
        for (const ruta of RUTAS) assert.equal((await pedir(ruta)).status, 503, ruta);
    }, {});
    await conPuerta(async (pedir) => {
        const r = await pedir(RUTAS[0]);
        assert.equal(r.status, 503);
        assert.match(r.json.error, /operacion/);
    }, { LLAVE_ENTRANTE_FINANZAS_SHA256: huella('otra-llave-de-prueba-0011'), ALCANCES_FINANZAS: 'produccion.pronostico' });
});

test('401 con una llave que no es, sin llave o sin origen', async () => {
    await conPuerta(async (pedir) => {
        for (const ruta of RUTAS) assert.equal((await pedir(ruta, { llave: 'llave-equivocada-0000' })).status, 401, ruta);
        assert.equal((await pedir(RUTAS[0], { llave: null })).status, 401);
        assert.equal((await pedir(RUTAS[0], { origen: null })).status, 401);
    });
});

test('403 con la llave buena pero sin el alcance produccion.leer', async () => {
    await conPuerta(async (pedir) => {
        for (const ruta of RUTAS) {
            const r = await pedir(ruta);
            assert.equal(r.status, 403, ruta);
            assert.match(r.json.error, /produccion\.leer/);
        }
    }, { ...ENV_BUENO, ALCANCES_OPERACION: 'almacen.solicitar' });
});

test('el registro de cada petición no lleva la llave ni el contenido', async () => {
    proyectos = CERRADAS;
    const filas = [];
    await conPuerta(async (pedir) => {
        assert.equal((await pedir(RUTAS[0])).status, 200);
        assert.equal((await pedir(RUTAS[0], { llave: 'llave-equivocada-0000' })).status, 401);
    }, ENV_BUENO, (f) => filas.push(f));
    assert.equal(filas.length, 2);
    for (const f of filas) {
        assert.deepEqual(Object.keys(f).sort(), ['codigo', 'hora', 'ms', 'origen', 'ruta']);
        assert.equal(f.ruta, '/api/sistemas/v1/produccion/cerradas');
        assert.equal(f.origen, 'operacion');
        assert.ok(!JSON.stringify(f).includes(LLAVE));
    }
});

// ---------- /cerradas ----------

test('cerradas: últimos 7 días por omisión, en orden, sin canceladas, inactivas ni abiertas', async () => {
    proyectos = CERRADAS;
    foto = FOTO;
    await conPuerta(async (pedir) => {
        const r = await pedir('/api/sistemas/v1/produccion/cerradas');
        assert.equal(r.status, 200);
        assert.deepEqual(r.json.obras.map((o) => o.proyectoId), [8, 1, 2, 7]);
        assert.equal(r.json.hayMas, false);
        assert.equal(r.json.siguiente, null);
        assert.equal(r.json.desdeRecortado, false);
        assert.ok(Math.abs(new Date(r.json.desde).getTime() - (AHORA - 7 * 864e5)) < 60000);

        const [, lona, velaria, mto] = r.json.obras;
        assert.equal(lona.obraId, '3G-26-0101');
        assert.equal(lona.proyecto, 'LONA SOMBRA ESCOLAR');
        assert.equal(lona.cliente, 'ANA LÓPEZ ••• •••', 'teléfono con paréntesis y correo tapados');
        assert.equal(lona.etapa, 'instalacion');
        assert.equal(lona.entregada, false);
        assert.equal(lona.cerradaConSesion, true);
        assert.match(lona.cerradaEn, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-0[56]:00$/);
        assert.deepEqual(lona.fechaInstalacion, { fecha: '2026-11-03', fuente: 'calendario' });
        assert.equal(lona.fechaIndice, '2026-11-05');
        assert.deepEqual(lona.areas.pendientes, []);
        assert.equal(lona.areas.produccionCerrada, true);
        assert.equal(lona.areas.herreria.pintura, true);

        assert.equal(velaria.obraId, null);
        assert.equal(velaria.entregada, true);
        assert.equal(velaria.cerradaConSesion, false);
        assert.deepEqual(velaria.fechaInstalacion, { fecha: '2026-10-30', fuente: 'indice' });

        assert.equal(mto.tipo, 'MTO');
        assert.equal(mto.sinProduccion, true);
        assert.equal(mto.areas.sinPlanos, true);
        assert.deepEqual(mto.fechaInstalacion, { fecha: null, fuente: null });
    });
});

test('cerradas: el cursor recorre 120 obras en páginas de 50 sin repetir ni perder (también con la misma hora)', async () => {
    // Grupos de 3 obras que cerraron en el mismo milisegundo: el desempate es el id.
    proyectos = Array.from({ length: 130 }, (_, i) => base({
        id: 1000 + ((i * 37) % 130), // ids desordenados respecto a la hora
        nombre: `OBRA ${i}`,
        etapa_actual: i % 2 ? 'instalacion' : 'completado',
        instalacion_completado_en: new Date(AHORA - (6 * 864e5) + Math.floor(i / 3) * 60000 + 123),
        ...(i >= 120 ? { activo: false } : {})
    }));
    const esperado = ordenar(proyectos.filter((p) => p.activo), [['instalacion_completado_en', 'ASC'], ['id', 'ASC']]).map((p) => p.id);
    assert.equal(esperado.length, 120);
    await conPuerta(async (pedir) => {
        const vistos = [];
        let ruta = '/api/sistemas/v1/produccion/cerradas';
        const tamanos = [];
        for (let vuelta = 0; vuelta < 5; vuelta++) {
            const r = await pedir(ruta);
            assert.equal(r.status, 200);
            assert.ok(r.json.obras.length <= 50);
            tamanos.push(r.json.obras.length);
            vistos.push(...r.json.obras.map((o) => o.proyectoId));
            if (!r.json.hayMas) { assert.equal(r.json.siguiente, null); break; }
            assert.match(r.json.siguiente.desde, /\.\d{3}Z$/, 'el cursor lleva milésimas');
            ruta = `/api/sistemas/v1/produccion/cerradas?desde=${encodeURIComponent(r.json.siguiente.desde)}&despuesDe=${r.json.siguiente.despuesDe}`;
        }
        assert.deepEqual(tamanos, [50, 50, 20]);
        assert.deepEqual(vistos, esperado);
    });
    // Orden y corte al milisegundo (date_trunc), el mismo valor en los dos
    const q = consultas.filter((c) => c.modelo === 'ProduccionProyecto').at(-1).opciones;
    assert.equal(q.order[0][0].fn, 'date_trunc');
    assert.deepEqual(q.order[0][0].args.slice(0, 1), ['milliseconds']);
});

test('cerradas: horas con microsegundos (NOW() de SQL): orden y corte coinciden y el cursor no repite ni pierde', async () => {
    // Regresión de 2caa1a7. 48 obras en minutos distintos y 4 que cerraron en el MISMO milisegundo con distintos
    // microsegundos (los id al revés de los microsegundos). La página 1 corta a la mitad de ese milisegundo. Si orden o
    // corte usaran la columna sola (con microsegundos), la página 2 repetiría 2102 y 2103.
    const T = new Date(AHORA - 2 * 864e5);
    proyectos = [
        ...Array.from({ length: 48 }, (_, i) => base({
            id: 2000 + i, nombre: `OBRA ${i}`, etapa_actual: 'instalacion',
            instalacion_completado_en: new Date(T.getTime() - (48 - i) * 60000), instalacion_completado_en_us: 250
        })),
        ...[[2100, 900], [2101, 500], [2102, 100], [2103, 0]].map(([id, us]) => base({
            id, nombre: `MISMO MILISEGUNDO ${id}`, etapa_actual: 'completado', instalacion_completado_en: new Date(T), instalacion_completado_en_us: us
        }))
    ];
    await conPuerta(async (pedir) => {
        const a = await pedir('/api/sistemas/v1/produccion/cerradas');
        assert.equal(a.status, 200);
        assert.equal(a.json.obras.length, 50);
        assert.deepEqual(a.json.obras.slice(-2).map((o) => o.proyectoId), [2100, 2101], 'en el mismo milisegundo, por id');
        assert.deepEqual(a.json.siguiente, { desde: T.toISOString(), despuesDe: 2101 });
        const b = await pedir(`/api/sistemas/v1/produccion/cerradas?desde=${encodeURIComponent(a.json.siguiente.desde)}&despuesDe=2101`);
        assert.equal(b.status, 200);
        assert.deepEqual(b.json.obras.map((o) => o.proyectoId), [2102, 2103]);
        assert.equal(b.json.hayMas, false);
        const ids = [...a.json.obras, ...b.json.obras].map((o) => o.proyectoId);
        assert.equal(new Set(ids).size, 52, 'ni repetidas ni perdidas');
    });
});

test('cerradas: desde inválido, en el futuro, repetido o despuesDe suelto → 400', async () => {
    proyectos = CERRADAS;
    await conPuerta(async (pedir) => {
        const malos = [
            'desde=ayer', 'desde=2026-13-01', 'desde=2026-02-30', 'desde=2026-10-20T10:00:00', // sin zona
            `desde=${encodeURIComponent(new Date(AHORA + 3600e3).toISOString())}`,
            'desde=2026-10-20&desde=2026-10-21', 'despuesDe=12', `desde=${encodeURIComponent(horasAtras(5).toISOString())}&despuesDe=abc`,
            `desde=${encodeURIComponent(horasAtras(5).toISOString())}&despuesDe=-3`,
            // presentes pero vacíos: un cursor mal armado no vuelve a la primera página en silencio
            'desde=', 'desde=%20', `desde=${encodeURIComponent(horasAtras(5).toISOString())}&despuesDe=`
        ];
        for (const q of malos) {
            const r = await pedir(`/api/sistemas/v1/produccion/cerradas?${q}`);
            assert.equal(r.status, 400, q);
            assert.match(r.json.error, /desde|despuesDe/, q);
        }
    });
});

test('cerradas: más de 31 días atrás se recorta a 31; el «+» de la zona que llega como espacio se acepta', async () => {
    proyectos = CERRADAS;
    await conPuerta(async (pedir) => {
        const r = await pedir('/api/sistemas/v1/produccion/cerradas?desde=2020-01-01');
        assert.equal(r.status, 200);
        assert.equal(r.json.desdeRecortado, true);
        assert.ok(Math.abs(new Date(r.json.desde).getTime() - (AHORA - 31 * 864e5)) < 60000);
        assert.ok(!r.json.obras.some((o) => o.proyectoId === 9), 'la de hace 40 días no sale');
        assert.ok(r.json.obras.some((o) => o.proyectoId === 3), 'la de hace 10 días sí');

        const local = new Date(AHORA - 3 * 864e5).toISOString().slice(0, 19);
        const mas = await pedir(`/api/sistemas/v1/produccion/cerradas?desde=${local}+00:00`); // sin codificar: «+» → espacio
        assert.equal(mas.status, 200);
        assert.deepEqual(mas.json.obras.map((o) => o.proyectoId), [1, 2, 7]);
    });
});

// ---------- /estado ----------

test('estado: por ID 3G, con «cerrada» y las que no están', async () => {
    proyectos = [...CERRADAS, ...EN_CURSO];
    await conPuerta(async (pedir) => {
        const r = await pedir('/api/sistemas/v1/produccion/estado?obras=3G-26-0110,3g-26-0101,3G-26-9999,3G-26-0101,3G-26-0111');
        assert.equal(r.status, 200);
        assert.deepEqual(r.json.obras.map((o) => [o.obraId, o.cerrada, o.cancelada]), [
            ['3G-26-0110', false, false], ['3G-26-0101', true, false],
            ['3G-26-0111', false, true] // CANCELADO A en instalación: no cuenta como cerrada (/cerradas tampoco la da)
        ]);
        assert.deepEqual(r.json.noEncontradas, ['3G-26-9999']);
        assert.equal(r.json.obras[1].fechaInstalacion.fuente, 'calendario');
    });
});

test('estado: sin obras, con un ID mal escrito o con más de 50 → 400', async () => {
    proyectos = CERRADAS;
    await conPuerta(async (pedir) => {
        const muchas = Array.from({ length: 51 }, (_, i) => `3G-26-${String(i + 1).padStart(4, '0')}`).join(',');
        const vacios = ['obras=3G-26-0101,', 'obras=,3G-26-0101', 'obras=3G-26-0101,,3G-26-0102', 'obras=3G-26-0101,%20'];
        for (const q of ['', 'obras=', 'obras=OBRA-1', `obras=3G-26-0101,${encodeURIComponent('DROP TABLE')}`, `obras=${muchas}`, ...vacios]) {
            const r = await pedir(`/api/sistemas/v1/produccion/estado?${q}`);
            assert.equal(r.status, 400, q);
            assert.match(r.json.error, /obras|ID 3G/, q);
        }
        const tope = Array.from({ length: 50 }, (_, i) => `3G-26-${String(i + 1).padStart(4, '0')}`).join(',');
        assert.equal((await pedir(`/api/sistemas/v1/produccion/estado?obras=${tope}`)).status, 200);
    });
});

// ---------- /en-curso ----------

test('en-curso: el taller (producción o planos sin terminar) con sus áreas, observaciones y material', async () => {
    proyectos = EN_CURSO;
    foto = FOTO;
    // El motivo y la fecha los escribe la persona: llegan con teléfono, correo, dirección y montos y salen tapados.
    pronosticos = [{ id: 21, p: {
        respuesta: 'no', motivo: 'falta tela; llamar al (462) 555 0101 o a ana@empresa.mx, anticipo 8500',
        fechaPropuesta: 'cuando paguen el saldo 12,500 en Av. Siempre Viva 742', autor: 'Charly',
        preguntadoEn: new Date(AHORA).toISOString(), contestadoEn: new Date(AHORA).toISOString()
    } }];
    fallarTickets = false;
    // Con VENCIDAS_USA_JULIA apagada (por omisión) la fecha de Julia no se lee aunque exista
    delete process.env.VENCIDAS_USA_JULIA;
    fechasJulia = new Map([[501, sumarDias(HOY, 2)]]);
    llamadasJulia.length = 0;
    await conPuerta(async (pedir) => {
        const r = await pedir('/api/sistemas/v1/produccion/en-curso');
        assert.equal(r.status, 200);
        assert.equal(r.json.fecha, HOY);
        assert.deepEqual(r.json.obras.map((o) => o.proyectoId), [21, 22, 28, 29]);
        assert.equal(r.json.hayMas, false);
        assert.deepEqual(r.json.avisos, []);

        const toldo = r.json.obras[0];
        assert.equal(toldo.obraId, '3G-26-0201');
        assert.equal(toldo.prioridad, 1);
        assert.deepEqual(toldo.areas.pendientes, ['manufactura', 'herreria_pintado']);
        assert.deepEqual(toldo.areas.diseno, { lista: true });
        assert.deepEqual(toldo.areas.compras, { lista: true, enProceso: false });
        assert.equal(toldo.areas.herreria.soldadura, true);
        assert.equal(toldo.observaciones.produccion, 'Falta costura; llamar al •••, anticipo $•••');
        assert.equal(toldo.observaciones.compras, 'Pagaron ••• al proveedor');
        assert.equal(toldo.observaciones.diseno, 'Dueña: ••• tel •••; instalar en •••');
        assert.deepEqual(toldo.fechaInstalacion, { fecha: '2026-11-10', fuente: 'calendario' });
        assert.equal(toldo.pronostico.respuesta, 'no');
        assert.equal(toldo.pronostico.motivo, 'falta tela; llamar al ••• o a ••• anticipo •••');
        assert.equal(toldo.pronostico.fechaPropuesta, 'cuando paguen el saldo ••• en •••');
        assert.equal(toldo.pronostico.texto, 'Reagendar: falta tela; llamar al ••• o a ••• anticipo ••• · cuando paguen el saldo ••• en •••');
        assert.equal(toldo.pronostico.autor, undefined, 'sin el nombre de quien contestó');

        assert.deepEqual(toldo.material.tickets, [{ folio: 'T-0101', estado: 'pendiente', fecha: DIA_MX.format(horasAtras(30)), surtido: 50 }]);
        assert.deepEqual(toldo.material.ordenes, [{
            folio: 'OC-0501', estado: 'enviada', proveedor: 'Aceros Bajío', llegadaEstimada: AYER, vencida: true, // nombre corto de la ficha
            articulos: [{ nombre: 'Cable acero 1/4', cantidad: 12, unidad: 'metros' }]
        }]);
        assert.deepEqual(toldo.material.sinOrden, [{ nombre: 'Tensor 3/8', cantidad: 4, unidad: 'piezas' }]);

        const [, pergola, thelma, thelmaMto] = r.json.obras;
        assert.equal(pergola.etapa, 'diseno');
        assert.equal(pergola.observaciones.compras, 'Saldo ••• + iva; anticipo •••; ••• y •••; proveedor •••');
        assert.deepEqual(pergola.material, { tickets: [], ordenes: [], sinOrden: [] });
        assert.deepEqual(thelma.material.tickets.map((t) => t.folio), ['T-0103'], 'el de nombre idéntico gana');
        assert.equal(thelma.cliente, 'THELMA ••• •••');
        assert.deepEqual(thelmaMto.material.tickets.map((t) => t.folio), ['T-0102']);
        assert.deepEqual(thelmaMto.material.ordenes.map((o) => [o.folio, o.llegadaEstimada, o.vencida, o.proveedor]), [['OC-0503', null, false, null]]);

        assert.equal(r.json.material.hoy, HOY);
        assert.deepEqual(r.json.material.ordenes, [ // las de hoy primero
            { folio: 'OC-0504', estado: 'parcial', proveedor: null, llegadaEstimada: HOY, vencida: false, articulos: [], proyectos: [] },
            { folio: 'OC-0501', estado: 'enviada', proveedor: 'Aceros Bajío', llegadaEstimada: AYER, vencida: true,
                articulos: [{ nombre: 'Cable acero 1/4', cantidad: 12, recibida: 0, unidad: 'metros' }], proyectos: ['Toldo Restaurante / MTO'] }
        ]);
    });
    // Las consultas: por etapa (índice) y las órdenes del día solo en camino, sin recibir y hasta hoy
    const q = consultas.filter((c) => c.modelo === 'ProduccionProyecto').at(-1).opciones;
    assert.deepEqual(q.where.etapa_actual[Op.in], ['pendiente', 'diseno', 'compras', 'produccion']);
    assert.equal(q.limit, 51);
    const oc = consultas.filter((c) => c.modelo === 'OrdenCompra').at(-1).opciones;
    assert.deepEqual(oc.where.estado[Op.in], ['enviada', 'parcial']);
    assert.equal(oc.where.fecha_recepcion, null);
    assert.equal(oc.where.fecha_llegada_estimada[Op.lt].toISOString(), `${sumarDias(HOY, 1)}T00:00:00.000Z`);
    assert.equal(oc.limit, 50);
    assert.equal(llamadasJulia.length, 0, 'con la bandera apagada no se lee orden_seguimiento');
    assert.ok(!/llegadaDeJulia|llegadaOrden/.test(respuestas.at(-1)), 'apagada: la respuesta es la de siempre');
    fechasJulia = new Map();
    pronosticos = [];
});

test('en-curso: tope de 50, cursor por proyectoId y el material del día solo en la primera página', async () => {
    proyectos = Array.from({ length: 60 }, (_, i) => base({ id: 300 + i * 2, nombre: `TALLER ${i}`, etapa_actual: 'produccion' }));
    await conPuerta(async (pedir) => {
        const a = await pedir('/api/sistemas/v1/produccion/en-curso');
        assert.equal(a.status, 200);
        assert.equal(a.json.obras.length, 50);
        assert.equal(a.json.hayMas, true);
        assert.deepEqual(a.json.siguiente, { despuesDe: 398 });
        assert.ok(a.json.material);
        const b = await pedir(`/api/sistemas/v1/produccion/en-curso?despuesDe=${a.json.siguiente.despuesDe}`);
        assert.equal(b.status, 200);
        assert.equal(b.json.obras.length, 10);
        assert.equal(b.json.hayMas, false);
        assert.equal(b.json.siguiente, null);
        assert.equal(b.json.material, undefined);
        const ids = [...a.json.obras, ...b.json.obras].map((o) => o.proyectoId);
        assert.equal(new Set(ids).size, 60);
        for (const q of ['despuesDe=abc', 'despuesDe=0', 'despuesDe=1&despuesDe=2']) {
            const r = await pedir(`/api/sistemas/v1/produccion/en-curso?${q}`);
            assert.equal(r.status, 400, q);
            assert.match(r.json.error, /despuesDe/);
        }
    });
});

test('en-curso: cada ticket sale en una sola obra, la suya, aunque la parecida caiga en otra página o la suya ya no esté en el taller', async () => {
    // Página 1: 400 a 449; página 2: 450 a 499. Las obras parecidas quedan en páginas distintas.
    const taller = Array.from({ length: 100 }, (_, i) => base({ id: 400 + i, nombre: `TALLER ${i}`, etapa_actual: 'produccion' }));
    const nombrar = (id, datos) => { taller[id - 400] = base({ id, etapa_actual: 'produccion', ...datos }); };
    nombrar(428, { nombre: 'THELMA PADILLA' });
    nombrar(490, { nombre: 'THELMA PADILLA / MTO', tipo_proyecto: 'MTO', es_extensivo: true });
    nombrar(460, { nombre: 'LUIS GÓMEZ / MTO', tipo_proyecto: 'MTO', es_extensivo: true });
    nombrar(431, { nombre: 'TOLDO ESCUELA', obra: '3G-26-0431' });
    nombrar(440, { nombre: 'VELARIA JARDÍN' });
    nombrar(470, { nombre: 'Velaria Jardin' }); // homónima: mismo nombre normalizado
    proyectos = [
        ...taller,
        base({ id: 600, nombre: 'LUIS GÓMEZ', etapa_actual: 'instalacion', instalacion_completado_en: horasAtras(5) }), // ya salió del taller
        base({ id: 700, nombre: 'TOLDO ESCUELA', etapa_actual: 'completado', obra: '3G-26-0700' }) // entregada
    ];
    tickets = [
        { id: 902, ticket_id: 'T-0902', proyecto: 'THELMA PADILLA / MTO', estado: 'pendiente', fecha_hora: horasAtras(9), detalles: [] },
        { id: 903, ticket_id: 'T-0903', proyecto: 'thelma padilla', estado: 'aprobado', fecha_hora: horasAtras(8), detalles: [] },
        { id: 904, ticket_id: 'T-0904', proyecto: 'Luis Gomez', estado: 'pendiente', fecha_hora: horasAtras(7), detalles: [] },
        { id: 905, ticket_id: 'T-0905', proyecto: 'LUIS GÓMEZ / MTO', estado: 'pendiente', fecha_hora: horasAtras(6), detalles: [] },
        // Con ID 3G (EMPATE_POR_OBRA) el ID manda: aunque el nombre no empate, y aunque empate con otra obra
        { id: 906, ticket_id: 'T-0906', proyecto: 'Escuela, toldo nuevo', obra_id: '3G-26-0431', estado: 'pendiente', fecha_hora: horasAtras(5), detalles: [] },
        { id: 907, ticket_id: 'T-0907', proyecto: 'TOLDO ESCUELA', obra_id: '3G-26-0700', estado: 'pendiente', fecha_hora: horasAtras(4), detalles: [] },
        { id: 908, ticket_id: 'T-0908', proyecto: 'VELARIA JARDIN', estado: 'pendiente', fecha_hora: horasAtras(3), detalles: [] }
    ];
    solicitudes = [
        { id: 31, pedido_origen_id: 902, estado: 'pendiente', cantidad_solicitada: '6', articulo: { nombre: 'Lona PVC 650', unidad: 'metros' }, ordenCompra: null }
    ];
    try {
        await conPuerta(async (pedir) => {
            const a = await pedir('/api/sistemas/v1/produccion/en-curso');
            const b = await pedir('/api/sistemas/v1/produccion/en-curso?despuesDe=449');
            assert.equal(a.status, 200);
            assert.equal(b.status, 200);
            assert.deepEqual([a.json.obras.length, b.json.obras.length], [50, 50]);
            const obras = new Map([...a.json.obras, ...b.json.obras].map((o) => [o.proyectoId, o]));
            const folios = (id) => obras.get(id).material.tickets.map((t) => t.folio);

            assert.deepEqual(folios(428), ['T-0903'], 'en la página 1 no se cuela el de «THELMA PADILLA / MTO»');
            assert.deepEqual(obras.get(428).material.sinOrden, []);
            assert.deepEqual(folios(490), ['T-0902'], 'el de «/ MTO» va a su obra de la página 2');
            assert.deepEqual(obras.get(490).material.sinOrden, [{ nombre: 'Lona PVC 650', cantidad: 6, unidad: 'metros' }]);
            assert.deepEqual(folios(460), ['T-0905'], 'el de «LUIS GÓMEZ» es de la obra en instalación, no de la de MTO');
            assert.deepEqual(folios(431), ['T-0906'], 'por ID 3G; el de la obra entregada (otro ID) no cae aquí');
            assert.deepEqual([folios(440), folios(470)], [[], []], 'homónimas: el ticket no se le da a ninguna');
            for (const r of [a, b]) assert.deepEqual(r.json.avisos, ['1 ticket(s) abiertos empatan con más de una obra del mismo nombre: no se pusieron en ninguna.']);

            // Ningún ticket sale dos veces
            const todos = [...obras.values()].flatMap((o) => o.material.tickets.map((t) => t.folio));
            assert.deepEqual(todos.sort(), ['T-0902', 'T-0903', 'T-0905', 'T-0906']);
        });
    } finally {
        tickets = TICKETS;
        solicitudes = SOLICITUDES;
    }
});

test('duenoDelTicket: con todas las obras abiertas, la regla de mismosProyectos y el ID 3G primero', () => {
    const obras = [
        { id: 1, nombre: 'THELMA PADILLA', obra_id: null },
        { id: 2, nombre: 'THELMA PADILLA / MTO', obra_id: '3G-26-0002' },
        { id: 3, nombre: 'Casa Club - Gtia', obra_id: null },
        { id: 4, nombre: 'CASA CLUB', obra_id: null }
    ];
    const indice = P.indiceDeObras(obras);
    const de = (t) => P.duenoDelTicket(t, indice).obra?.id ?? null;
    assert.equal(de({ proyecto: 'Thelma Padilla' }), 1);
    assert.equal(de({ proyecto: 'THELMA PADILLA / MTO' }), 2);
    assert.equal(de({ proyecto: 'THELMA PADILLA-MTO' }), 1, 'como mismosProyectos: «PADILLA-MTO» no empata con «PADILLA / MTO»');
    assert.equal(de({ proyecto: 'THELMA PADILLA / MTO / 2' }), null, 'empata con 1 y 2 y no es idéntico a ninguna');
    assert.equal(de({ proyecto: 'casa club' }), 4);
    assert.equal(de({ proyecto: 'Casa Club - Gtia' }), 3);
    assert.equal(de({ proyecto: 'CASA CLUB / LONA' }), 4, 'la obra es prefijo del ticket');
    assert.equal(de({ proyecto: 'THELMA' }), null);
    assert.equal(de({ proyecto: null }), null);
    assert.equal(de({ proyecto: 'otro nombre', obra_id: '3G-26-0002' }), 2, 'el ID manda');
    assert.equal(de({ proyecto: 'THELMA PADILLA', obra_id: '3G-26-0999' }), null, 'con un ID que no está abierto, ninguna');
    // Debe dar lo mismo que comparar contra todas con mismosProyectos (la búsqueda por índice no pierde candidatas)
    const nombres = ['A', 'A / B', 'A/B', 'A - B', 'A-B', 'A B', 'A /B', 'A- B', 'AB', 'A / B / C', 'B', 'Á', ' a ', 'A -B'];
    const todas = nombres.map((nombre, i) => ({ id: i + 1, nombre, obra_id: null }));
    const idx = P.indiceDeObras(todas);
    const normal = (x) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    for (const t of nombres) {
        const candidatas = todas.filter((o) => mismosProyectos(t, o.nombre));
        const identicas = candidatas.filter((o) => normal(o.nombre) === normal(t));
        const esperado = candidatas.length < 2 ? candidatas[0]?.id ?? null : (identicas.length === 1 ? identicas[0].id : null);
        assert.equal(P.duenoDelTicket({ proyecto: t }, idx).obra?.id ?? null, esperado, t);
    }
});

test('en-curso: si los tickets no se pueden leer, las obras salen igual y «avisos» lo dice', async () => {
    proyectos = EN_CURSO;
    fallarTickets = true;
    const errores = console.error;
    console.error = () => {};
    try {
        await conPuerta(async (pedir) => {
            const r = await pedir('/api/sistemas/v1/produccion/en-curso');
            assert.equal(r.status, 200);
            assert.equal(r.json.obras.length, 4);
            assert.ok(r.json.obras.every((o) => o.material === null));
            assert.deepEqual(r.json.avisos, ['No se pudo leer los tickets abiertos.']);
        });
    } finally {
        console.error = errores;
        fallarTickets = false;
    }
});

// ---------- VENCIDAS_USA_JULIA y nombre corto del proveedor ----------

const enDias = (n) => new Date(`${sumarDias(HOY, n)}T00:00:00Z`); // como guarda la pantalla fecha_llegada_estimada
const orden = (id, estado, llegada, proveedor = null, extra = {}) => ({
    id, ticket_id: `OC-0${id}`, estado, fecha_llegada_estimada: llegada, fecha_recepcion: null, total_estimado: '4321.00', proveedor, detalles: [], ...extra
});
// Las órdenes de compra de las pruebas de la bandera. La 501 es la de la obra TOLDO (SOLICITUDES).
const ORDENES_JULIA = [
    orden(501, 'enviada', llegadaAyer, PROVEEDOR),                                    // Julia la recorre a pasado mañana
    orden(504, 'parcial', enDias(0), { id: 8, nombre: 'LONAS DE LEÓN SA DE CV' }),     // hoy, sin Julia; ficha sin nombre corto
    orden(505, 'enviada', null, { id: 9, nombre: 'TOLDOS DEL CENTRO' }),               // sin fecha propia: Julia dice ayer
    orden(506, 'enviada', enDias(-5), { id: 10, nombre: 'SIN FICHA SA' }),            // Julia dio una más vieja: manda la orden
    orden(507, 'enviada', enDias(1), PROVEEDOR),                                      // mañana: Julia nunca la adelanta
    orden(508, 'parcial', enDias(-3), PROVEEDOR),                                     // vencida que Julia recorrió a hoy
    orden(509, 'enviada', llegadaAyer, PROVEEDOR, { fecha_recepcion: horasAtras(1) }), // ya se recibió
    orden(510, 'borrador', llegadaAyer, PROVEEDOR)                                    // no está en camino
];
const JULIA = new Map([
    [501, sumarDias(HOY, 2)], [503, HOY], [505, AYER], [506, sumarDias(HOY, -10)], [507, HOY], [508, HOY], [509, AYER], [510, AYER]
]);
const resumen = (ordenes) => ordenes.map((o) => [o.folio, o.llegadaEstimada, o.vencida, o.llegadaDeJulia ?? false, 'llegadaOrden' in o ? o.llegadaOrden : '—', o.proveedor]);

const conBandera = async (valor, fn) => {
    const antes = process.env.VENCIDAS_USA_JULIA;
    if (valor === undefined) delete process.env.VENCIDAS_USA_JULIA; else process.env.VENCIDAS_USA_JULIA = valor;
    proyectos = EN_CURSO;
    ordenesCompra = ORDENES_JULIA;
    fechasJulia = JULIA;
    llamadasJulia.length = 0;
    try {
        await fn();
    } finally {
        if (antes === undefined) delete process.env.VENCIDAS_USA_JULIA; else process.env.VENCIDAS_USA_JULIA = antes;
        ordenesCompra = ORDENES_DEL_DIA;
        fechasJulia = new Map();
        fallarJulia = false;
        fallarFichas = false;
    }
};

test('en-curso con VENCIDAS_USA_JULIA: la llegada de Julia manda si es más nueva o si la orden no tiene (obras y material del día)', async () => {
    await conBandera('1', async () => {
        await conPuerta(async (pedir) => {
            const r = await pedir('/api/sistemas/v1/produccion/en-curso');
            assert.equal(r.status, 200);
            assert.deepEqual(r.json.avisos, []);
            const [toldo, , , thelmaMto] = r.json.obras;
            // La 501 venció ayer con su fecha, pero Julia la espera pasado mañana: ya no está vencida.
            assert.deepEqual(toldo.material.ordenes, [{
                folio: 'OC-0501', estado: 'enviada', proveedor: 'Aceros Bajío', llegadaEstimada: sumarDias(HOY, 2), vencida: false,
                llegadaDeJulia: true, llegadaOrden: AYER, articulos: [{ nombre: 'Cable acero 1/4', cantidad: 12, unidad: 'metros' }]
            }]);
            // La 503 (por aprobar) no tenía fecha: sale la de Julia
            assert.deepEqual(resumen(thelmaMto.material.ordenes), [['OC-0503', HOY, false, true, null, null]]);

            // Material del día: hoy (504 y 508, por id), luego ayer (505) y hace 5 días (506). Fuera: 501 (Julia la
            // recorrió), 507 (su fecha es mañana y Julia no la adelanta), 509 (recibida) y 510 (borrador).
            assert.deepEqual(resumen(r.json.material.ordenes), [
                ['OC-0504', HOY, false, false, '—', 'LONAS DE LEÓN SA DE CV'],
                ['OC-0508', HOY, false, true, sumarDias(HOY, -3), 'Aceros Bajío'],
                ['OC-0505', AYER, true, true, null, 'Toldos tel •••'],
                ['OC-0506', sumarDias(HOY, -5), true, false, '—', 'SIN FICHA SA']
            ]);
        });
        // Las candidatas del día: en camino, sin recibir, con fecha propia hasta hoy o sin fecha (tope 2 000, sin importes)
        const delDia = consultas.filter((c) => c.modelo === 'OrdenCompra' && c.opciones.raw).at(-1).opciones;
        assert.deepEqual(delDia.attributes, ['id', 'fecha_llegada_estimada']);
        assert.equal(delDia.limit, 2000);
        assert.deepEqual(delDia.order, [['fecha_llegada_estimada', 'DESC NULLS FIRST'], ['id', 'DESC']]);
        assert.deepEqual(llamadasJulia.map((ids) => ids.join(',')).sort(), ['501,503', '501,504,505,506,508']);
    });
});

test('en-curso con VENCIDAS_USA_JULIA: si orden_seguimiento o la ficha no se pueden leer, sale la de la orden y el nombre completo', async () => {
    const errores = console.error;
    console.error = () => {};
    try {
        await conBandera('sí', async () => {
            fallarJulia = true;
            fallarFichas = true;
            await conPuerta(async (pedir) => {
                const r = await pedir('/api/sistemas/v1/produccion/en-curso');
                assert.equal(r.status, 200);
                // Un solo aviso aunque se pidió dos veces (obras y material del día); la ficha no avisa: sale el nombre
                assert.deepEqual(r.json.avisos, ['No se pudo leer la fecha de llegada que dio Julia: sale la de la orden.']);
                assert.deepEqual(resumen(r.json.obras[0].material.ordenes), [['OC-0501', AYER, true, false, '—', 'ACEROS DEL BAJÍO SA DE CV']]);
                // Igual que con la bandera apagada: la 505 (sin fecha propia) no entra
                assert.deepEqual(resumen(r.json.material.ordenes), [
                    ['OC-0504', HOY, false, false, '—', 'LONAS DE LEÓN SA DE CV'],
                    ['OC-0501', AYER, true, false, '—', 'ACEROS DEL BAJÍO SA DE CV'],
                    ['OC-0508', sumarDias(HOY, -3), true, false, '—', 'ACEROS DEL BAJÍO SA DE CV'],
                    ['OC-0506', sumarDias(HOY, -5), true, false, '—', 'SIN FICHA SA']
                ]);
            });
        });
    } finally {
        console.error = errores;
    }
});

test('en-curso con VENCIDAS_USA_JULIA apagada (o «0»): no se lee a Julia y el material del día es el de siempre', async () => {
    for (const valor of [undefined, '0', 'no']) {
        await conBandera(valor, async () => {
            await conPuerta(async (pedir) => {
                const r = await pedir('/api/sistemas/v1/produccion/en-curso');
                assert.equal(r.status, 200);
                assert.deepEqual(r.json.avisos, []);
                assert.deepEqual(resumen(r.json.obras[0].material.ordenes), [['OC-0501', AYER, true, false, '—', 'Aceros Bajío']]);
                assert.deepEqual(resumen(r.json.material.ordenes), [
                    ['OC-0504', HOY, false, false, '—', 'LONAS DE LEÓN SA DE CV'],
                    ['OC-0501', AYER, true, false, '—', 'Aceros Bajío'],
                    ['OC-0508', sumarDias(HOY, -3), true, false, '—', 'Aceros Bajío'],
                    ['OC-0506', sumarDias(HOY, -5), true, false, '—', 'SIN FICHA SA']
                ]);
            });
            assert.equal(llamadasJulia.length, 0, `VENCIDAS_USA_JULIA=${valor}`);
        });
    }
});

test('504 si la base no contesta en 2.8 s (la puerta no se queda colgada)', async () => {
    proyectos = CERRADAS;
    lentoMs = 3100;
    const errores = console.error;
    console.error = () => {};
    try {
        await conPuerta(async (pedir) => {
            const t0 = Date.now();
            const r = await pedir('/api/sistemas/v1/produccion/cerradas');
            assert.equal(r.status, 504);
            assert.ok(Date.now() - t0 < 3050);
        });
    } finally {
        console.error = errores;
        lentoMs = 0;
        await new Promise((r) => setTimeout(r, 600)); // que la consulta lenta termine con los dobles puestos
    }
});

// ---------- Datos personales e importes ----------

test('nunca salen teléfonos, correos, direcciones, importes ni llaves (en ninguna respuesta de arriba)', async () => {
    // Una última ronda con todo junto, por si las pruebas se corren sueltas
    proyectos = [...CERRADAS, ...EN_CURSO];
    await conPuerta(async (pedir) => {
        for (const ruta of RUTAS) assert.equal((await pedir(ruta)).status, 200, ruta);
        assert.equal((await pedir('/api/sistemas/v1/produccion/estado?obras=3G-26-0201')).status, 200);
    });
    assert.ok(respuestas.length > 20);
    const todo = respuestas.join('\n');
    const soloDigitos = todo.replace(/[\s+().-]/g, '');
    for (const tel of ['4621234567', '4625550101', '4621239999']) assert.ok(!soloDigitos.includes(tel), `salió el teléfono ${tel}`);
    for (const importe of ['12,500', '12500', '3000.00', '1041.67', '999.00', '8500', '4,000']) assert.ok(!todo.includes(importe), `salió el importe ${importe}`);
    assert.ok(!/USD\s?300/i.test(todo), 'salió un importe en dólares');
    assert.ok(!todo.includes('@'), 'salió un correo');
    assert.ok(!/Siempre Viva|Col\. Centro/.test(todo), 'salió una dirección');
    // Los datos sembrados sí pasaron por las respuestas (si no, esta prueba no probaría nada)
    for (const sembrado of ['Dueña: ••• tel •••; instalar en •••', 'THELMA ••• •••', 'ANA LÓPEZ ••• •••', 'anticipo •••']) {
        assert.ok(todo.includes(sembrado), `no salió «${sembrado}»`);
    }
    assert.ok(!todo.includes(LLAVE) && !todo.includes(ENV_BUENO.LLAVE_ENTRANTE_OPERACION_SHA256), 'salió la llave o su huella');
    const claves = new Set();
    const juntar = (v) => { if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { claves.add(k); juntar(x); } };
    for (const t of respuestas) { try { juntar(JSON.parse(t)); } catch { /* no es JSON */ } }
    const prohibidas = [...claves].filter((k) => /telefono|celular|whats|correo|email|direccion|domicilio|total|monto|importe|costo|precio|subtotal|llave|token|huella|autor|password/i.test(k));
    assert.deepEqual(prohibidas, []);
});

// ---------- Funciones puras ----------

test('leerDesde: día solo = medianoche de México; ISO con zona; recorte y errores', () => {
    const ahora = new Date('2026-10-27T22:00:00Z');
    assert.equal(P.leerDesde({ desde: '2026-10-20' }, ahora).desde.toISOString(), '2026-10-20T06:00:00.000Z');
    assert.equal(P.leerDesde({ desde: '2026-10-25T10:00:00.123Z', despuesDe: '17' }, ahora).despuesDe, 17);
    assert.equal(P.leerDesde({}, ahora).desde.toISOString(), '2026-10-20T22:00:00.000Z');
    const r = P.leerDesde({ desde: '2026-08-01', despuesDe: '5' }, ahora);
    assert.equal(r.recortado, true);
    assert.equal(r.despuesDe, null, 'al recortar, el cursor viejo ya no aplica');
    assert.match(P.leerDesde({ desde: '2026-02-29' }, ahora).error, /válida/);
    assert.match(P.leerDesde({ desde: '2026-10-28T10:00:00Z' }, ahora).error, /futuro/);
});

test('sinDatos: teléfonos y montos fuera; fechas, medidas y folios se quedan', () => {
    assert.equal(P.sinDatos('Llamar a Juan 462-123-45-67 o +52 1 462 555 0101'), 'Llamar a Juan ••• o •••');
    assert.equal(P.sinDatos('Anticipo $ 3,000.00 y 1500 MXN, resto 2,000 pesos'), 'Anticipo $••• y •••, resto •••');
    assert.equal(P.sinDatos('Entrega 2026-11-03, lona de 12.5 m, 3 piezas, OC-0501'), 'Entrega 2026-11-03, lona de 12.5 m, 3 piezas, OC-0501');
    // Los que pasaban sin tapar (revisión del 27-oct)
    const tapados = {
        '(462) 123 4567': '•••',
        '462.123.4567': '•••',
        'tel: +52 (462) 123-4567': 'tel: •••',
        'ana@empresa.mx': '•••',
        'Av. Siempre Viva 742 Col. Centro': '•••',
        'Instalar en Blvd. Campestre 2005, Col. Jardines del Moral': 'Instalar en •••',
        'Calle 5 de Mayo #120 int. 3, León': '•••, León',
        'C.P. 37160': '•••',
        'anticipo 8500': 'anticipo •••',
        'pagó 8,500.00 el lunes': 'pagó ••• el lunes',
        '8500 de anticipo': '••• de anticipo',
        'MXN 4,000': '•••',
        'USD 300': '•••',
        'se pagaron 300 dlls': 'se pagaron •••',
        'saldo 12,500 + iva': 'saldo ••• + iva',
        'costo 1200 + 16% iva': 'costo ••• + 16% iva'
    };
    for (const [antes, despues] of Object.entries(tapados)) assert.equal(P.sinDatos(antes), despues, antes);
    // Fechas, folios, cantidades chicas y nombres se quedan
    for (const igual of ['pago el 2026-11-03', 'pago OC-0501', 'total 3 piezas', '1500 metros en total', 'THELMA PADILLA / MTO', 'Cable acero 1/4', 'Lona PVC 650']) {
        assert.equal(P.sinDatos(igual), igual, igual);
    }
    assert.equal(P.sinDatos('   '), null);
    assert.equal(P.sinDatos('x'.repeat(500)).length, 400);
});

test('fechaDeObra: la foto manda; igual al Índice cuenta como Índice; sin foto, el Índice', () => {
    const foto = new Map([[1, '2026-11-03'], [2, '2026-10-30'], [3, null]]);
    assert.deepEqual(P.fechaDeObra({ id: 1, fecha_limite: '2026-11-05' }, foto), { fecha: '2026-11-03', fuente: 'calendario' });
    assert.deepEqual(P.fechaDeObra({ id: 2, fecha_limite: '2026-10-30' }, foto), { fecha: '2026-10-30', fuente: 'indice' });
    assert.deepEqual(P.fechaDeObra({ id: 3, fecha_limite: '2026-12-01' }, foto), { fecha: '2026-12-01', fuente: 'indice' });
    assert.deepEqual(P.fechaDeObra({ id: 4, fecha_limite: null }, foto), { fecha: null, fuente: null });
    assert.equal(P.leerFoto('no es json').size, 0);
});

test('llegadaDeOrden: el criterio del aviso de vencidas (fechaLlegadaEfectiva), comparado por día', () => {
    const oc = (id, dia) => ({ id, fecha_llegada_estimada: dia ? new Date(`${dia}T00:00:00Z`) : null });
    const julia = new Map([[1, '2026-11-05'], [2, '2026-10-20'], [3, '2026-10-30'], [5, 'la otra semana'], [6, '2026-10-30']]);
    assert.deepEqual(P.llegadaDeOrden(oc(1, '2026-10-30'), julia), { llegada: '2026-11-05', deJulia: true, deOrden: '2026-10-30' }, 'más nueva: manda Julia');
    assert.deepEqual(P.llegadaDeOrden(oc(2, '2026-10-30'), julia), { llegada: '2026-10-30', deJulia: false, deOrden: '2026-10-30' }, 'más vieja: la orden');
    assert.deepEqual(P.llegadaDeOrden(oc(3, null), julia), { llegada: '2026-10-30', deJulia: true, deOrden: null }, 'la orden sin fecha: Julia');
    assert.deepEqual(P.llegadaDeOrden(oc(4, '2026-10-30'), julia), { llegada: '2026-10-30', deJulia: false, deOrden: '2026-10-30' }, 'sin Julia');
    assert.deepEqual(P.llegadaDeOrden(oc(5, null), julia), { llegada: null, deJulia: false, deOrden: null }, 'la de Julia ilegible no cuenta');
    // El mismo día no es «más nueva»: la orden (así no depende de la zona del servidor, como sí pasa con Date local)
    assert.deepEqual(P.llegadaDeOrden(oc(6, '2026-10-30'), julia), { llegada: '2026-10-30', deJulia: false, deOrden: '2026-10-30' });
    assert.deepEqual(P.llegadaDeOrden(oc(1, '2026-10-30')), { llegada: '2026-10-30', deJulia: false, deOrden: '2026-10-30' }, 'sin mapa (bandera apagada)');
    // Con días distintos, decide lo mismo que fechaLlegadaEfectiva de cronJobs.js
    for (const deOrden of [null, '2026-10-01', '2026-10-30', '2026-12-31']) {
        for (const deJulia of [undefined, '2026-09-30', '2026-10-02', '2026-10-31', '2027-01-01']) {
            const nuestra = P.llegadaDeOrden(oc(9, deOrden), new Map(deJulia ? [[9, deJulia]] : []));
            const delAviso = fechaLlegadaEfectiva(deOrden ? new Date(`${deOrden}T00:00:00Z`) : null, deJulia);
            assert.equal(nuestra.deJulia, delAviso?.deJulia ?? false, `${deOrden} / ${deJulia}`);
            assert.equal(nuestra.llegada === null, delAviso === null, `${deOrden} / ${deJulia}`);
        }
    }
});

test('esperadasHasta: las que se esperan hasta hoy con la fecha que manda, hoy primero y luego las vencidas más recientes', () => {
    const oc = (id, dia) => ({ id, fecha_llegada_estimada: dia ? new Date(`${dia}T00:00:00Z`) : null });
    const hoy = '2026-10-27';
    const candidatas = [oc(1, '2026-10-20'), oc(2, null), oc(3, '2026-10-27'), oc(4, '2026-10-26'), oc(5, null), oc(6, '2026-10-25'), oc(7, '2026-10-27')];
    const julia = new Map([[1, '2026-10-26'], [2, '2026-10-27'], [4, '2026-11-02'], [6, '2026-10-01']]);
    // 2 y 3 y 7 hoy (por id), 1 ayer por Julia, 6 con la suya; fuera la 4 (Julia la recorrió) y la 5 (sin fecha)
    assert.deepEqual(P.esperadasHasta(candidatas, julia, hoy), [2, 3, 7, 1, 6]);
    assert.deepEqual(P.esperadasHasta(candidatas, new Map(), hoy), [3, 7, 4, 6, 1], 'sin Julia, como la consulta de siempre');
    const muchas = Array.from({ length: 80 }, (_, i) => oc(i + 1, '2026-10-27'));
    assert.deepEqual(P.esperadasHasta(muchas, new Map(), hoy), Array.from({ length: 50 }, (_, i) => i + 1), 'tope de 50');
});

test('nombreProveedor: el nombre corto de la ficha si lo tiene; si no, el completo; siempre por sinDatos', () => {
    const cortos = new Map([[7, 'Aceros Bajío'], [8, '   '], [9, 'Toldos tel 462 555 0101']]);
    assert.equal(P.nombreProveedor({ id: 7, nombre: 'ACEROS DEL BAJÍO SA DE CV' }, cortos), 'Aceros Bajío');
    assert.equal(P.nombreProveedor({ id: 8, nombre: 'LONAS DE LEÓN SA DE CV' }, cortos), 'LONAS DE LEÓN SA DE CV', 'nombre corto en blanco');
    assert.equal(P.nombreProveedor({ id: 9, nombre: 'TOLDOS' }, cortos), 'Toldos tel •••');
    assert.equal(P.nombreProveedor({ id: 10, nombre: 'SIN FICHA ventas@sin.example' }, cortos), 'SIN FICHA •••');
    assert.equal(P.nombreProveedor({ id: 7, nombre: 'ACEROS DEL BAJÍO SA DE CV' }), 'ACEROS DEL BAJÍO SA DE CV', 'sin fichas leídas');
    assert.equal(P.nombreProveedor(null, cortos), null);
});
