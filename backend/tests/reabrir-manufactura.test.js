/**
 * Reabrir manufactura: una obra en «Preparado» (etapa instalacion) que no quedó en la instalación regresa a producción
 * con SOLO la manufactura abierta. Herrería, diseño, compras y las fechas se quedan; lo que se quita queda anotado en
 * observaciones_produccion. Se prueba el método del modelo, la ruta del tablero y la puerta entre sistemas (la que
 * puede ordenar Sofía), con un proyecto inventado en lugar de la base (save no escribe nada).
 *
 * Correr:  cd backend && npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

for (const m of ['log', 'info', 'debug']) console[m] = () => {};
process.env.DATABASE_URL = 'postgres://prueba:prueba@127.0.0.1:9/prueba_sin_base';
process.env.WHATSAPP_PUENTE_TOKEN = '';

const { ProduccionProyecto } = await import('../src/models/index.js');
const { reabrirManufactura } = await import('../src/controllers/produccion.controller.js');
const { leerReabrir, reabrirManufacturaPuerta } = await import('../src/routes/sistemas/reabrirManufactura.js');

const DISENO = new Date('2026-10-01T16:00:00Z');
const COMPRAS = new Date('2026-10-05T16:00:00Z');
const MANUF = new Date('2026-10-20T16:00:00Z');
const HERR = new Date('2026-10-21T16:00:00Z');
const PREP = new Date('2026-10-21T17:00:00Z');

/** Un proyecto del modelo, sin base: save solo cuenta. */
const enPreparado = (cambios = {}) => {
    const p = ProduccionProyecto.build({
        id: 605, nombre: 'OBRA DE PRUEBA', tipo_proyecto: 'A', etapa_actual: 'instalacion',
        fecha_entrada: '2026-09-28', fecha_limite: '2026-11-30',
        diseno_completado_en: DISENO, diseno_completado_por: 1, compras_completado_en: COMPRAS, compras_completado_por: 1,
        tiene_manufactura: true, tiene_herreria: true,
        manufactura_completado: true, manufactura_completado_en: MANUF, manufactura_completado_por: 2,
        herreria_completado: true, herreria_completado_en: HERR, herreria_completado_por: 3,
        herreria_armado_completado: true, herreria_pintado_completado: true,
        instalacion_completado_en: PREP, instalacion_completado_por: 2,
        ...cambios
    });
    p.guardados = 0;
    p.save = async function () { this.guardados++; return this; };
    return p;
};

test('reabrirManufactura: regresa a producción con solo la manufactura abierta y sin tocar lo demás', async () => {
    const p = enPreparado({ observaciones_produccion: 'Nota previa' });
    await p.reabrirManufactura(7, { motivo: 'no quedó en la instalación', quien: 'Isa', ahora: new Date('2026-11-11T18:00:00Z') });
    assert.equal(p.guardados, 1);
    assert.equal(p.etapa_actual, 'produccion');
    assert.equal(p.manufactura_completado, false);
    assert.equal(p.manufactura_completado_en, null);
    assert.equal(p.instalacion_completado_en, null);
    // Herrería y el historial se quedan
    assert.equal(p.herreria_completado, true);
    assert.deepEqual(p.herreria_completado_en, HERR);
    assert.equal(p.herreria_armado_completado, true);
    assert.equal(p.herreria_pintado_completado, true);
    assert.deepEqual(p.diseno_completado_en, DISENO);
    assert.deepEqual(p.compras_completado_en, COMPRAS);
    assert.equal(p.fecha_entrada, '2026-09-28');
    assert.equal(p.fecha_limite, '2026-11-30');
    // Lo quitado queda anotado debajo de lo que ya había
    assert.equal(p.observaciones_produccion,
        'Nota previa\nManufactura reabierta el 11/11/2026 por Isa (antes: manufactura terminada el 20/10/2026, Preparado el 21/10/2026): no quedó en la instalación');
    // De vuelta en las pantallas: Manufactura la ve pendiente y producción ya no está «terminada»
    assert.equal(p.puedeAvanzarDeProduccion(), false);
});

test('reabrirManufactura: completar manufactura otra vez la regresa a Preparado', async () => {
    const p = enPreparado();
    await p.reabrirManufactura(null);
    const r = await p.completarSubEtapaProduccion('manufactura', 2);
    assert.equal(r.autoAvanzado, true);
    assert.equal(p.etapa_actual, 'instalacion');
    assert.ok(p.instalacion_completado_en);
});

