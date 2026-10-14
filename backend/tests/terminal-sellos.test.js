/**
 * Terminal de producción: qué etapa queda marcada al cerrar Diseño y Compras.
 *
 * El tablero (toggleEtapa), la línea de tiempo, los filtros y regresarEtapa leen
 * «diseno_completado_en» como «Diseño terminado» y «compras_completado_en» como «Compras terminado».
 * completarEtapaActual (lo que usa la terminal) sellaba la etapa SIGUIENTE: al cerrar Diseño el
 * tablero mostraba Compras en verde y Diseño sin marcar.
 *
 * Sin base de datos: el proyecto se arma en memoria y save() no escribe.
 * Correr:  cd backend && npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Lo que el servidor escribe con console.log (emojis, el aviso de dotenv) va por el mismo canal que usa
// `node --test` para sus resultados y a veces lo rompe («Unable to deserialize cloned data»). Se calla aquí;
// console.error (stderr) sigue saliendo.
for (const m of ['log', 'info', 'debug']) console[m] = () => {};

process.env.DATABASE_URL = 'postgres://prueba:prueba@127.0.0.1:9/prueba_sin_base';
process.env.WHATSAPP_PUENTE_TOKEN = '';

const { ProduccionProyecto } = await import('../src/models/index.js');

const proyectoEnMemoria = (datos) => {
    const p = ProduccionProyecto.build({ nombre: 'Obra de prueba', tipo_proyecto: 'A', ...datos });
    p.save = async () => p; // sin base
    return p;
};

test('cerrar Diseño marca Diseño (no Compras) y pasa a Compras', async () => {
    const p = proyectoEnMemoria({ etapa_actual: 'diseno' });

    await p.completarEtapaActual(null, 'Planos listos');

    assert.equal(p.etapa_actual, 'compras');
    assert.ok(p.diseno_completado_en instanceof Date, 'Diseño debe quedar marcado');
    assert.equal(p.compras_completado_en ?? null, null, 'Compras no debe marcarse todavía');
    assert.equal(p.observaciones_diseno, 'Planos listos');
});

test('cerrar Compras marca Compras (no Producción) y pasa a Producción', async () => {
    const p = proyectoEnMemoria({ etapa_actual: 'compras', diseno_completado_en: new Date('2026-10-01T12:00:00Z') });

    await p.completarEtapaActual(null);

    assert.equal(p.etapa_actual, 'produccion');
    assert.ok(p.compras_completado_en instanceof Date, 'Compras debe quedar marcado');
    assert.equal(p.produccion_completado_en ?? null, null);
});

test('cerrar Diseño y luego regresar deja el proyecto como estaba (nada marcado)', async () => {
    const p = proyectoEnMemoria({ etapa_actual: 'diseno' });

    await p.completarEtapaActual(null);
    await p.regresarEtapa(null);

    assert.equal(p.etapa_actual, 'diseno');
    assert.equal(p.diseno_completado_en ?? null, null);
    assert.equal(p.compras_completado_en ?? null, null, 'antes quedaba Compras marcado de más');
});

test('sin cambio: Producción → Completado (instalacion) sella instalacion_completado_en y las sub-etapas', async () => {
    const p = proyectoEnMemoria({ etapa_actual: 'produccion' });

    await p.completarEtapaActual(null);

    assert.equal(p.etapa_actual, 'instalacion');
    assert.ok(p.instalacion_completado_en instanceof Date);
    assert.equal(p.manufactura_completado, true);
    assert.equal(p.herreria_completado, true);
});
