// Botón «Regresar Manufactura a producción» (11-nov-2026, pedido de Isa): solo aparece en una obra en Preparado cuya
// última instalación quedó como FALLA en el calendario (hora en rojo). Datos inventados. Correr: `npm test` desde frontend/.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarFechasCalendario, puedeReabrirManufactura } from '../src/utils/produccion.js';

console.log = () => {};
const cita = (fecha, extra = {}) => ({ nombre: 'CLIENTE PRUEBA', cliente: 'MEMBRANA', fecha, hora: '9.00 - 10.00 AM', ...extra });
const obra = (extra = {}) => ({ id: 1, nombre: 'CLIENTE PRUEBA - MEMBRANA TENSILADA II', tipo_proyecto: 'A', etapa_actual: 'instalacion', fecha_limite: '2026-11-09', ...extra });

describe('puedeReabrirManufactura', () => {
  it('obra en Preparado con la hora en rojo en el calendario: sí hay botón', () => {
    const [p] = aplicarFechasCalendario([obra()], [cita('2026-11-10', { equipoHora: 'FALLA', nota: 'No quedó' })], 2026, 11);
    assert.equal(p._fallaInstalacion, true);
    assert.equal(puedeReabrirManufactura(p), true);
  });

  it('sin falla en el calendario: no hay botón', () => {
    const [p] = aplicarFechasCalendario([obra()], [cita('2026-11-10', { equipoHora: 'GERAS' })], 2026, 11);
    assert.equal(puedeReabrirManufactura(p), false);
  });

  it('una falla vieja ya reprogramada no cuenta', () => {
    const [p] = aplicarFechasCalendario([obra()], [cita('2026-11-03', { equipoHora: 'FALLA' }), cita('2026-11-12')], 2026, 11);
    assert.equal(puedeReabrirManufactura(p), false);
  });

  it('solo en Preparado, no pausada, y no MTO ni garantía sin producción', () => {
    const conFalla = { _fallaInstalacion: true };
    assert.equal(puedeReabrirManufactura(obra({ ...conFalla, etapa_actual: 'produccion' })), false);
    assert.equal(puedeReabrirManufactura(obra({ ...conFalla, pausado: true })), false);
    assert.equal(puedeReabrirManufactura(obra({ ...conFalla, tipo_proyecto: 'MTO' })), false);
    assert.equal(puedeReabrirManufactura(obra({ ...conFalla, tipo_proyecto: 'MTO', es_extensivo: true })), true);
    assert.equal(puedeReabrirManufactura(obra({ ...conFalla, es_premium: true })), false);
  });
});
