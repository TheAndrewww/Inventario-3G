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
const { crearPuertas } = await import('../src/routes/sistemas/index.js');
const P = await import('../src/routes/sistemas/produccion.js');

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
    base({ id: 1, nombre: 'LONA SOMBRA ESCOLAR', cliente: 'ANA LÓPEZ 462 123 4567', etapa_actual: 'instalacion', instalacion_completado_en: horasAtras(48),
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
    base({ id: 10, nombre: 'DESCERRADA', etapa_actual: 'produccion', obra: '3G-26-0110' })
];

const EN_CURSO = [
    base({ id: 21, nombre: 'TOLDO RESTAURANTE', etapa_actual: 'produccion', prioridad: 1, tiene_manufactura: true, tiene_herreria: true,
        herreria_armado_completado: true, diseno_completado_en: horasAtras(300), compras_completado_en: horasAtras(200),
        observaciones_produccion: 'Falta costura; llamar al 4621234567, anticipo $12,500', observaciones_compras: 'Pagaron 8500 pesos al proveedor',
        fecha_limite: '2026-11-12', obra: '3G-26-0201' }),
    base({ id: 22, nombre: 'PÉRGOLA CASA CLUB', etapa_actual: 'diseno', tiene_manufactura: true }),
    base({ id: 23, nombre: 'EN COMPRAS SIN PLANOS', etapa_actual: 'compras' }),
    base({ id: 24, nombre: 'YA CERRADA', etapa_actual: 'instalacion', instalacion_completado_en: horasAtras(5), tiene_manufactura: true, manufactura_completado: true }),
    base({ id: 25, nombre: 'CANCELADA EN TALLER', tipo_proyecto: 'CANCELADO', etapa_actual: 'produccion' }),
    base({ id: 26, nombre: 'INACTIVA EN TALLER', activo: false, etapa_actual: 'produccion' }),
    base({ id: 27, nombre: 'HERRERÍA LISTA EN DISEÑO', etapa_actual: 'diseno', tiene_herreria: true, herreria_completado: true }),
    base({ id: 28, nombre: 'THELMA PADILLA', etapa_actual: 'produccion' }),
    base({ id: 29, nombre: 'THELMA PADILLA / MTO', etapa_actual: 'produccion', tipo_proyecto: 'MTO', es_extensivo: true })
];

const FOTO = { 1: '2026-11-03', 2: null, 21: '2026-11-10', 22: null };

const PROVEEDOR = { nombre: 'ACEROS DEL BAJÍO SA DE CV', nombre_corto: 'ACEROS', telefono: '4625550101', email: 'ventas@aceros.example', direccion: 'Av. Siempre Viva 742' };
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

// ---------- Evaluador pequeño de los filtros de Sequelize que usa la puerta ----------
const tiempo = (v) => (v instanceof Date ? v.getTime() : v);
const condicion = (valor, cond) => {
    if (cond === null) return valor === null || valor === undefined;
    if (cond instanceof Date) return valor instanceof Date && valor.getTime() === cond.getTime();
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
// sequelize.where(sequelize.fn('date_trunc', 'milliseconds', sequelize.col(x)), …): los Date de la prueba ya van al
// milisegundo, así que basta con la columna.
const campoDe = (attr) => (typeof attr === 'string' ? attr : attr?.col ?? attr?.args?.find((a) => a?.col)?.col);
const cumple = (fila, where = {}) => {
    if (where?.constructor?.name === 'Where') return condicion(fila[campoDe(where.attribute)], where.logic);
    return Reflect.ownKeys(where).every((k) => {
        if (k === Op.or) return where[k].some((w) => cumple(fila, w));
        if (k === Op.and) return where[k].every((w) => cumple(fila, w));
        return condicion(fila[k], where[k]);
    });
};
const ordenar = (filas, order = []) => [...filas].sort((a, b) => {
    for (const [columna, dir] of order) {
        const campo = campoDe(columna);
        const x = tiempo(a[campo]);
        const y = tiempo(b[campo]);
        if (x === y) continue;
        if (x === null || x === undefined) return 1;
        if (y === null || y === undefined) return -1;
        return (x < y ? -1 : 1) * (dir === 'DESC' ? -1 : 1);
    }
    return 0;
});

// ---------- Dobles ----------
let proyectos = [];
let foto = FOTO;
let pronosticos = [];
let lentoMs = 0;
let fallarTickets = false;
const consultas = [];
const originales = {
    findAll: ProduccionProyecto.findAll, cfg: Configuracion.findOne, query: sequelize.query, mov: Movimiento.findAll, det: DetalleMovimiento.findAll,
    sol: SolicitudCompra.findAll, oc: OrdenCompra.findAll, llFind: LlaveSistema.findOne, llCreate: LlaveSistema.create
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
        return TICKETS.filter((t) => t.estado === 'pendiente' || t.estado === 'aprobado').map(({ detalles, ...t }) => t);
    };
    // Renglones de los tickets: total y surtidos por ticket (lo que da el GROUP BY)
    DetalleMovimiento.findAll = async ({ where }) => TICKETS.filter((t) => where.movimiento_id[Op.in].includes(t.id) && t.detalles.length)
        .map((t) => ({ movimiento_id: t.id, total: String(t.detalles.length), surtidos: String(t.detalles.filter((d) => d.dispersado).length) }));
    SolicitudCompra.findAll = async ({ where }) => {
        if (where.pedido_origen_id) return SOLICITUDES.filter((s) => where.pedido_origen_id[Op.in].includes(s.pedido_origen_id));
        if (where.orden_compra_id) return [{ orden_compra_id: 501, pedidoOrigen: { proyecto: 'Toldo Restaurante / MTO' } }, { orden_compra_id: 501, pedidoOrigen: { proyecto: 'Toldo Restaurante / MTO' } }];
        throw new Error('solicitudes: filtro inesperado');
    };
    OrdenCompra.findAll = async (opciones) => { consultas.push({ modelo: 'OrdenCompra', opciones }); return ordenar(ORDENES_DEL_DIA, opciones.order); };
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
        assert.equal(lona.cliente, 'ANA LÓPEZ •••');
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

test('cerradas: desde inválido, en el futuro, repetido o despuesDe suelto → 400', async () => {
    proyectos = CERRADAS;
    await conPuerta(async (pedir) => {
        const malos = [
            'desde=ayer', 'desde=2026-13-01', 'desde=2026-02-30', 'desde=2026-10-20T10:00:00', // sin zona
            `desde=${encodeURIComponent(new Date(AHORA + 3600e3).toISOString())}`,
            'desde=2026-10-20&desde=2026-10-21', 'despuesDe=12', `desde=${encodeURIComponent(horasAtras(5).toISOString())}&despuesDe=abc`,
            `desde=${encodeURIComponent(horasAtras(5).toISOString())}&despuesDe=-3`
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
        const r = await pedir('/api/sistemas/v1/produccion/estado?obras=3G-26-0110,3g-26-0101,3G-26-9999,3G-26-0101');
        assert.equal(r.status, 200);
        assert.deepEqual(r.json.obras.map((o) => [o.obraId, o.cerrada]), [['3G-26-0110', false], ['3G-26-0101', true]]);
        assert.deepEqual(r.json.noEncontradas, ['3G-26-9999']);
        assert.equal(r.json.obras[1].fechaInstalacion.fuente, 'calendario');
    });
});

test('estado: sin obras, con un ID mal escrito o con más de 50 → 400', async () => {
    proyectos = CERRADAS;
    await conPuerta(async (pedir) => {
        const muchas = Array.from({ length: 51 }, (_, i) => `3G-26-${String(i + 1).padStart(4, '0')}`).join(',');
        for (const q of ['', 'obras=', 'obras=OBRA-1', `obras=3G-26-0101,${encodeURIComponent('DROP TABLE')}`, `obras=${muchas}`]) {
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
    pronosticos = [{ id: 21, p: { respuesta: 'no', motivo: 'falta tela', fechaPropuesta: '2026-11-12', autor: 'Charly', preguntadoEn: new Date(AHORA).toISOString(), contestadoEn: new Date(AHORA).toISOString() } }];
    fallarTickets = false;
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
        assert.equal(toldo.observaciones.diseno, null);
        assert.deepEqual(toldo.fechaInstalacion, { fecha: '2026-11-10', fuente: 'calendario' });
        assert.equal(toldo.pronostico.respuesta, 'no');
        assert.equal(toldo.pronostico.autor, undefined, 'sin el nombre de quien contestó');

        assert.deepEqual(toldo.material.tickets, [{ folio: 'T-0101', estado: 'pendiente', fecha: DIA_MX.format(horasAtras(30)), surtido: 50 }]);
        assert.deepEqual(toldo.material.ordenes, [{
            folio: 'OC-0501', estado: 'enviada', proveedor: 'ACEROS DEL BAJÍO SA DE CV', llegadaEstimada: AYER, vencida: true,
            articulos: [{ nombre: 'Cable acero 1/4', cantidad: 12, unidad: 'metros' }]
        }]);
        assert.deepEqual(toldo.material.sinOrden, [{ nombre: 'Tensor 3/8', cantidad: 4, unidad: 'piezas' }]);

        const [, pergola, thelma, thelmaMto] = r.json.obras;
        assert.equal(pergola.etapa, 'diseno');
        assert.deepEqual(pergola.material, { tickets: [], ordenes: [], sinOrden: [] });
        assert.deepEqual(thelma.material.tickets.map((t) => t.folio), ['T-0103'], 'el de nombre idéntico gana');
        assert.deepEqual(thelmaMto.material.tickets.map((t) => t.folio), ['T-0102']);
        assert.deepEqual(thelmaMto.material.ordenes.map((o) => [o.folio, o.llegadaEstimada, o.vencida, o.proveedor]), [['OC-0503', null, false, null]]);

        assert.equal(r.json.material.hoy, HOY);
        assert.deepEqual(r.json.material.ordenes, [ // las de hoy primero
            { folio: 'OC-0504', estado: 'parcial', proveedor: null, llegadaEstimada: HOY, vencida: false, articulos: [], proyectos: [] },
            { folio: 'OC-0501', estado: 'enviada', proveedor: 'ACEROS DEL BAJÍO SA DE CV', llegadaEstimada: AYER, vencida: true,
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
    const soloDigitos = todo.replace(/[\s+-]/g, '');
    for (const tel of ['4621234567', '4625550101']) assert.ok(!soloDigitos.includes(tel), `salió el teléfono ${tel}`);
    for (const importe of ['12,500', '12500', '3000.00', '1041.67', '999.00', '8500']) assert.ok(!todo.includes(importe), `salió el importe ${importe}`);
    assert.ok(!todo.includes('@'), 'salió un correo');
    assert.ok(!/Siempre Viva/.test(todo), 'salió una dirección');
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
