// Un solo vocabulario del calendario (6-nov-2026): el tablero decide retiro y cimentación con lo que manda el backend en
// cada cita (esRetiro, esCimentacion, unaFecha; backend/src/utils/vocabularioCalendario.js), igual que la agenda.
// Datos inventados. Correr: `npm test` desde frontend/.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarFechasCalendario } from '../src/utils/produccion.js';

console.log = () => {};
const cita = (nombre, cliente, fecha, extra = {}) => ({ nombre, cliente, fecha, hora: '9.00 - 10.00 AM', ...extra });

describe('aplicarFechasCalendario con el vocabulario del backend', () => {
  it('sin los campos nuevos (backend de antes) decide como siempre', () => {
    const [p] = aplicarFechasCalendario([{ id: 1, nombre: 'ROSA PEREZ', fecha_limite: '2026-11-25' }],
      [cita('ROSA PEREZ', 'RETIRAR LONA', '2026-11-12')], 2026, 11);
    assert.equal(p._fechaInstalacion, '2026-11-12', '«RETIRAR» no es la palabra exacta RETIRO');
  });

  it('esRetiro del backend manda: «RETIRAR LONA» marcada como retiro no es la instalación', () => {
    const [p] = aplicarFechasCalendario([{ id: 1, nombre: 'ROSA PEREZ', fecha_limite: '2026-11-25' }],
      [cita('ROSA PEREZ', 'RETIRAR LONA', '2026-11-12', { esRetiro: true, esCimentacion: false, unaFecha: true })], 2026, 11);
    assert.equal(p._fechaCalendario, undefined);
    assert.equal(p.fecha_limite, '2026-11-25');
  });

  it('bandera apagada (unaFecha false): la cimentación no da fecha y la obra se queda con la del Índice, como hoy', () => {
    const [p] = aplicarFechasCalendario([{ id: 2, nombre: 'COLEGIO NORTE', fecha_limite: '2026-11-10' }],
      [cita('COLEGIO NORTE', 'GTIA / CIMENTACIÓN', '2026-11-10', { esRetiro: false, esCimentacion: true, unaFecha: false })], 2026, 11);
    assert.equal(p.fecha_limite, '2026-11-10');
    assert.equal(p._sinFechaPorCimentacion, undefined);
  });

  it('bandera encendida: cimentación el día del Índice o después → sin fecha, igual que la agenda y la puerta', () => {
    const citas = ['2026-11-10', '2026-11-11'].map((f) => cita('COLEGIO NORTE', 'GTIA / CIMENTACIÓN', f, { esRetiro: false, esCimentacion: true, unaFecha: true }));
    const [p] = aplicarFechasCalendario([{ id: 2, nombre: 'COLEGIO NORTE', fecha_limite: '2026-11-10' }], citas, 2026, 11);
    assert.equal(p.fecha_limite, null);
    assert.equal(p._sinFechaPorCimentacion, '2026-11-11');
    // Cuando aparece la instalación, manda el calendario
    const [q] = aplicarFechasCalendario([{ id: 2, nombre: 'COLEGIO NORTE', fecha_limite: '2026-11-10' }],
      [...citas, cita('COLEGIO NORTE', 'GTIA', '2026-11-14', { esRetiro: false, esCimentacion: false, unaFecha: true })], 2026, 11);
    assert.equal(q._fechaInstalacion, '2026-11-14');
    // Una cimentación ANTES de la fecha del Índice no la borra
    const [r] = aplicarFechasCalendario([{ id: 3, nombre: 'PARQUE SUR', fecha_limite: '2026-11-20' }],
      [cita('PARQUE SUR', 'CIMENTACIÓN', '2026-11-05', { esRetiro: false, esCimentacion: true, unaFecha: true })], 2026, 11);
    assert.equal(r.fecha_limite, '2026-11-20');
  });
});
