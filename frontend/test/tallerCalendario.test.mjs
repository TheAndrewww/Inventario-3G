// Calendario · taller (19-oct-2026): manufactura y pintura en la fecha de entrega del panel de producción, soldadura 2 días
// hábiles antes y almacén = órdenes de compra por llegar. Correr: `npm test` desde frontend/.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { armarTaller, juntarTaller, esCampo, esTaller } from '../src/rediseno2/gestion/tallerCalendario.js';

const dia = (x) => `${x.fecha.getFullYear()}-${x.fecha.getMonth() + 1}-${x.fecha.getDate()}`;
const base = { etapa_actual: 'produccion', pausado: false, tiene_manufactura: true, tiene_herreria: true };

describe('armarTaller', () => {
  it('con cita agendada: manufactura y pintura ese día, soldadura 2 días hábiles antes (el domingo no cuenta)', () => {
    const p = { ...base, nombre: 'CONDOMINIOS MAYORCA', _fechaCalendario: true, _fechaInstalacion: '2026-10-20', fecha_limite: '2026-10-19' };
    const t = armarTaller([p], []);
    const por = Object.fromEntries(t.map((x) => [x.proyecto.equipoHora, dia(x)]));
    assert.deepEqual(por, { MANUFACTURA: '2026-10-20', PINTURA: '2026-10-20', SOLDADURA: '2026-10-17' });
  });

  it('sin cita usa la fecha máxima; lo terminado, pausado o cerrado no sale', () => {
    const t = armarTaller([
      { ...base, nombre: 'A', fecha_limite: '2026-10-28', manufactura_completado: true, herreria_armado_completado: true },
      { ...base, nombre: 'B', fecha_limite: '2026-10-28', pausado: true },
      { ...base, nombre: 'C', fecha_limite: '2026-10-28', etapa_actual: 'completado' },
    ], []);
    assert.deepEqual(t.map((x) => [x.proyecto.nombre, x.proyecto.equipoHora, dia(x)]), [['A', 'PINTURA', '2026-10-28']]);
  });

  it('almacén: órdenes con fecha estimada de llegada, en su día', () => {
    const t = armarTaller([], [
      { ticket_id: 'OC-1', estado: 'enviada', fecha_llegada_estimada: '2026-10-23T00:00:00.000Z', proveedor: { nombre: 'TUBERIAS' } },
      { ticket_id: 'OC-2', estado: 'parcial', fecha_llegada_estimada: null },
    ]);
    assert.equal(t.length, 1);
    assert.equal(dia(t[0]), '2026-10-23');
    assert.equal(t[0].proyecto.equipoHora, 'ALMACEN');
    assert.equal(t[0].proyecto.nombre, 'TUBERIAS');
  });
});

describe('juntarTaller', () => {
  it('no repite lo que la hoja ya trae pintado ese día y crea los días que faltan', () => {
    const fecha = new Date(2026, 9, 20);
    const mapa = new Map([['2026-10-20', { clave: '2026-10-20', fecha, numero: 20, proyectos: [{ nombre: 'CONDOMINIOS MAYORCA', equipoHora: 'HERRERIA' }] }]]);
    const taller = [
      { fecha, proyecto: { nombre: 'CONDOMINIOS MAYORCA', equipoHora: 'PINTURA', virtual: true } },
      { fecha, proyecto: { nombre: 'CONDOMINIOS MAYORCA', equipoHora: 'MANUFACTURA', virtual: true } },
      { fecha: new Date(2026, 9, 25), proyecto: { nombre: 'OTRA', equipoHora: 'ALMACEN', virtual: true } },
    ];
    const junto = juntarTaller(mapa, taller);
    assert.deepEqual(junto.get('2026-10-20').proyectos.map((x) => x.equipoHora), ['HERRERIA', 'MANUFACTURA']);
    assert.equal(junto.get('2026-10-25').proyectos.length, 1);
    assert.equal(mapa.get('2026-10-20').proyectos.length, 1, 'no cambia el mapa de la hoja');
  });

  it('campo = equipos; taller = manufactura, herrería, soldadura, pintura y almacén', () => {
    assert.ok(esCampo('EQUIPO IV') && !esCampo('MANUFACTURA'));
    assert.ok(['MANUFACTURA', 'HERRERIA', 'SOLDADURA', 'PINTURA', 'ALMACEN'].every(esTaller) && !esTaller('EQUIPO I'));
  });
});
