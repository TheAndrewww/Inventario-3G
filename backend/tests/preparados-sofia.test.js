/**
 * Las obras en Preparado para Sofía (12-nov-2026): GET /api/sistemas/v1/produccion/preparados?q=
 *
 * Isa dicta el nombre de la obra por WhatsApp («II» llega como «2», una letra cambia, sin acentos); Sofía busca aquí la
 * obra y sabe si se puede reabrir su Manufactura antes de proponer la orden. Se prueban la coincidencia (funciones puras),
 * los alcances y la forma de la respuesta, con las MISMAS reglas de reaperturaManufactura.service.js.
 *
 * Sin base de datos ni Sheets: ProduccionProyecto.findAll es un doble en memoria y la falla del calendario se pasa a mano
 * (crearPuertas({ leerFallas })). Llaves y obras inventadas. Las peticiones van por un socket local (sin puertos de red).
 * Correr:  cd backend && npm test      (o: node --test tests/preparados-sofia.test.js)
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

for (const m of ['log', 'info', 'debug']) console[m] = () => {};

// Antes de cargar los modelos: base inexistente y avisos apagados, aunque exista un backend/.env.
process.env.DATABASE_URL = 'postgres://prueba:prueba@127.0.0.1:9/prueba_sin_base';
process.env.WHATSAPP_PUENTE_TOKEN = '';

const express = (await import('express')).default;
const { Op } = await import('sequelize');
const { ProduccionProyecto } = await import('../src/models/index.js');
const { default: LlaveSistema } = await import('../src/models/LlaveSistema.js');
const { crearPuertas } = await import('../src/routes/sistemas/index.js');
const { servir } = await import('./_servidorPrueba.js');
const {
    palabrasDictado, palabrasDeBusqueda, unaLetraDeDiferencia, coincidenciaDictado, ordenarPorCoincidencia, leerPreparados,
    SIN_CALENDARIO, MAX_SIN_Q, MAX_CON_Q
} = await import('../src/routes/sistemas/preparados.js');
const { SIN_FALLA } = await import('../src/services/reaperturaManufactura.service.js');

// ---------- Coincidencia tolerante a dictado (puras) ----------

const ids = (lista) => lista.map((o) => o.id);
const PRUEBA_I = { id: 601, nombre: 'LUNA ROBLE – MEMBRANA TENSILADA' };
const PRUEBA_II = { id: 605, nombre: 'LUNA ROBLE – MEMBRANA TENSILADA II' };

test('«Lupa Roble 2» (dictado) encuentra «LUNA ROBLE – MEMBRANA TENSILADA II» y no la que no lleva número', () => {
    assert.deepEqual(ids(ordenarPorCoincidencia('Lupa Roble 2', [PRUEBA_I, PRUEBA_II])), [605]);
    assert.deepEqual(ids(ordenarPorCoincidencia('Lúna Roble II', [PRUEBA_I, PRUEBA_II])), [605]);
    const c = coincidenciaDictado('Lupa Roble 2', PRUEBA_II.nombre);
    assert.deepEqual(c, { puntaje: 7, exactas: 2, prefijos: 0, errores: 1, sobrantes: 2 });
    // Sin número salen las dos; primero la que tiene menos palabras de sobra
    assert.deepEqual(ids(ordenarPorCoincidencia('luna roble', [PRUEBA_II, PRUEBA_I])), [601, 605]);
});

test('acentos, mayúsculas y signos no cuentan', () => {
    const obras = [{ id: 1, nombre: 'PÉRGOLA JARDÍN ESCOLAR' }, { id: 2, nombre: 'PERGOLA JARDIN - TERRAZA' }];
    assert.deepEqual(ids(ordenarPorCoincidencia('pergola jardin', obras)), [1, 2]);
    assert.deepEqual(ids(ordenarPorCoincidencia('¡Pérgola, Jardín!', obras)), [1, 2]);
    assert.deepEqual(ids(ordenarPorCoincidencia('Jardín terraza', obras)), [2]);
    assert.deepEqual(palabrasDictado('Ñandú – Señal'), ['nandu', 'senal']);
});

test('romanos I..X ↔ dígitos, y los números van exactos', () => {
    const obras = [{ id: 1, nombre: 'VELARIA PARQUE III' }, { id: 2, nombre: 'VELARIA PARQUE 3' }, { id: 3, nombre: 'VELARIA PARQUE' }, { id: 4, nombre: 'VELARIA PARQUE 23' }];
    assert.deepEqual(ids(ordenarPorCoincidencia('velaria parque 3', obras)), [1, 2]);
    assert.deepEqual(ids(ordenarPorCoincidencia('Velaria Parque III', obras)), [1, 2]);
    assert.deepEqual(ids(ordenarPorCoincidencia('velaria parque 2', obras)), []);
    assert.deepEqual(ids(ordenarPorCoincidencia('velaria parque 23', obras)), [4]);
    assert.deepEqual(ids(ordenarPorCoincidencia('velaria parque', obras)), [3, 1, 2, 4]);
    assert.deepEqual(palabrasDictado('ii IV x 02 vii'), ['2', '4', '10', '2', '7']);
});

test('palabras vacías y de menos de 3 letras fuera; sin palabras para buscar no coincide nada', () => {
    const obras = [{ id: 1, nombre: 'PÉRGOLA JARDÍN ESCOLAR' }];
    assert.deepEqual(palabrasDeBusqueda('la Manufactura de la obra del Proyecto Pérgola y su Jardín'), ['pergola', 'jardin']);
    assert.deepEqual(ids(ordenarPorCoincidencia('la manufactura de la obra pérgola jardín', obras)), [1]);
    assert.deepEqual(palabrasDeBusqueda('la obra de'), []);
    assert.equal(coincidenciaDictado('la obra de', obras[0].nombre), null);
    assert.deepEqual(ordenarPorCoincidencia('la obra', obras), []);
});

test('una letra de diferencia solo con palabras de 4 letras o más; el prefijo cuenta; exactas > prefijo > con error', () => {
    assert.equal(unaLetraDeDiferencia('lupa', 'luna'), true);
    assert.equal(unaLetraDeDiferencia('membrana', 'menbrana'), true);
    assert.equal(unaLetraDeDiferencia('prueba', 'pruebas'), true);
    assert.equal(unaLetraDeDiferencia('pruebas', 'prueba'), true);
    assert.equal(unaLetraDeDiferencia('prueba', 'prieva'), false);
    assert.equal(unaLetraDeDiferencia('luna', 'luna'), false);
    assert.equal(coincidenciaDictado('toldo sal', 'TOLDO SOL'), null, '«sal» tiene 3 letras: no se le perdona una');
    assert.ok(coincidenciaDictado('toldo tensi', 'TOLDO TENSILADO'), 'el inicio de una palabra cuenta');
    const obras = [{ id: 'error', nombre: 'LUNA PATIO' }, { id: 'prefijo', nombre: 'LONAS PATIO' }, { id: 'exacta', nombre: 'LONA PATIO' }];
    assert.deepEqual(ids(ordenarPorCoincidencia('lona patio', obras)), ['exacta', 'prefijo', 'error']);
});

test('sin coincidencias → lista vacía', () => {
    assert.deepEqual(ordenarPorCoincidencia('Rosa Inexistente', [PRUEBA_I, PRUEBA_II]), []);
    assert.deepEqual(ordenarPorCoincidencia('luna roble 7', [PRUEBA_I, PRUEBA_II]), []);
});

// ---------- La puerta ----------

const LLAVES = { operacion: 'llave-operacion-de-prueba-no-es-real', sofia: 'llave-sofia-de-prueba-no-es-real', inicio: 'llave-inicio-de-prueba-no-es-real' };
const huella = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');
const ENV = {
    LLAVE_ENTRANTE_OPERACION_SHA256: huella(LLAVES.operacion), ALCANCES_OPERACION: 'produccion.leer',
    LLAVE_ENTRANTE_SOFIA_SHA256: huella(LLAVES.sofia), ALCANCES_SOFIA: 'produccion.reabrir',
    LLAVE_ENTRANTE_INICIO_SHA256: huella(LLAVES.inicio), ALCANCES_INICIO: 'inicio.leer'
};

const DIA_MS = 24 * 60 * 60 * 1000;
const haceDias = (n) => new Date(Date.now() - n * DIA_MS);
const obra = (datos) => ({
    tipo_proyecto: 'A', es_extensivo: false, es_premium: false, etapa_actual: 'instalacion', activo: true, fecha_limite: null,
    instalacion_completado_en: haceDias(5), ...datos
});
const OBRAS = [
    obra({ id: 601, nombre: PRUEBA_I.nombre, instalacion_completado_en: haceDias(10) }),
    obra({ id: 605, nombre: PRUEBA_II.nombre, instalacion_completado_en: haceDias(3) }),
    obra({ id: 610, nombre: 'VELARIA PARQUE III', tipo_proyecto: 'MTO', instalacion_completado_en: haceDias(1) }),
    obra({ id: 611, nombre: 'PÉRGOLA JARDÍN ESCOLAR', tipo_proyecto: null, instalacion_completado_en: null }),
    obra({ id: 612, nombre: 'LUNA ROBLE CANCELADA II', tipo_proyecto: 'CANCELADO A' }),
    obra({ id: 613, nombre: 'LUNA ROBLE INACTIVA II', activo: false }),
    obra({ id: 614, nombre: 'LUNA ROBLE EN TALLER II', etapa_actual: 'produccion' }),
    obra({ id: 615, nombre: 'LUNA ROBLE ENTREGADA II', etapa_actual: 'completado' })
];
// La falla según el calendario (lo que daría leerFallasDelCalendario)
const FALLAS = {
    601: { falla: false, fecha: null, nota: null },
    605: { falla: true, fecha: '2026-11-10', nota: 'La membrana no cerró; llamar al 462 123 4567' },
    610: { falla: true, fecha: '2026-11-09', nota: null },
    611: { falla: false, fecha: null, nota: null }
};

let obras = OBRAS;
let calendario = 'bien'; // 'bien' | 'falla'
const lecturasCalendario = [];
const consultas = [];
const leerFallas = async (lista) => {
    lecturasCalendario.push(lista.map((p) => p.id));
    if (calendario === 'falla') throw new Error('cuota de Sheets (prueba)');
    return new Map(lista.filter((p) => FALLAS[p.id]).map((p) => [p.id, FALLAS[p.id]]));
};

const originales = { findAll: ProduccionProyecto.findAll, llFind: LlaveSistema.findOne, llCreate: LlaveSistema.create };
let puerta;
before(async () => {
    ProduccionProyecto.findAll = async (opciones) => {
        consultas.push(opciones);
        const { where } = opciones;
        // Solo Preparado, activas y sin cancelar; solo las columnas que hacen falta, las más recientes primero
        assert.equal(where.etapa_actual, 'instalacion');
        assert.equal(where.activo, true);
        assert.deepEqual(where[Op.or][0], { tipo_proyecto: null });
        assert.equal(where[Op.or][1].tipo_proyecto[Op.notILike], 'CANCELADO%');
        assert.ok(!opciones.attributes.some((c) => /cliente|observaciones|carpeta|archivo/.test(c)), 'solo las columnas que hacen falta');
        assert.deepEqual(opciones.order, [['instalacion_completado_en', 'DESC NULLS LAST'], ['id', 'DESC']]);
        const t = (v) => (v ? v.getTime() : -Infinity);
        return obras
            .filter((p) => p.etapa_actual === 'instalacion' && p.activo === true && !/^CANCELADO/i.test(p.tipo_proyecto || ''))
            .sort((a, b) => t(b.instalacion_completado_en) - t(a.instalacion_completado_en) || b.id - a.id)
            .slice(0, opciones.limit)
            .map((p) => ProduccionProyecto.build(p));
    };
    LlaveSistema.findOne = async () => null;
    LlaveSistema.create = async () => ({});
    const app = express();
    app.use(express.json());
    app.use(crearPuertas({ env: ENV, anotar: () => {}, leerFallas }));
    puerta = await servir(app, 'preparados');
});
after(async () => {
    ProduccionProyecto.findAll = originales.findAll;
    LlaveSistema.findOne = originales.llFind;
    LlaveSistema.create = originales.llCreate;
    await puerta?.cerrar();
});
beforeEach(() => {
    obras = OBRAS;
    calendario = 'bien';
    lecturasCalendario.length = 0;
    consultas.length = 0;
});

const pedir = (ruta, origen = 'sofia') => puerta.pedir('GET', ruta, { headers: { Authorization: `Bearer ${LLAVES[origen]}`, 'X-3G-Origen': origen } });
const RUTA = '/api/sistemas/v1/produccion/preparados';
const conQ = (q) => `${RUTA}?q=${encodeURIComponent(q)}`;

test('alcance: sin «produccion.leer» ni «produccion.reabrir» → 403; con cualquiera de los dos → 200; llave mala → 401', async () => {
    const sin = await pedir(RUTA, 'inicio');
    assert.equal(sin.status, 403);
    assert.match(sin.json.error, /produccion\.leer.*produccion\.reabrir/);
    assert.equal((await pedir(RUTA, 'operacion')).status, 200);
    assert.equal((await pedir(RUTA, 'sofia')).status, 200);
    const mala = await puerta.pedir('GET', RUTA, { headers: { Authorization: 'Bearer otra-llave', 'X-3G-Origen': 'sofia' } });
    assert.equal(mala.status, 401);
});

test('con q: la obra dictada con su falla, puedeReabrir y la forma exacta de la respuesta', async () => {
    const r = await pedir(conQ('Lupa Roble 2'));
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.json).sort(), ['obras', 'ok', 'total']);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.total, 1);
    assert.deepEqual(r.json.obras, [{
        id: 605,
        nombre: 'LUNA ROBLE – MEMBRANA TENSILADA II',
        tipo_proyecto: 'A',
        falla: { fecha: '2026-11-10', nota: 'La membrana no cerró; llamar al •••' }, // sin teléfonos
        puedeReabrir: true,
        motivoNo: null,
        coincidencia: 'aproximada' // «lupa» ≈ «luna»: Sofía avisa a Isa antes de proponer
    }]);
    assert.deepEqual(lecturasCalendario, [[605]], 'una sola lectura del calendario, solo para la que se devuelve');
});

test('con q: varias coinciden; sin falla en el calendario no se puede reabrir (el motivo de la reapertura)', async () => {
    const r = await pedir(conQ('luna roble'));
    assert.equal(r.status, 200);
    assert.equal(r.json.total, 2, 'ni la cancelada, ni la inactiva, ni la del taller, ni la entregada');
    assert.deepEqual(ids(r.json.obras), [601, 605]);
    const [i, ii] = r.json.obras;
    assert.deepEqual(i, { id: 601, nombre: PRUEBA_I.nombre, tipo_proyecto: 'A', falla: null, puedeReabrir: false, motivoNo: SIN_FALLA, coincidencia: 'exacta' });
    assert.equal(ii.puedeReabrir, true);
});

test('MTO con falla: se ve la falla, pero no se reabre (no pasa por producción)', async () => {
    const r = await pedir(conQ('velaria parque 3'));
    const [o] = r.json.obras;
    assert.equal(o.id, 610);
    assert.equal(o.tipo_proyecto, 'MTO');
    assert.deepEqual(o.falla, { fecha: '2026-11-09', nota: null });
    assert.equal(o.puedeReabrir, false);
    assert.match(o.motivoNo, /no pasa por producción/);
});

test('sin q: todas las de Preparado, las más recientes primero; q sin palabras para buscar es lo mismo', async () => {
    const r = await pedir(RUTA);
    assert.equal(r.status, 200);
    assert.deepEqual(ids(r.json.obras), [610, 605, 601, 611]);
    assert.equal(r.json.total, 4);
    assert.deepEqual(lecturasCalendario, [[610, 605, 601, 611]]);
    assert.equal(r.json.obras[3].tipo_proyecto, null);
    const vacia = await pedir(`${RUTA}?q=`);
    assert.deepEqual(ids(vacia.json.obras), [610, 605, 601, 611]);
    const soloVacias = await pedir(conQ('la obra de'));
    assert.deepEqual(ids(soloVacias.json.obras), [610, 605, 601, 611]);
});

test(`topes: ${MAX_SIN_Q} sin q y ${MAX_CON_Q} con q; total dice cuántas había`, async () => {
    obras = Array.from({ length: 40 }, (_, i) => obra({ id: 700 + i, nombre: `LONA SERIE ${i + 1}`, instalacion_completado_en: haceDias(i + 1) }));
    const sin = await pedir(RUTA);
    assert.equal(sin.json.obras.length, MAX_SIN_Q);
    assert.equal(sin.json.total, 40);
    assert.equal(sin.json.obras[0].id, 700, 'la más reciente primero');
    const con = await pedir(conQ('lona serie'));
    assert.equal(con.json.obras.length, MAX_CON_Q);
    assert.equal(con.json.total, 40);
    assert.equal(lecturasCalendario.at(-1).length, MAX_CON_Q, 'el calendario solo para las que se devuelven');
});

test('sin coincidencias: lista vacía y no se lee el calendario', async () => {
    const r = await pedir(conQ('Rosa Inexistente'));
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true, obras: [], total: 0 });
    assert.deepEqual(lecturasCalendario, []);
});

test('si el calendario no se puede leer: falla null, puedeReabrir false y «no se pudo leer el calendario»', async () => {
    calendario = 'falla';
    const r = await pedir(RUTA);
    assert.equal(r.status, 200);
    for (const o of r.json.obras) {
        assert.equal(o.falla, null);
        assert.equal(o.puedeReabrir, false);
    }
    assert.deepEqual(r.json.obras.filter((o) => o.id !== 610).map((o) => o.motivoNo), [SIN_CALENDARIO, SIN_CALENDARIO, SIN_CALENDARIO]);
    // La MTO no se reabre de todos modos: su motivo es el de la obra, que la reapertura revisa antes que el calendario
    assert.match(r.json.obras.find((o) => o.id === 610).motivoNo, /no pasa por producción/);
});

test('si el calendario se tarda más que su tope: igual que si no se pudo leer (la lista sale)', async () => {
    const lento = () => new Promise((r) => setTimeout(() => r(new Map([[605, FALLAS[605]]])), 500));
    const { codigo, cuerpo } = await leerPreparados({ query: { q: 'lupa roble 2' } }, { leerFallas: lento, topeCalendarioMs: 30 });
    assert.equal(codigo, 200);
    assert.deepEqual(cuerpo.obras.map((o) => [o.id, o.falla, o.puedeReabrir, o.motivoNo]), [[605, null, false, SIN_CALENDARIO]]);
});

test('q repetido o de más de 120 caracteres → 400 sin leer nada', async () => {
    const repetido = await pedir(`${RUTA}?q=luna&q=roble`);
    assert.equal(repetido.status, 400);
    assert.match(repetido.json.error, /una sola vez/);
    const largo = await pedir(conQ('a'.repeat(121)));
    assert.equal(largo.status, 400);
    assert.match(largo.json.error, /120/);
    assert.equal(consultas.length, 0);
    assert.equal((await pedir(conQ(`luna roble ${' '.repeat(5)}2`))).status, 200, 'los espacios de más se juntan');
});

test('coincidencia: exacta si cada palabra está tal cual; aproximada con inicio de palabra o una letra de diferencia', async () => {
    const { tipoDeCoincidencia } = await import('../src/routes/sistemas/preparados.js');
    assert.equal(tipoDeCoincidencia('Luna Roble 2', 'LUNA ROBLE – MEMBRANA TENSILADA II'), 'exacta');
    assert.equal(tipoDeCoincidencia('Lupa Roble 2', 'LUNA ROBLE – MEMBRANA TENSILADA II'), 'aproximada');
    assert.equal(tipoDeCoincidencia('luna rob', 'LUNA ROBLE'), 'aproximada');
    assert.equal(tipoDeCoincidencia('', 'LUNA ROBLE'), null);
});
