import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumenProduccion } from '../src/services/fechaInstalacion.service.js';

test('un área pendiente manda sobre la etapa: Preparado con manufactura nueva no es «producción lista»', () => {
    const r = resumenProduccion({ etapa_actual: 'instalacion', tiene_manufactura: true, manufactura_completado: false, tiene_herreria: true, herreria_completado: true });
    assert.deepEqual(r.pendientes, ['manufactura']);
    assert.equal(r.produccion_cerrada, false);
});

test('Preparado sin pendientes sigue cerrada; sin planos solo la cierra la etapa', () => {
    assert.equal(resumenProduccion({ etapa_actual: 'instalacion', tiene_manufactura: true, manufactura_completado: true }).produccion_cerrada, true);
    assert.equal(resumenProduccion({ etapa_actual: 'instalacion' }).produccion_cerrada, true);
    assert.equal(resumenProduccion({ etapa_actual: 'diseno' }).produccion_cerrada, false);
    assert.equal(resumenProduccion({ etapa_actual: 'produccion', tiene_herreria: true, herreria_completado: true }).produccion_cerrada, true);
});

test('«Proyecto completado» en un renglón', async () => {
    const { construirAvisoProyectoCompletado } = await import('../src/services/avisosProduccion.service.js');
    assert.equal(construirAvisoProyectoCompletado({ proyecto: 'ARACELY GOMEZ ROMERO / MTO' }),
        '🏁 *Proyecto completado* ARACELY GOMEZ ROMERO / MTO. Listo para confirmar');
});
