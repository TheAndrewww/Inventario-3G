/**
 * Carla cierra el ticket que Charly ya surtió (13-nov-2026): POST /api/sistemas/v1/almacen/tickets/:folio/cerrar.
 * Sin base de datos: modelos en memoria.
 * Correr:  cd backend && npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

for (const m of ['log', 'info', 'debug']) console[m] = () => {};
process.env.DATABASE_URL = 'postgres://prueba:prueba@127.0.0.1:9/prueba_sin_base';
process.env.WHATSAPP_PUENTE_TOKEN = '';

const { leerCierreTicket, cerrarTicket } = await import('../src/routes/sistemas/tickets.js');

const enMemoria = (estado = 'pendiente') => {
    const pedido = { id: 7, ticket_id: 'PED-131126-0357-02', tipo: 'pedido', estado, proyecto: 'RAMSES GRANADOS MORONES', async update(d) { Object.assign(this, d); } };
    const detalles = [{ movimiento_id: 7, dispersado: false }, { movimiento_id: 7, dispersado: true }];
    const avisos = [];
    return {
        pedido, detalles, avisos,
        m: {
            sequelize: { transaction: async () => ({ commit: async () => {}, rollback: async () => {} }) },
            Movimiento: { findOne: async ({ where }) => (where.ticket_id === pedido.ticket_id && where.tipo === 'pedido' ? pedido : null) },
            DetalleMovimiento: { update: async (d, { where }) => { for (const x of detalles) if (x.movimiento_id === where.movimiento_id && x.dispersado === where.dispersado) Object.assign(x, d); } },
            avisar: async (a) => { avisos.push(a); },
        },
    };
};

test('revisa folio y quien', () => {
    assert.ok(leerCierreTicket('xx', { quien: 'Carla' }).error);
    assert.ok(leerCierreTicket('PED-131126-0357-02', {}).error);
    assert.deepEqual(leerCierreTicket('ped-131126-0357-02', { quien: ' Carla ' }), { folio: 'PED-131126-0357-02', quien: 'Carla', motivo: null });
});

test('cierra un ticket abierto: artículos dispersados, entregado y aviso a producción', async () => {
    const x = enMemoria('aprobado');
    const r = await cerrarTicket('PED-131126-0357-02', { quien: 'Carla (lo surtió Charly)' }, x.m);
    assert.equal(r.codigo, 200);
    assert.equal(r.cuerpo.ya, false);
    assert.equal(x.pedido.estado, 'entregado');
    assert.ok(x.detalles.every((d) => d.dispersado));
    assert.deepEqual(x.avisos, [{ proyecto: 'RAMSES GRANADOS MORONES', recibio: 'Carla (lo surtió Charly)' }]);
});

test('ya cerrado: no cambia nada ni avisa', async () => {
    const x = enMemoria('entregado');
    const r = await cerrarTicket('PED-131126-0357-02', { quien: 'Carla' }, x.m);
    assert.equal(r.codigo, 200);
    assert.equal(r.cuerpo.ya, true);
    assert.equal(x.avisos.length, 0);
    assert.equal(x.detalles[0].dispersado, false);
});

test('folio que no existe: 404', async () => {
    const r = await cerrarTicket('PED-000000-0000-00', { quien: 'Carla' }, enMemoria().m);
    assert.equal(r.codigo, 404);
});
