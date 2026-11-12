/**
 * Reabrir Manufactura de una obra en Preparado cuando su instalación falló (11-nov-2026, pedido de Isa).
 *
 * Solo con FALLA en la última instalación del calendario (la hora en rojo); el motivo es el comentario de la falla y
 * queda en el historial de reaperturas con los sellos que se quitan. Herrería no se toca.
 *
 * Sin base de datos ni Sheets: el proyecto se arma en memoria y el calendario se pasa a mano.
 * Correr:  cd backend && npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

for (const m of ['log', 'info', 'debug']) console[m] = () => {};

process.env.DATABASE_URL = 'postgres://prueba:prueba@127.0.0.1:9/prueba_sin_base';
process.env.WHATSAPP_PUENTE_TOKEN = '';

const { ProduccionProyecto } = await import('../src/models/index.js');
const { fallaDeInstalacion } = await import('../src/services/fechaInstalacion.service.js');
const { reabrirManufacturaPorFalla, ErrorReapertura } = await import('../src/services/reaperturaManufactura.service.js');

const HOY = '2026-11-11';
const LISTA = new Date('2026-11-03T18:00:00Z');
const PREPARADO = new Date('2026-11-04T18:00:00Z');

const proyectoEnMemoria = (datos = {}) => {
    const p = ProduccionProyecto.build({
        id: 605, nombre: 'CLIENTE PRUEBA - MEMBRANA TENSILADA II', tipo_proyecto: 'A', etapa_actual: 'instalacion',
        tiene_manufactura: true, tiene_herreria: true,
        manufactura_completado: true, manufactura_completado_en: LISTA, manufactura_completado_por: 7,
        herreria_completado: true, herreria_completado_en: LISTA, herreria_completado_por: 8,
        herreria_armado_completado: true, herreria_pintado_completado: true,
        diseno_completado_en: new Date('2026-10-01T18:00:00Z'), compras_completado_en: new Date('2026-10-10T18:00:00Z'),
        instalacion_completado_en: PREPARADO, instalacion_completado_por: 7,
        ...datos
    });
    p.save = async () => p; // sin base
    return p;
};

const cita = (fecha, extra = {}) => ({ nombre: 'CLIENTE PRUEBA', cliente: 'MEMBRANA TENSILADA II', fecha, hora: '9.00 - 10.00 AM', ...extra });

// ---------- La falla según el calendario ----------

test('falla en la última instalación: true, con su fecha y el comentario de la celda', () => {
    const p = proyectoEnMemoria();
    const r = fallaDeInstalacion(p, [p], [cita('2026-11-10', { equipoHora: 'FALLA', nota: 'La membrana no cerró: ajuste de producción' })], { hoy: HOY });
    assert.deepEqual(r, { falla: true, fecha: '2026-11-10', nota: 'La membrana no cerró: ajuste de producción' });
});

test('sin hora en rojo no hay falla', () => {
    const p = proyectoEnMemoria();
    const r = fallaDeInstalacion(p, [p], [cita('2026-11-10', { equipoHora: 'GERAS' })], { hoy: HOY });
    assert.equal(r.falla, false);
});

test('una falla vieja que ya se reprogramó no cuenta: manda la cita nueva', () => {
    const p = proyectoEnMemoria();
    const r = fallaDeInstalacion(p, [p], [
        cita('2026-11-03', { equipoHora: 'FALLA', nota: 'vieja' }),
        cita('2026-11-12', { equipoHora: 'GERAS' })
    ], { hoy: HOY });
    assert.equal(r.falla, false);
});

test('el retiro en rojo no es la instalación', () => {
    const p = proyectoEnMemoria();
    const r = fallaDeInstalacion(p, [p], [
        cita('2026-11-05'),
        cita('2026-11-10', { cliente: 'RETIRO', equipoHora: 'FALLA' })
    ], { hoy: HOY });
    assert.equal(r.falla, false);
});

test('una obra que no está en el calendario no tiene falla', () => {
    const p = proyectoEnMemoria();
    const r = fallaDeInstalacion(p, [p], [{ nombre: 'OTRA OBRA', fecha: '2026-11-10', hora: '9.00', equipoHora: 'FALLA' }], { hoy: HOY });
    assert.equal(r.falla, false);
});

// ---------- Reabrir ----------

const contexto = (p, falla, extra = {}) => {
    const anotadas = [];
    return {
        anotadas,
        ctx: {
            buscar: async (n) => (n === p.id ? p : null),
            leerFalla: async () => falla,
            enTransaccion: async (fn) => fn('tx'),
            anotar: async (id, entrada, opciones) => anotadas.push({ id, entrada, opciones }),
            ahora: new Date('2026-11-11T17:00:00Z'),
            quien: 'Isa', usuarioId: 3,
            ...extra
        }
    };
};

const conCodigo = (codigo) => (e) => e instanceof ErrorReapertura && e.codigo === codigo;

test('con falla: la obra regresa a producción con Manufactura pendiente; Herrería y las demás etapas no se tocan', async () => {
    const p = proyectoEnMemoria();
    const { ctx, anotadas } = contexto(p, { falla: true, fecha: '2026-11-10', nota: 'No quedó: ajuste de producción' });

    const { reapertura } = await reabrirManufacturaPorFalla('605', ctx);

    assert.equal(p.etapa_actual, 'produccion');
    assert.equal(p.manufactura_completado, false);
    assert.equal(p.manufactura_completado_en, null);
    assert.equal(p.instalacion_completado_en, null);
    assert.equal(p.herreria_completado, true);
    assert.equal(p.herreria_completado_en, LISTA);
    assert.ok(p.diseno_completado_en && p.compras_completado_en, 'Diseño y Compras siguen marcados');

    assert.equal(anotadas.length, 1);
    assert.equal(anotadas[0].id, 605);
    assert.deepEqual(anotadas[0].opciones, { transaction: 'tx' });
    assert.equal(reapertura.motivo, 'No quedó: ajuste de producción');
    assert.equal(reapertura.motivoCalendario, 'No quedó: ajuste de producción');
    assert.equal(reapertura.fechaFalla, '2026-11-10');
    assert.equal(reapertura.quien, 'Isa');
    assert.equal(reapertura.origen, 'web');
    // Los sellos que se quitaron quedan en el historial
    assert.equal(reapertura.antes.manufactura_completado_en, LISTA.toISOString());
    assert.equal(reapertura.antes.instalacion_completado_en, PREPARADO.toISOString());
});

test('sin comentario en el calendario el motivo dice que fue falla de instalación', async () => {
    const p = proyectoEnMemoria();
    const { ctx } = contexto(p, { falla: true, fecha: '2026-11-10', nota: null });
    const { reapertura } = await reabrirManufacturaPorFalla(605, ctx);
    assert.match(reapertura.motivo, /Falla en la instalación/);
    assert.equal(reapertura.motivoCalendario, null);
});

test('otro sistema puede dar otro motivo; el del calendario se guarda igual', async () => {
    const p = proyectoEnMemoria();
    const { ctx } = contexto(p, { falla: true, fecha: '2026-11-10', nota: 'del calendario' }, { origen: 'sofia', motivo: '  Pidió Isa: rehacer lona  ' });
    const { reapertura } = await reabrirManufacturaPorFalla(605, ctx);
    assert.equal(reapertura.motivo, 'Pidió Isa: rehacer lona');
    assert.equal(reapertura.motivoCalendario, 'del calendario');
    assert.equal(reapertura.origen, 'sofia');
});

test('sin falla en el calendario no se reabre (409) y la obra se queda en Preparado', async () => {
    const p = proyectoEnMemoria();
    const { ctx, anotadas } = contexto(p, { falla: false, fecha: null, nota: null });
    await assert.rejects(reabrirManufacturaPorFalla(605, ctx), conCodigo(409));
    assert.equal(p.etapa_actual, 'instalacion');
    assert.equal(p.manufactura_completado, true);
    assert.equal(anotadas.length, 0);
});

test('solo obras en Preparado (409), no MTO ni garantía (409), y la que no existe es 404', async () => {
    const enProduccion = proyectoEnMemoria({ etapa_actual: 'produccion' });
    await assert.rejects(reabrirManufacturaPorFalla(605, contexto(enProduccion, { falla: true }).ctx), conCodigo(409));
    const mto = proyectoEnMemoria({ tipo_proyecto: 'MTO' });
    await assert.rejects(reabrirManufacturaPorFalla(605, contexto(mto, { falla: true }).ctx), conCodigo(409));
    const p = proyectoEnMemoria();
    await assert.rejects(reabrirManufacturaPorFalla(999, contexto(p, { falla: true }).ctx), conCodigo(404));
    await assert.rejects(reabrirManufacturaPorFalla('abc', contexto(p, { falla: true }).ctx), conCodigo(404));
});

test('si el calendario no se puede leer, no se reabre (503)', async () => {
    const p = proyectoEnMemoria();
    const { ctx } = contexto(p, null, { leerFalla: async () => { throw new Error('cuota de Sheets'); } });
    await assert.rejects(reabrirManufacturaPorFalla(605, ctx), conCodigo(503));
    assert.equal(p.etapa_actual, 'instalacion');
});

test('cuando Manufactura vuelve a terminar, la obra regresa a Preparado como siempre', async () => {
    const p = proyectoEnMemoria();
    await reabrirManufacturaPorFalla(605, contexto(p, { falla: true, fecha: '2026-11-10', nota: 'x' }).ctx);
    const r = await p.completarSubEtapaProduccion('manufactura', 7);
    assert.equal(r.autoAvanzado, true);
    assert.equal(p.etapa_actual, 'instalacion');
});