test('reabrirManufactura: solo desde «Preparado»; una obra cerrada en el Índice no se toca', async () => {
    const cerrada = enPreparado({ etapa_actual: 'completado' });
    await assert.rejects(() => cerrada.reabrirManufactura(1), /cerrada en el Índice/);
    assert.equal(cerrada.guardados, 0);
    assert.equal(cerrada.manufactura_completado, true);
    const enProduccion = enPreparado({ etapa_actual: 'produccion' });
    await assert.rejects(() => enProduccion.reabrirManufactura(1), /Preparado/);
    assert.equal(enProduccion.guardados, 0);
});

const respuesta = () => {
    const r = { codigo: 200, cuerpo: null };
    r.status = (c) => { r.codigo = c; return r; };
    r.json = (b) => { r.cuerpo = b; return r; };
    return r;
};

test('POST /api/produccion/:id/reabrir-manufactura: 200 en Preparado, 409 fuera de él, 404 sin proyecto', async () => {
    const original = ProduccionProyecto.findByPk;
    try {
        let p = enPreparado();
        ProduccionProyecto.findByPk = async (id) => (Number(id) === 605 ? p : null);
        let res = respuesta();
        await reabrirManufactura({ params: { id: '605' }, body: { motivo: '  ajuste  ' }, usuario: { id: 9, nombre: 'Isa' } }, res);
        assert.equal(res.codigo, 200);
        assert.equal(res.cuerpo.data.etapaNueva, 'produccion');
        assert.match(p.observaciones_produccion, /por Isa .*: ajuste$/);

        res = respuesta();
        await reabrirManufactura({ params: { id: '605' }, body: undefined }, res);
        assert.equal(res.codigo, 409);

        p = enPreparado({ etapa_actual: 'completado' });
        res = respuesta();
        await reabrirManufactura({ params: { id: '605' }, body: {} }, res);
        assert.equal(res.codigo, 409);
        assert.match(res.cuerpo.message, /Índice/);

        res = respuesta();
        await reabrirManufactura({ params: { id: '1' }, body: {} }, res);
        assert.equal(res.codigo, 404);
    } finally {
        ProduccionProyecto.findByPk = original;
    }
});

test('puerta: revisa el cuerpo', () => {
    assert.deepEqual(leerReabrir({ proyectoId: 605, autor: 'Sofía' }).datos, { proyectoId: 605, obraId: null, autor: 'Sofía', motivo: null });
    assert.equal(leerReabrir({ obraId: '3g-26-0412', autor: 'Sofía' }).datos.obraId, '3G-26-0412');
    assert.match(leerReabrir({ autor: 'Sofía' }).errores.join(), /Falta «proyectoId» u «obraId»/);
    assert.match(leerReabrir({ proyectoId: 605, obraId: '3G-26-0412', autor: 'x' }).errores.join(), /no los dos/);
    assert.match(leerReabrir({ proyectoId: 'abc', autor: 'x' }).errores.join(), /proyectoId/);
    assert.match(leerReabrir({ obraId: 'OBRA', autor: 'x' }).errores.join(), /ID 3G/);
    assert.match(leerReabrir({ proyectoId: 605 }).errores.join(), /autor/);
});

test('puerta: reabre por proyectoId o por ID 3G y contesta 404/409 como el tablero', async () => {
    let p = enPreparado();
    const modelo = { findByPk: async (id) => (id === 605 ? p : null) };
    let r = await reabrirManufacturaPuerta({ proyectoId: '605', autor: 'Sofía', motivo: 'subieron el ajuste' }, { modelo });
    assert.equal(r.codigo, 200);
    assert.deepEqual(r.cuerpo, { ok: true, proyectoId: 605, proyecto: 'OBRA DE PRUEBA', etapaAntes: 'instalacion', etapa: 'produccion' });
    assert.match(p.observaciones_produccion, /por Sofía .*: subieron el ajuste$/);

    // Ya en producción: 409 y no se toca
    r = await reabrirManufacturaPuerta({ proyectoId: 605, autor: 'Sofía' }, { modelo });
    assert.equal(r.codigo, 409);
    assert.equal(r.cuerpo.etapa, 'produccion');

    p = enPreparado();
    r = await reabrirManufacturaPuerta({ obraId: '3G-26-0412', autor: 'Sofía' }, { modelo, buscarObra: async (_m, obra) => (obra === '3G-26-0412' ? p : null) });
    assert.equal(r.codigo, 200);
    assert.equal(p.etapa_actual, 'produccion');

    r = await reabrirManufacturaPuerta({ proyectoId: 1, autor: 'Sofía' }, { modelo });
    assert.equal(r.codigo, 404);
    r = await reabrirManufacturaPuerta({ autor: 'Sofía' }, { modelo });
    assert.equal(r.codigo, 400);
});
