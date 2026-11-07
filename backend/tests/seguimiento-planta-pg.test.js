/**
 * Seguimiento de Planta contra un Postgres de verdad (prueba de integración, opcional; revisión del 6-nov-2026). Revisa
 * lo que los dobles de seguimiento-planta.test.js solo imitan: que las consultas de pedidos por atender, tickets atorados
 * y tickets por día corran en Postgres con sus fechas, y que el estado de los recordatorios se guarde en `configuracion`.
 *
 * Solo corre con PRUEBA_PG_URL hacia un Postgres LOCAL (127.0.0.1, localhost o [::1]) con las tablas de Planta (por
 * ejemplo una base de prueba creada con los modelos). Sin esa variable, o si no es local, se salta. Escribe pedidos y
 * tickets marcados «PRUEBA-SEG-<pid>» y los borra al terminar, junto con las claves de configuración que toca. Nunca la
 * apuntes a la base de producción.
 *
 *   PRUEBA_PG_URL=postgres://<usuario>:<contraseña>@127.0.0.1:<puerto>/<base de prueba> node --test tests/seguimiento-planta-pg.test.js
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

for (const m of ['log', 'info', 'debug', 'warn', 'error']) console[m] = () => {};

const URL_PG = process.env.PRUEBA_PG_URL || '';
const esLocal = (() => {
    try { return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(URL_PG).hostname); } catch { return false; }
})();
const SALTAR = esLocal ? false : 'sin PRUEBA_PG_URL local: prueba de integración saltada';
const MARCA = `PRUEBA-SEG-${process.pid}`;
const CLAVES = ['pedidos_encargados_recordatorios', 'tickets_drive_alertados', 'pedidos_recordatorio_no_salio', 'avisos_encargado_no_salieron', 'resumen_planta_diario'];

let sequelize;
let S;
let SolicitudAlmacen;
let TicketDrive;
let Configuracion;
let respaldo = [];

before(async () => {
    if (!esLocal) return;
    process.env.DATABASE_URL = URL_PG;
    process.env.WHATSAPP_PUENTE_TOKEN = '';
    ({ sequelize } = await import('../src/config/database.js'));
    ({ default: SolicitudAlmacen } = await import('../src/models/SolicitudAlmacen.js'));
    ({ default: TicketDrive } = await import('../src/models/TicketDrive.js'));
    ({ Configuracion } = await import('../src/models/index.js'));
    await SolicitudAlmacen.sync();
    await TicketDrive.sync();
    await Configuracion.sync();
    // Las claves que toca la prueba se guardan y se regresan como estaban
    respaldo = await Configuracion.findAll({ where: { clave: CLAVES }, raw: true });
    await Configuracion.destroy({ where: { clave: CLAVES } });
    S = await import('../src/services/seguimientoPlanta.service.js');
});

after(async () => {
    if (!sequelize) return;
    await SolicitudAlmacen.destroy({ where: { referencia: { [(await import('sequelize')).Op.like]: `${MARCA}%` } } });
    await TicketDrive.destroy({ where: { proyecto: MARCA } });
    await Configuracion.destroy({ where: { clave: CLAVES } });
    for (const f of respaldo) await Configuracion.create({ clave: f.clave, valor: f.valor, descripcion: f.descripcion });
    await sequelize.close();
});

test('Postgres: pedidos por atender, recordatorio guardado, tickets atorados y por día', { skip: SALTAR }, async () => {
    const ahora = new Date();
    const horas = (h) => new Date(ahora.getTime() - h * 3600000);
    const a = await SolicitudAlmacen.create({ encargado: 'PRUEBA', tipo: 'MATERIAL', texto: `${MARCA} tornillos`, referencia: `${MARCA}-1` });
    await sequelize.query('UPDATE solicitudes_almacen SET created_at = :c WHERE id = :id', { replacements: { c: horas(30), id: a.id } });
    await SolicitudAlmacen.create({ encargado: 'PRUEBA', tipo: 'MATERIAL', texto: `${MARCA} reciente`, referencia: `${MARCA}-2` });

    const propios = (lista) => lista.filter((p) => p.texto.startsWith(MARCA));
    const porAtender = propios(await S.pedidosPorAtender({ ahora, env: {} }));
    assert.deepEqual(porAtender.map((p) => [p.atrasado, p.recordatorios]), [[true, 0], [false, 0]]);

    const enviados = [];
    const r = await S.recordarPedidos({ ahora, env: { PLANTA_SEGUIMIENTO: 'pedidos' }, enviar: async (m) => { enviados.push(m); return true; }, notificar: async () => {} });
    assert.ok(r.recordados >= 1);
    assert.match(enviados[0], new RegExp(`${MARCA} tornillos`));
    const guardado = JSON.parse((await Configuracion.findOne({ where: { clave: 'pedidos_encargados_recordatorios' } })).valor);
    assert.equal(guardado[a.id].veces, 1);

    const t1 = await TicketDrive.create({ movimiento_id: 900000000 + process.pid % 1000000, ticket_id: `${MARCA}-T1`, proyecto: MARCA, estado: 'error', ultimo_error: 'Drive caído' });
    await sequelize.query('UPDATE tickets_drive SET created_at = :c WHERE id = :id', { replacements: { c: horas(2), id: t1.id } });
    await TicketDrive.create({ movimiento_id: 900000001 + process.pid % 1000000, ticket_id: `${MARCA}-T2`, proyecto: MARCA, estado: 'subido', subido_en: ahora });
    const atorados = (await S.ticketsAtorados({ ahora })).filter((t) => t.proyecto === MARCA);
    assert.deepEqual(atorados.map((t) => t.ticket_id), [`${MARCA}-T1`]);
    const campanas = [];
    await S.alertarTicketsAtorados({ ahora, env: { PLANTA_SEGUIMIENTO: 'tickets' }, notificar: async (n) => { campanas.push(n); } });
    assert.ok(campanas.some((c) => c.mensaje.includes(`${MARCA}-T1`)));
    // La cuenta sin tope y lo de más de 7 días (verificación del 6-nov-2026), con Op.notIn y count de verdad
    const viejo = await TicketDrive.create({ movimiento_id: 900000002 + process.pid % 1000000, ticket_id: `${MARCA}-T3`, proyecto: MARCA, estado: 'pendiente' });
    await sequelize.query('UPDATE tickets_drive SET created_at = :c WHERE id = :id', { replacements: { c: horas(9 * 24), id: viejo.id } });
    const cuenta = await S.contarTicketsSinSubir({ ahora });
    assert.ok(cuenta.sinSubir >= 1 && cuenta.masDe7Dias >= 1, JSON.stringify(cuenta));
    const sinAvisar = (await S.ticketsAtorados({ ahora, excluir: [t1.movimiento_id] })).filter((t) => t.proyecto === MARCA);
    assert.deepEqual(sinAvisar, [], 'el ya avisado no se vuelve a tomar');
    const otraVuelta = [];
    await S.alertarTicketsAtorados({ ahora, env: { PLANTA_SEGUIMIENTO: 'tickets' }, notificar: async (n) => { otraVuelta.push(n); } });
    assert.ok(!otraVuelta.some((c) => c.mensaje.includes(`${MARCA}-T1`)), 'cada ticket se avisa una vez');
    // Un recordatorio que no sale queda anotado en configuración y la puerta lo dice
    const b = await SolicitudAlmacen.create({ encargado: 'PRUEBA', tipo: 'MATERIAL', texto: `${MARCA} sin salir`, referencia: `${MARCA}-3` });
    await sequelize.query('UPDATE solicitudes_almacen SET created_at = :c WHERE id = :id', { replacements: { c: horas(10), id: b.id } });
    const sinSalir = await S.recordarPedidos({ ahora, env: { PLANTA_SEGUIMIENTO: 'pedidos' }, enviar: async () => false, notificar: async () => { throw new Error('campana caída'); } });
    assert.equal(sinSalir.recordados, 0);
    const anotado = JSON.parse((await Configuracion.findOne({ where: { clave: 'pedidos_recordatorio_no_salio' } })).valor);
    assert.equal(anotado.salioPor, null);

    const dias = await S.ticketsPorDia({ dias: 3, ahora });
    assert.equal(dias.length, 3);
    assert.ok(dias.reduce((s, d) => s + d.subidos, 0) >= 1);

    const p = await S.pendientesDePlanta({ ahora, env: {} });
    assert.ok(!p.avisos.some((x) => x.startsWith('No se pud')), `pedidos, tickets y avisos se leyeron: ${p.avisos.join(' | ')}`);
    assert.ok(p.avisos.some((x) => x.includes('no salió (ni WhatsApp ni campana)')));
    assert.ok(p.tickets.masDe7Dias >= 1);
    assert.ok(p.pedidos.lista.some((x) => x.texto.startsWith(MARCA)));
});

// Vuelta 1 de la verificación integrada: lo mismo que el verificador reprodujo por HTTP (alta, borrar, contestar), ahora
// con el controlador y la tabla de verdad; y el resumen de las 8:00 que no sale queda en `configuracion`.
test('Postgres: contestar un pedido que el administrador quitó da 404 y no lo revive; el resumen que no sale queda anotado', { skip: SALTAR }, async () => {
    const { borrarPedidoEncargado, responderPedidoEncargado } = await import('../src/controllers/pedidosEncargados.controller.js');
    const res = () => ({ status(c) { this.codigo = c; return this; }, json(b) { this.cuerpo = b; return this; } });
    const p = await SolicitudAlmacen.create({ encargado: 'PRUEBA', tipo: 'MATERIAL', texto: `${MARCA} quitado`, referencia: `${MARCA}-4` });
    const r1 = res();
    await borrarPedidoEncargado({ params: { id: String(p.id) }, usuario: { nombre: 'Admin' } }, r1);
    assert.equal(r1.cuerpo.success, true);
    const r2 = res();
    await responderPedidoEncargado({ params: { id: String(p.id) }, body: { estado: 'surtida' }, usuario: { nombre: 'Charly' } }, r2);
    assert.equal(r2.codigo, 404);
    assert.equal((await SolicitudAlmacen.findByPk(p.id)).estado, 'cancelada');

    const ahora = new Date();
    const r = await S.enviarResumenDiario({ ahora, env: { PLANTA_SEGUIMIENTO: 'resumen' }, notificar: async () => { throw new Error('campana caída'); } });
    assert.equal(r.enviado, false);
    const anotado = JSON.parse((await Configuracion.findOne({ where: { clave: 'resumen_planta_diario' } })).valor);
    assert.equal(anotado.noSalio.intentos, 1);
    const q = await S.pendientesDePlanta({ ahora, env: {} });
    assert.ok(q.avisos.some((x) => x.startsWith('El resumen de las 8:00 al administrador de hoy no salió')), q.avisos.join(' | '));
});
