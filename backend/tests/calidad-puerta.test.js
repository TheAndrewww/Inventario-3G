/**
 * La puerta de producción con calidad (pareja #20, Operación → Planta):
 *   - Con PANEL_CALIDAD apagada: las obras de /cerradas, /estado y /en-curso salen sin el campo `calidad` (como hoy) y
 *     POST /api/sistemas/v1/calidad/sugerencias responde 404 como cualquier puerta que no existe.
 *   - Encendida: `calidad` en cada obra (sin teléfonos ni montos en las notas) y las sugerencias se guardan con
 *     Idempotency-Key y el alcance «calidad.sugerir»; la misma llamada no se duplica.
 *
 * Arma las puertas con crearPuertas() y una llave inventada; la base se cambia por dobles en memoria (proyectos, ID 3G,
 * idempotencia, llaves) y el repositorio de calidad es el de tests/_calidadMemoria.js. Socket local, sin red.
 * Correr:  cd backend && npm test
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

for (const m of ['log', 'info', 'debug', 'warn']) console[m] = () => {};
process.env.DATABASE_URL = 'postgres://prueba:prueba@127.0.0.1:9/prueba_sin_base';
process.env.WHATSAPP_PUENTE_TOKEN = '';

const express = (await import('express')).default;
const { sequelize } = await import('../src/config/database.js');
const { ProduccionProyecto, Configuracion, Movimiento } = await import('../src/models/index.js');
const { default: LlaveSistema } = await import('../src/models/LlaveSistema.js');
const { default: Idempotencia } = await import('../src/models/Idempotencia.js');
const { crearPuertas } = await import('../src/routes/sistemas/index.js');
const S = await import('../src/services/calidad.service.js');
const { crearRepoMemoria } = await import('./_calidadMemoria.js');
const { servir } = await import('./_servidorPrueba.js');

const LLAVE = 'llave-operacion-de-prueba-calidad-no-es-real';
const huella = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');
const ENV = { LLAVE_ENTRANTE_OPERACION_SHA256: huella(LLAVE), ALCANCES_OPERACION: 'almacen.solicitar,produccion.leer,calidad.sugerir' };
const ENV_SIN_ALCANCE = { LLAVE_ENTRANTE_OPERACION_SHA256: huella(LLAVE), ALCANCES_OPERACION: 'almacen.solicitar,produccion.leer' };

const BANDERAS = ['PANEL_CALIDAD', 'CALIDAD_AVAL_CIERRA', 'CALIDAD_DEFECTO_REABRE'];
const guardadas = Object.fromEntries(BANDERAS.map((n) => [n, process.env[n]]));
const banderas = (b = {}) => {
    for (const n of BANDERAS) delete process.env[n];
    for (const [n, v] of Object.entries(b)) process.env[n] = v;
};
const originales = {
    findAll: ProduccionProyecto.findAll, pron: ProduccionProyecto.pronosticosVigentes, cfg: Configuracion.findOne, query: sequelize.query,
    mov: Movimiento.findAll, llFind: LlaveSistema.findOne, llCreate: LlaveSistema.create,
    idFind: Idempotencia.findOne, idCreate: Idempotencia.create, idDestroy: Idempotencia.destroy
};

let repo;
let s;
let idem;
beforeEach(() => {
    repo = crearRepoMemoria(ProduccionProyecto);
    S.usarRepoCalidad(repo);
    const hace = (h) => new Date(Date.now() - h * 3600000);
    repo.agregarProyecto({ id: 1, nombre: 'VELARIA COLEGIO', cliente: 'Colegio', etapa_actual: 'instalacion', instalacion_completado_en: hace(5), tipo_proyecto: 'A', fecha_limite: '2026-11-05' }, '3G-26-0101');
    repo.agregarProyecto({ id: 2, nombre: 'TOLDO SIN HOJA', etapa_actual: 'instalacion', instalacion_completado_en: hace(3), tipo_proyecto: 'B' }, '3G-26-0102');
    repo.agregarProyecto({ id: 3, nombre: 'EN TALLER', etapa_actual: 'produccion', tipo_proyecto: 'A' }, '3G-26-0103');
    ProduccionProyecto.findAll = async ({ where } = {}) => {
        // Lo justo para estas pruebas: /cerradas y /estado piden las cerradas; /en-curso las de producción
        const etapas = where?.etapa_actual?.[Object.getOwnPropertySymbols(where.etapa_actual)[0]];
        return [...repo._proyectos.values()].filter((p) => !etapas || etapas.includes(p.etapa_actual));
    };
    ProduccionProyecto.pronosticosVigentes = async () => new Map();
    Configuracion.findOne = async () => null;
    Movimiento.findAll = async () => [];
    sequelize.query = async (sql, { replacements = {} } = {}) => {
        if (/SELECT id, obra_id FROM produccion_proyectos WHERE id IN/.test(sql)) {
            return [replacements.ids.filter((i) => repo._obraIds.has(i)).map((i) => ({ id: i, obra_id: repo._obraIds.get(i) }))];
        }
        if (/WHERE obra_id IN \(:obras\)/.test(sql)) {
            return [[...repo._obraIds].filter(([, o]) => replacements.obras.includes(o)).map(([id, obra_id]) => ({ id, obra_id }))];
        }
        return [[]];
    };
    LlaveSistema.findOne = async () => null;
    LlaveSistema.create = async () => ({});
    idem = [];
    Idempotencia.findOne = async ({ where }) => idem.find((r) => r.origen === where.origen && r.clave === where.clave && r.ruta === where.ruta) || null;
    Idempotencia.create = async (d) => {
        const r = { ...d, update: async (c) => Object.assign(r, c), destroy: async () => { idem.splice(idem.indexOf(r), 1); } };
        idem.push(r);
        return r;
    };
    Idempotencia.destroy = async () => 0;
});
afterEach(async () => {
    if (s) await s.cerrar();
    s = null;
    S.usarRepoCalidad(null);
    ProduccionProyecto.findAll = originales.findAll;
    ProduccionProyecto.pronosticosVigentes = originales.pron;
    Configuracion.findOne = originales.cfg;
    sequelize.query = originales.query;
    Movimiento.findAll = originales.mov;
    LlaveSistema.findOne = originales.llFind;
    LlaveSistema.create = originales.llCreate;
    Idempotencia.findOne = originales.idFind;
    Idempotencia.create = originales.idCreate;
    Idempotencia.destroy = originales.idDestroy;
    for (const n of BANDERAS) { if (guardadas[n] === undefined) delete process.env[n]; else process.env[n] = guardadas[n]; }
});

const puerta = async (env = ENV) => {
    const app = express();
    app.use(express.json());
    app.use(crearPuertas({ env, anotar: () => {} }));
    s = await servir(app, 'calidad-puerta');
};
const conLlave = (extra = {}) => ({ headers: { Authorization: `Bearer ${LLAVE}`, 'X-3G-Origen': 'operacion', ...extra } });
const RUTAS = ['/api/sistemas/v1/produccion/cerradas', '/api/sistemas/v1/produccion/estado?obras=3G-26-0101,3G-26-0102', '/api/sistemas/v1/produccion/en-curso'];

const llenarHoja = async () => {
    const ctx = { repo, quien: 'Tableta', origen: 'tableta', encolarReporte: () => {}, avisar: async () => {} };
    await S.cambiarAtributos(1, { atributos: { lleva_membrana: true, lleva_estructura: false, acabado_estructura: 'ninguno' } }, ctx);
    const v = await S.vistaObra(1, { repo });
    for (const p of v.hojas[0].puntos) await S.marcarPunto(1, p.id, { estado: 'ok' }, ctx);
    await S.marcarPunto(1, 'M2', { estado: 'defecto', nota: 'Más corta 5 cm; avisar al 462 555 0104; costo $3,500', saleAsi: true }, ctx);
    await S.avalar(1, { nombre: 'Charly', observacionesInstalacion: 'Llevar tensor extra. Contacto obra@colegio.example' }, { ...ctx, ahora: new Date('2026-10-28T17:00:00Z') });
};

test('apagada: /cerradas, /estado y /en-curso salen como hoy (sin `calidad`) y las sugerencias son 404', async () => {
    banderas({});
    await llenarHoja();
    await puerta();
    for (const ruta of RUTAS) {
        const r = await s.pedir('GET', ruta, conLlave());
        assert.equal(r.status, 200, `${ruta}: ${r.texto}`);
        assert.ok(r.json.obras.length > 0, ruta);
        for (const o of r.json.obras) assert.equal('calidad' in o, false, `${ruta} · ${o.proyecto}`);
    }
    const p = await s.pedir('POST', '/api/sistemas/v1/calidad/sugerencias', { ...conLlave({ 'Idempotency-Key': 'llamada-1' }), cuerpo: { sugerencias: [{ obraId: '3G-26-0101', punto: 'M1', estado: 'ok' }] } });
    assert.equal(p.status, 404);
    assert.deepEqual(p.json, { error: 'No existe esa puerta en Planta.' });
    assert.equal(repo._sugerencias.length, 0);
});

test('encendida: cada obra trae `calidad` (avalada, sin hoja o en taller) sin teléfonos, correos ni montos', async () => {
    banderas({ PANEL_CALIDAD: '1' });
    await llenarHoja();
    await puerta();
    const cerradas = await s.pedir('GET', RUTAS[0], conLlave());
    const c1 = cerradas.json.obras.find((o) => o.obraId === '3G-26-0101').calidad;
    assert.equal(c1.estado, 'avalada');
    assert.equal(c1.avaladaPor, 'Charly');
    assert.match(c1.avaladaEn, /^2026-10-28T11:00:00-06:00$/, 'ISO de México como el resto de la puerta');
    assert.equal(c1.faltanAtributos, false);
    assert.deepEqual(c1.pendientes, []);
    assert.deepEqual(c1.defectos.map((d) => [d.punto, d.saleAsi]), [['M2', true]]);
    assert.ok(!/555 0104|3,500|obra@colegio/.test(JSON.stringify(c1)), JSON.stringify(c1));
    assert.match(c1.defectos[0].nota, /•••/);
    assert.match(c1.observacionesInstalacion, /Llevar tensor extra/);
    const c2 = cerradas.json.obras.find((o) => o.obraId === '3G-26-0102').calidad;
    assert.deepEqual(c2, { estado: 'sin_revisar', avaladaEn: null, avaladaPor: null, faltanAtributos: true, pendientes: [], defectos: [], observacionesInstalacion: null });
    const estado = await s.pedir('GET', RUTAS[1], conLlave());
    assert.equal(estado.json.obras.find((o) => o.obraId === '3G-26-0101').calidad.estado, 'avalada');
    const enCurso = await s.pedir('GET', RUTAS[2], conLlave());
    assert.equal(enCurso.json.obras.find((o) => o.obraId === '3G-26-0103').calidad.estado, 'sin_revisar');
    // Si la hoja no se puede leer, la obra sale igual con calidad null
    const roto = { ...repo, hojasDeObras: async () => { throw new Error('base caída'); } };
    S.usarRepoCalidad(roto);
    const sinHoja = await s.pedir('GET', RUTAS[0], conLlave());
    assert.equal(sinHoja.status, 200);
    assert.ok(sinHoja.json.obras.every((o) => o.calidad === null));
});

test('sugerencias: alcance calidad.sugerir, Idempotency-Key, se guardan y la misma llamada no se duplica', async () => {
    banderas({ PANEL_CALIDAD: '1' });
    await puerta(ENV_SIN_ALCANCE);
    const cuerpo = {
        fecha: '2026-10-28', llamadaId: 'llamada-calidad-0042',
        sugerencias: [
            { obraId: '3G-26-0103', punto: 'M5', estado: 'defecto', nota: 'Falta un refuerzo de esquina', saleAsi: false, discrepancia: true },
            { folio: '3G-26-0101', punto: 'H3', estado: 'ok' },
            { obraId: '3G-26-0999', punto: 'M1', estado: 'ok' }
        ]
    };
    const sinAlcance = await s.pedir('POST', '/api/sistemas/v1/calidad/sugerencias', { ...conLlave({ 'Idempotency-Key': 'k-1' }), cuerpo });
    assert.equal(sinAlcance.status, 403);
    assert.match(sinAlcance.json.error, /calidad\.sugerir/);
    await s.cerrar();
    await puerta(ENV);
    const sinClave = await s.pedir('POST', '/api/sistemas/v1/calidad/sugerencias', { ...conLlave(), cuerpo });
    assert.equal(sinClave.status, 400);
    assert.match(sinClave.json.error, /Idempotency-Key/);
    const r = await s.pedir('POST', '/api/sistemas/v1/calidad/sugerencias', { ...conLlave({ 'Idempotency-Key': 'llamada-calidad-0042' }), cuerpo });
    assert.equal(r.status, 200, r.texto);
    assert.deepEqual({ recibidas: r.json.recibidas, pendientes: r.json.pendientes, sinObra: r.json.sinObra }, { recibidas: 3, pendientes: 2, sinObra: 1 });
    assert.equal(repo._sugerencias.length, 3);
    assert.equal(repo._sugerencias[0].discrepancia, 'sí');
    assert.equal(repo._sugerencias[0].origen, 'operacion');
    // La misma llave: la misma respuesta sin escribir
    const otra = await s.pedir('POST', '/api/sistemas/v1/calidad/sugerencias', { ...conLlave({ 'Idempotency-Key': 'llamada-calidad-0042' }), cuerpo });
    assert.equal(otra.status, 200);
    assert.equal(otra.headers['idempotent-replayed'], 'true');
    // La misma llamada con otra llave (reintento tras un 504): tampoco se duplica
    const tercera = await s.pedir('POST', '/api/sistemas/v1/calidad/sugerencias', { ...conLlave({ 'Idempotency-Key': 'otra-llave' }), cuerpo });
    assert.equal(tercera.json.repetida, true);
    assert.equal(repo._sugerencias.length, 3);
    // Cuerpo malo
    const mala = await s.pedir('POST', '/api/sistemas/v1/calidad/sugerencias', { ...conLlave({ 'Idempotency-Key': 'k-mala' }), cuerpo: { sugerencias: 'no' } });
    assert.equal(mala.status, 400);
});
