/**
 * Lo que Carla cierra al colgar la junta (23-nov): etapas de producción y ✗ en el control de campaña.
 * Sin base de datos: el proyecto se arma en memoria y la campaña es un mapa.
 * Correr:  cd backend && npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

for (const m of ['log', 'info', 'debug']) console[m] = () => {};
process.env.DATABASE_URL = 'postgres://prueba:prueba@127.0.0.1:9/prueba_sin_base';
process.env.WHATSAPP_PUENTE_TOKEN = '';

const { ProduccionProyecto } = await import('../src/models/index.js');
const { cerrarEtapa, planDeCierre, leerCierreEtapa, marcarCampana, celdaDeCampana } = await import('../src/routes/sistemas/juntaCierres.js');

const obra = (datos = {}) => {
    const p = ProduccionProyecto.build({
        id: 77, nombre: 'MA DEL CARMEN GONZALEZ', tipo_proyecto: 'A', etapa_actual: 'produccion', activo: true,
        tiene_manufactura: true, tiene_herreria: true, manufactura_completado: false, herreria_completado: false,
        herreria_armado_completado: false, herreria_pintado_completado: false, ...datos
    });
    p.save = async () => p;
    return p;
};
const dobles = (p) => {
    const avisos = [];
    return { avisos, m: { ProduccionProyecto: { findByPk: async (id) => (id === p.id ? p : null) }, avisar: async (a) => { avisos.push(a.etapa); } } };
};

test('«todo» cierra manufactura y herrería y la obra pasa a Preparado, con su aviso al grupo', async () => {
    const p = obra();
    const { m, avisos } = dobles(p);
    const r = await cerrarEtapa({ proyectoId: 77, etapa: 'todo', quien: 'Carla (junta con Charly)' }, m);
    assert.equal(r.codigo, 200);
    assert.deepEqual(r.cuerpo.cerradas, ['manufactura', 'herreria']);
    assert.equal(r.cuerpo.etapa, 'instalacion');
    assert.equal(p.herreria_pintado_completado, true);
    assert.deepEqual(avisos, ['manufactura', 'herreria']);
});

test('lo que ya estaba cerrado no es error: va en yaEstaban y no se avisa otra vez', async () => {
    const p = obra({ herreria_completado: true, herreria_armado_completado: true, herreria_pintado_completado: true });
    const { m, avisos } = dobles(p);
    const r = await cerrarEtapa({ proyectoId: 77, etapa: 'todo', quien: 'Carla' }, m);
    assert.deepEqual(r.cuerpo.cerradas, ['manufactura']);
    assert.deepEqual(r.cuerpo.yaEstaban, ['herreria']);
    assert.deepEqual(avisos, ['manufactura']);
});

test('solo la pintura: cierra herrería completa si la soldadura ya estaba', async () => {
    const p = obra({ tiene_manufactura: false, herreria_armado_completado: true });
    const { m } = dobles(p);
    const r = await cerrarEtapa({ proyectoId: 77, etapa: 'herreria_pintado', quien: 'Carla' }, m);
    assert.deepEqual(r.cuerpo.cerradas, ['herreria_pintado']);
    assert.equal(p.herreria_completado, true);
    assert.equal(r.cuerpo.etapa, 'instalacion');
});

test('una etapa que la obra no lleva: 409; sin obra: 404; mal pedida: 400', async () => {
    const p = obra({ tiene_herreria: false });
    const { m } = dobles(p);
    assert.equal((await cerrarEtapa({ proyectoId: 77, etapa: 'herreria', quien: 'Carla' }, m)).codigo, 409);
    assert.equal((await cerrarEtapa({ proyectoId: 5, etapa: 'todo', quien: 'Carla' }, m)).codigo, 404);
    assert.equal((await cerrarEtapa({ proyectoId: 77, etapa: 'pintura', quien: 'Carla' }, m)).codigo, 400);
    assert.ok(leerCierreEtapa({ proyectoId: 77, etapa: 'todo' }).error);
    assert.deepEqual(planDeCierre(obra({ tiene_herreria: false }), 'todo').cerrar, ['manufactura']);
});

test('la celda del control: semana ISO y trimestre de 13 semanas', () => {
    assert.deepEqual(celdaDeCampana('2026-11-23'), { year: 2026, week: 48, quarter: 4 });
    assert.deepEqual(celdaDeCampana('2026-01-01'), { year: 2026, week: 1, quarter: 1 });
    assert.deepEqual(celdaDeCampana('2026-04-01'), { year: 2026, week: 14, quarter: 2 });
});

test('marcar ✗: crea la celda, suma notas y no repite la misma', async () => {
    const celdas = new Map();
    const llave = (w) => `${w.year}|${w.quarter}|${w.area}|${w.week}`;
    const m = { CampanaControl: {
        findOne: async ({ where }) => celdas.get(llave(where)) ?? null,
        upsert: async (x) => { celdas.set(llave(x), { status: x.status, note: x.note }); }
    } };
    const a = await marcarCampana({ area: 'manufactura', nota: 'Prepa: triángulo con quemadura', fecha: '2026-11-20', quien: 'Carla' }, m);
    assert.equal(a.codigo, 200);
    assert.equal(a.cuerpo.week, 47);
    assert.equal(a.cuerpo.ya, false);
    const b = await marcarCampana({ area: 'manufactura', nota: 'Pantallas más grandes', fecha: '2026-11-21', quien: 'Carla' }, m);
    assert.match(b.cuerpo.nota, /quemadura\n• Pantallas/);
    const c = await marcarCampana({ area: 'manufactura', nota: 'Pantallas más grandes', fecha: '2026-11-21', quien: 'Carla' }, m);
    assert.equal(c.cuerpo.ya, true);
    assert.equal((await marcarCampana({ area: 'ventas2', nota: 'x', fecha: '2026-11-21', quien: 'Carla' }, m)).codigo, 400);
});
