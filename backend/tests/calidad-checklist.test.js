/**
 * Checklist de calidad: la configuración es la real (copia exacta + versión), el evaluador de aplica_si es seguro y da lo
 * mismo que la app (casos compartidos en tests/casos-aplica-si.json) y las banderas vienen apagadas.
 * Sin base, sin red. Correr:  cd backend && npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

for (const m of ['log', 'info', 'debug']) console[m] = () => {};

// Antes de cargar cualquier modelo: base inexistente y avisos apagados, aunque exista un backend/.env.
process.env.DATABASE_URL = 'postgres://prueba:prueba@127.0.0.1:9/prueba_sin_base';
process.env.WHATSAPP_PUENTE_TOKEN = '';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const C = await import('../src/services/checklistCalidad.js');
const B = await import('../src/utils/banderasCalidad.js');
const casos = JSON.parse(fs.readFileSync(path.join(aqui, 'casos-aplica-si.json'), 'utf8'));

test('la configuración es el checklist real del 16-oct con su versión: 27 puntos, M1–M14 y H1–H13', () => {
    assert.equal(C.VERSION_CONFIG, '2026-10-16');
    assert.equal(casos.version_config, C.VERSION_CONFIG);
    assert.deepEqual(C.CONFIG.hojas.map((h) => h.id), ['MANUFACTURA', 'HERRERIA']);
    const ids = C.CONFIG.hojas.flatMap((h) => h.puntos.map((p) => p.id));
    assert.equal(ids.length, 27);
    assert.deepEqual(ids, [...Array.from({ length: 14 }, (_, i) => `M${i + 1}`), ...Array.from({ length: 13 }, (_, i) => `H${i + 1}`)]);
    // Sin la versión, idéntico al JSON real (el de Calidad-3G/docs, si está en esta máquina)
    const real = '/Users/andrewww/Documents/Calidad-3G/docs/checklist_calidad_config.json';
    if (fs.existsSync(real)) {
        const { version, ...resto } = C.CONFIG;
        assert.ok(version);
        assert.deepEqual(resto, JSON.parse(fs.readFileSync(real, 'utf8')));
    }
    assert.equal(C.TIPOS_ATRIBUTO.lleva_membrana, 'bool');
    assert.deepEqual(C.TIPOS_ATRIBUTO.acabado_estructura, ['pintura', 'galvanizado', 'ninguno']);
});

test('evaluador: los casos compartidos con la app', () => {
    const avisos = [];
    for (const c of casos.expresiones) {
        const r = C.evaluarAplicaSi(c.expresion, c.atributos, { avisar: (t) => avisos.push(t) });
        assert.deepEqual(r, { aplica: c.aplica, conocida: c.conocida }, `«${c.expresion}» con ${JSON.stringify(c.atributos)}`);
    }
    // Cada expresión desconocida se avisa una sola vez, aunque se evalúe muchas veces
    const desconocidas = new Set(casos.expresiones.filter((c) => !c.conocida).map((c) => c.expresion));
    assert.ok(avisos.length <= desconocidas.size && avisos.length > 0);
    const antes = avisos.length;
    C.evaluarAplicaSi('lleva_lona', {}, { avisar: (t) => avisos.push(t) });
    assert.equal(avisos.length, antes);
});

test('evaluador: nunca ejecuta código (ni con nombres de funciones de JavaScript)', () => {
    let tocado = false;
    globalThis.__calidadTocado = () => { tocado = true; };
    for (const e of ['__calidadTocado()', 'constructor', "lleva_membrana == '' || __calidadTocado()", 'this', 'globalThis.process']) {
        const r = C.evaluarAplicaSi(e, { lleva_membrana: false }, { avisar: () => {} });
        assert.equal(r.conocida, false, e);
        assert.equal(r.aplica, true, e);
    }
    assert.equal(tocado, false);
    delete globalThis.__calidadTocado;
    // El código fuente no usa eval ni Function
    const fuente = fs.readFileSync(path.join(aqui, '../src/services/checklistCalidad.js'), 'utf8');
    assert.ok(!/\beval\s*\(|new Function\s*\(/.test(fuente));
});

test('hojas y puntos que aplican: los casos de obra compartidos con la app', () => {
    for (const o of casos.obras) {
        const hojas = C.hojasQueAplican(o.atributos);
        for (const id of C.HOJAS_IDS) {
            const h = hojas.find((x) => x.hoja.id === id);
            assert.deepEqual(h ? h.puntos.map((p) => p.id) : [], o.puntos[id], `${o.nombre} · ${id}`);
        }
    }
    assert.equal(C.tieneAtributos(null), false);
    assert.equal(C.tieneAtributos({}), false);
    assert.equal(C.tieneAtributos({ otra_cosa: true }), false);
    assert.equal(C.tieneAtributos({ lleva_membrana: false }), true);
});

test('atributos: solo los del checklist y de su tipo; null quita el atributo', () => {
    assert.deepEqual(C.mezclarAtributos({ lleva_membrana: true, acabado_estructura: 'Pintura ' }, { lleva_cables: true }).atributos,
        { lleva_cables: true, lleva_membrana: true, acabado_estructura: 'pintura' });
    assert.deepEqual(C.mezclarAtributos({ lleva_cables: null }, { lleva_cables: true, lleva_membrana: false }).atributos, { lleva_membrana: false });
    assert.match(C.mezclarAtributos({ lleva_lona: true }).error, /no es un atributo/);
    assert.match(C.mezclarAtributos({ lleva_membrana: 'si' }).error, /sí o no/);
    assert.match(C.mezclarAtributos({ acabado_estructura: 'cromado' }).error, /pintura, galvanizado, ninguno/);
    assert.match(C.mezclarAtributos({ constructor: true }).error, /no es un atributo/);
    assert.match(C.mezclarAtributos(null).error, /Faltan/);
    assert.match(C.mezclarAtributos([]).error, /Faltan/);
});

test('banderas: apagadas sin variables; las dos de calidad no encienden sin PANEL_CALIDAD', () => {
    const guardadas = ['PANEL_CALIDAD', 'CALIDAD_AVAL_CIERRA', 'CALIDAD_DEFECTO_REABRE'].map((n) => [n, process.env[n]]);
    try {
        for (const [n] of guardadas) delete process.env[n];
        assert.equal(B.panelCalidad(), false);
        assert.equal(B.calidadAvalCierra(), false);
        assert.equal(B.calidadDefectoReabre(), false);
        process.env.CALIDAD_AVAL_CIERRA = '1';
        process.env.CALIDAD_DEFECTO_REABRE = '1';
        assert.equal(B.calidadAvalCierra(), false, 'sin PANEL_CALIDAD no cierra nada');
        assert.equal(B.calidadDefectoReabre(), false);
        process.env.PANEL_CALIDAD = '1';
        assert.equal(B.panelCalidad(), true);
        assert.equal(B.calidadAvalCierra(), true);
        assert.equal(B.calidadDefectoReabre(), true);
        process.env.PANEL_CALIDAD = '0';
        assert.equal(B.panelCalidad(), false);
    } finally {
        for (const [n, v] of guardadas) { if (v === undefined) delete process.env[n]; else process.env[n] = v; }
    }
});

test('banderas: las tres salen en banderasPlanta() con su estado (apagadas por omisión)', async () => {
    const { banderasPlanta } = await import('../src/utils/revisarConfig.js');
    const lista = await banderasPlanta();
    for (const n of ['PANEL_CALIDAD', 'CALIDAD_AVAL_CIERRA', 'CALIDAD_DEFECTO_REABRE']) {
        const b = lista.find((x) => x.nombre === n);
        assert.ok(b, n);
        assert.equal(b.encendida, false, n);
    }
});
