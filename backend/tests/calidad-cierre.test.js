/**
 * El cierre de producción con CALIDAD_AVAL_CIERRA, por las puertas de siempre: el tablero (toggleEtapa), la terminal
 * (completarSubEtapa y completarEtapa), la sincronización del Excel (recuperarPorSubetapas) y «Calidad pide corregir» en
 * la terminal (obtenerPorArea). Con las banderas apagadas cada respuesta debe ser la de hoy, campo por campo.
 *
 * Sin base: ProduccionProyecto.findByPk/findAll dan instancias de verdad (build) con save() que solo cuenta, y el
 * repositorio de calidad es el doble en memoria. El puente de WhatsApp va apagado: ningún aviso sale.
 * Correr:  cd backend && npm test
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

for (const m of ['log', 'info', 'debug', 'warn']) console[m] = () => {};
process.env.DATABASE_URL = 'postgres://prueba:prueba@127.0.0.1:9/prueba_sin_base';
process.env.WHATSAPP_PUENTE_TOKEN = '';

const { ProduccionProyecto } = await import('../src/models/index.js');
const S = await import('../src/services/calidad.service.js');
const C = await import('../src/controllers/produccion.controller.js');
const { recuperarPorSubetapas } = await import('../src/services/produccionSheets.service.js');
const { crearRepoMemoria } = await import('./_calidadMemoria.js');

const BANDERAS = ['PANEL_CALIDAD', 'CALIDAD_AVAL_CIERRA', 'CALIDAD_DEFECTO_REABRE'];
const guardadas = Object.fromEntries(BANDERAS.map((n) => [n, process.env[n]]));
const banderas = (b = {}) => {
    for (const n of BANDERAS) delete process.env[n];
    for (const [n, v] of Object.entries(b)) process.env[n] = v;
};
const originales = { findByPk: ProduccionProyecto.findByPk, findAll: ProduccionProyecto.findAll };

let repo;
beforeEach(() => {
    repo = crearRepoMemoria(ProduccionProyecto);
    S.usarRepoCalidad(repo);
    ProduccionProyecto.findByPk = async (id) => repo._proyectos.get(Number(id)) || null;
    ProduccionProyecto.findAll = async () => [...repo._proyectos.values()];
});
afterEach(() => {
    S.usarRepoCalidad(null);
    Object.assign(ProduccionProyecto, originales);
    for (const n of BANDERAS) { if (guardadas[n] === undefined) delete process.env[n]; else process.env[n] = guardadas[n]; }
});

const llamar = async (fn, req) => {
    const res = { codigo: 200, cuerpo: null, status(c) { this.codigo = c; return this; }, json(b) { this.cuerpo = b; return this; } };
    await fn({ params: {}, body: {}, ...req }, res);
    // Fechas a texto, como saldrían por la red
    return { codigo: res.codigo, cuerpo: JSON.parse(JSON.stringify(res.cuerpo)) };
};
const sinTiempos = (x) => JSON.parse(JSON.stringify(x, (k, v) => (/(_en|En)$|^updated_at$|^created_at$|^diasRestantes$/.test(k) ? '·' : v)));

const obra = (id, extra = {}) => repo.agregarProyecto({
    id, nombre: `OBRA ${id}`, etapa_actual: 'produccion', manufactura_completado: true, manufactura_completado_en: new Date('2026-10-27T15:00:00Z'),
    herreria_completado: false, ...extra
});

// ---------- Tablero: toggleEtapa ----------

test('tablero (toggleEtapa) con las banderas apagadas: la respuesta es la de hoy y la obra pasa a Preparado', async () => {
    const respuestas = [];
    for (const b of [{}, { CALIDAD_AVAL_CIERRA: '1' }, { PANEL_CALIDAD: '1' }]) {
        banderas(b);
        repo = crearRepoMemoria(ProduccionProyecto);
        S.usarRepoCalidad(repo);
        const p = obra(1);
        const r = await llamar(C.toggleEtapa, { params: { id: '1' }, body: { etapa: 'herreria', completado: true }, usuario: { id: 9, rol: 'administrador', nombre: 'Oficina' } });
        assert.equal(r.codigo, 200);
        assert.equal(p.etapa_actual, 'instalacion');
        assert.equal(r.cuerpo.data.esperaCalidad, undefined);
        assert.deepEqual(Object.keys(r.cuerpo.data), ['proyecto']);
        assert.equal(repo._hojas.length + repo._eventos.length, 0, 'calidad no se tocó');
        respuestas.push(sinTiempos(r.cuerpo));
    }
    assert.deepEqual(respuestas[1], respuestas[0]);
    assert.deepEqual(respuestas[2], respuestas[0]);
});

test('tablero con CALIDAD_AVAL_CIERRA: terminar herrería deja la obra en producción esperando el aval; «Preparado» manual sigue y se anota', async () => {
    banderas({ PANEL_CALIDAD: '1', CALIDAD_AVAL_CIERRA: '1' });
    const p = obra(2);
    let r = await llamar(C.toggleEtapa, { params: { id: '2' }, body: { etapa: 'herreria', completado: true }, usuario: { id: 9, rol: 'almacen', nombre: 'Charly' } });
    assert.equal(r.codigo, 200);
    assert.equal(r.cuerpo.data.esperaCalidad, true);
    assert.equal(p.etapa_actual, 'produccion');
    assert.ok(!p.instalacion_completado_en);
    assert.equal(repo._eventos.filter((e) => e.tipo === 'espera_calidad').length, 1);
    // Marcar diseño no la cuela a Preparado
    r = await llamar(C.toggleEtapa, { params: { id: '2' }, body: { etapa: 'diseno', completado: true }, usuario: { id: 9, rol: 'administrador', nombre: 'Oficina' } });
    assert.equal(p.etapa_actual, 'produccion');
    // El «Preparado» manual de la oficina sigue funcionando y queda en la bitácora de calidad
    r = await llamar(C.toggleEtapa, { params: { id: '2' }, body: { etapa: 'instalacion', completado: true }, usuario: { id: 9, rol: 'administrador', nombre: 'Oficina' } });
    assert.equal(r.codigo, 200);
    assert.equal(p.etapa_actual, 'instalacion');
    assert.equal(r.cuerpo.data.esperaCalidad, undefined);
    const manual = repo._eventos.find((e) => e.tipo === 'preparado_manual');
    assert.ok(manual);
    assert.equal(manual.quien, 'Oficina');
});

// ---------- Terminal ----------

test('terminal (completarSubEtapa) apagado = hoy; con CALIDAD_AVAL_CIERRA responde esperaCalidad y la obra no se cierra', async () => {
    banderas({});
    let p = obra(3);
    let r = await llamar(C.completarSubEtapa, { params: { id: '3' }, body: { subEtapa: 'herreria' } });
    assert.equal(r.codigo, 200);
    assert.deepEqual(Object.keys(r.cuerpo.data), ['proyecto', 'subEtapaCompletada', 'puedeAvanzarAInstalacion', 'estadoSubEtapas']);
    assert.equal(p.etapa_actual, 'instalacion');

    banderas({ PANEL_CALIDAD: '1', CALIDAD_AVAL_CIERRA: '1' });
    p = obra(4);
    r = await llamar(C.completarSubEtapa, { params: { id: '4' }, body: { subEtapa: 'herreria' } });
    assert.equal(r.codigo, 200);
    assert.equal(r.cuerpo.data.esperaCalidad, true);
    assert.equal(r.cuerpo.data.puedeAvanzarAInstalacion, true);
    assert.equal(p.etapa_actual, 'produccion');
});

test('terminal (completarEtapa sin sesión) con CALIDAD_AVAL_CIERRA: 409 si espera el aval; con sesión es el cierre manual', async () => {
    banderas({ PANEL_CALIDAD: '1', CALIDAD_AVAL_CIERRA: '1' });
    const p = obra(5, { herreria_completado: true });
    let r = await llamar(C.completarEtapa, { params: { id: '5' } });
    assert.equal(r.codigo, 409);
    assert.equal(r.cuerpo.codigo, 'ESPERA_CALIDAD');
    assert.equal(p.etapa_actual, 'produccion');
    r = await llamar(C.completarEtapa, { params: { id: '5' }, usuario: { id: 1, rol: 'administrador', nombre: 'Oficina' } });
    assert.equal(r.codigo, 200);
    assert.equal(p.etapa_actual, 'instalacion');
    assert.ok(repo._eventos.some((e) => e.tipo === 'preparado_manual'));
    // Apagada: la terminal cierra como hoy
    banderas({});
    const q = obra(6, { herreria_completado: true });
    r = await llamar(C.completarEtapa, { params: { id: '6' } });
    assert.equal(r.codigo, 200);
    assert.equal(q.etapa_actual, 'instalacion');
});

// ---------- Sincronización del Excel ----------

test('Excel (recuperarPorSubetapas): apagado promueve como hoy; con la bandera la obra que espera el aval se queda en producción', async () => {
    banderas({});
    const p = obra(7, { herreria_completado: true, etapa_actual: 'produccion' });
    let c = await recuperarPorSubetapas(p, 'produccion');
    assert.deepEqual(Object.keys(c).sort(), ['etapa_actual', 'instalacion_completado_en']);
    assert.equal(c.etapa_actual, 'instalacion');
    c = await recuperarPorSubetapas(p, 'diseno');
    assert.equal(c.etapa_actual, 'instalacion');
    assert.deepEqual(await recuperarPorSubetapas(p, 'instalacion'), {});
    assert.deepEqual(await recuperarPorSubetapas(obra(8), 'produccion'), {}, 'sin las dos subetapas no hace nada');

    banderas({ PANEL_CALIDAD: '1', CALIDAD_AVAL_CIERRA: '1' });
    assert.deepEqual(await recuperarPorSubetapas(p, 'produccion'), {});
    assert.deepEqual(await recuperarPorSubetapas(p, 'diseno'), { etapa_actual: 'produccion' });
    // Ya marcada como Preparado a mano: se promueve como siempre
    const q = obra(9, { herreria_completado: true, instalacion_completado_en: new Date() });
    assert.equal((await recuperarPorSubetapas(q, 'produccion')).etapa_actual, 'instalacion');
});

// ---------- «Calidad pide corregir» en la terminal ----------

test('terminal de Manufactura: «Calidad pide corregir» solo con PANEL_CALIDAD; apagada la respuesta es la de hoy', async () => {
    banderas({ PANEL_CALIDAD: '1' });
    repo.agregarProyecto({ id: 10, nombre: 'LONA ESCUELA', etapa_actual: 'produccion' });
    repo.agregarProyecto({ id: 11, nombre: 'SIN DEFECTOS', etapa_actual: 'produccion' });
    const ctx = { repo, quien: 'Tableta', origen: 'tableta' };
    await S.cambiarAtributos(10, { atributos: { lleva_membrana: true, lleva_estructura: true, acabado_estructura: 'pintura' } }, ctx);
    await S.marcarPunto(10, 'M2', { estado: 'defecto', nota: 'Mide 5 cm menos' }, ctx);
    await S.marcarPunto(10, 'M11', { estado: 'defecto', nota: 'Mancha', saleAsi: true }, ctx);
    await S.marcarPunto(10, 'H9', { estado: 'defecto', nota: 'Lijado disparejo' }, ctx);
    let r = await llamar(C.obtenerPorArea, { params: { area: 'manufactura' } });
    const [a, b] = r.cuerpo.data.proyectos;
    assert.deepEqual(a.calidadCorregir, [{ punto: 'M2', texto: 'Dimensiones finales verificadas contra patrón / plano.', nota: 'Mide 5 cm menos' }]);
    assert.equal('calidadCorregir' in b, false);
    r = await llamar(C.obtenerPorArea, { params: { area: 'herreria' } });
    assert.deepEqual(r.cuerpo.data.proyectos[0].calidadCorregir.map((d) => d.punto), ['H9']);
    r = await llamar(C.obtenerPorArea, { params: { area: 'diseno' } });
    assert.ok(r.cuerpo.data.proyectos.every((p) => !('calidadCorregir' in p)));
    // Apagada: ni se pregunta (la hoja sigue ahí, pero la respuesta es la de hoy)
    banderas({});
    const ruido = repo.hojasDeObras;
    repo.hojasDeObras = async () => { throw new Error('no debía leer calidad'); };
    r = await llamar(C.obtenerPorArea, { params: { area: 'manufactura' } });
    assert.ok(r.cuerpo.data.proyectos.every((p) => !('calidadCorregir' in p)));
    repo.hojasDeObras = ruido;
});
