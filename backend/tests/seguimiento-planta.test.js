/**
 * Seguimiento automático de Planta (revisión del 6-nov-2026, punto 9 c, d y e): recordatorio a Almacén con plazo y
 * salida segura, aviso al encargado, «borrar» que llega a la tableta, tickets que no llegan a Drive en una hora, tickets
 * por día y la puerta «pendientes de Planta». Sin base de datos: modelos en memoria. Datos inventados.
 * Correr:  cd backend && npm test
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

for (const m of ['log', 'info', 'debug', 'error']) console[m] = () => {};
process.env.DATABASE_URL = 'postgres://prueba:prueba@127.0.0.1:9/prueba_sin_base';
process.env.WHATSAPP_PUENTE_TOKEN = '';

const { Op } = await import('sequelize');
const S = await import('../src/services/seguimientoPlanta.service.js');

afterEach(() => { delete process.env.PLANTA_SEGUIMIENTO; delete process.env.PEDIDOS_RECORDAR_HORAS; });

// ---------- Piezas en memoria ----------
const cumple = (valor, cond) => {
    if (cond && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)) {
        return Object.getOwnPropertySymbols(cond).every((op) => {
            const c = cond[op];
            if (op === Op.in) return c.includes(valor);
            if (op === Op.notIn) return !c.includes(valor);
            if (op === Op.lt) return valor != null && new Date(valor) < c;
            if (op === Op.gte) return valor != null && new Date(valor) >= c;
            if (op === Op.lte) return valor != null && new Date(valor) <= c;
            if (op === Op.gt) return valor != null && new Date(valor) > c;
            throw new Error('operador no previsto en la prueba');
        });
    }
    return valor === cond;
};
const pasa = (fila, where = {}) => Object.entries(where).every(([k, v]) => cumple(fila[k], v))
    && (where[Op.or] ? where[Op.or].some((w) => pasa(fila, w)) : true);
const modelo = (filas) => ({
    filas,
    // Como Sequelize: respeta el orden por fecha y el tope (limit) que pida la consulta
    findAll: async ({ where, limit, order } = {}) => {
        const lista = filas.filter((f) => pasa(f, where));
        if (order?.[0]?.[0] === 'created_at') lista.sort((a, b) => (order[0][1] === 'DESC' ? -1 : 1) * (a.created_at - b.created_at));
        return limit ? lista.slice(0, limit) : lista;
    },
    count: async ({ where } = {}) => filas.filter((f) => pasa(f, where)).length
});
const configuracion = () => {
    const datos = new Map();
    return {
        datos,
        findOne: async ({ where }) => (datos.has(where.clave) ? { valor: datos.get(where.clave) } : null),
        findOrCreate: async ({ where, defaults }) => {
            if (datos.has(where.clave)) {
                return [{ valor: datos.get(where.clave), update: async ({ valor }) => { datos.set(where.clave, valor); } }, false];
            }
            datos.set(where.clave, defaults.valor);
            return [{ valor: defaults.valor }, true];
        }
    };
};
const reloj = (iso) => new Date(iso);
const ENCENDIDO = { PLANTA_SEGUIMIENTO: '1' };

test('PLANTA_SEGUIMIENTO: apagada por omisión; «1» enciende todo; también acepta una lista', () => {
    assert.deepEqual([...S.piezasSeguimiento({})], []);
    assert.deepEqual([...S.piezasSeguimiento({ PLANTA_SEGUIMIENTO: '0' })], []);
    assert.deepEqual([...S.piezasSeguimiento({ PLANTA_SEGUIMIENTO: '1' })], ['resumen', 'pedidos', 'encargado', 'tickets']);
    assert.deepEqual([...S.piezasSeguimiento({ PLANTA_SEGUIMIENTO: 'pedidos, tickets, otra' })], ['pedidos', 'tickets']);
    assert.equal(S.horasParaRecordar({}), 4);
    assert.equal(S.horasParaRecordar({ PEDIDOS_RECORDAR_HORAS: '6' }), 6);
    assert.equal(S.horasParaRecordar({ PEDIDOS_RECORDAR_HORAS: '500' }), 4, 'fuera de 1 a 72 se queda en 4');
});

const pedido = (id, creado, extra = {}) => ({ id, encargado: 'PRUEBA', tipo: 'MATERIAL', texto: 'tornillos de prueba', estado: 'pendiente', created_at: new Date(creado), ...extra });

test('recordatorio a Almacén: a las X horas, una vez al día, dos días; después VENCIDO y ya no se insiste', async () => {
    const pedidos = modelo([pedido(3, '2026-10-31T17:00:00Z', { para_fecha: '2026-11-20' }), pedido(4, '2026-11-02T16:30:00Z')]);
    const cfg = configuracion();
    const enviados = [];
    const campanas = [];
    const piezas = { modelo: pedidos, cfg, env: ENCENDIDO, enviar: async (m, d) => { enviados.push([d, m]); return true; }, notificar: async (n) => { campanas.push(n); } };

    // Apagada: nada
    assert.deepEqual(await S.recordarPedidos({ ...piezas, env: {}, ahora: reloj('2026-11-02T18:00:00Z') }), { recordados: 0, vencidos: 0, apagada: true });

    // Día 1, 12:00 de México: el #3 lleva días; el #4 apenas 1.5 h → solo el #3
    let r = await S.recordarPedidos({ ...piezas, ahora: reloj('2026-11-02T18:00:00Z') });
    assert.equal(r.recordados, 1);
    assert.equal(enviados.length, 1);
    assert.equal(enviados[0][0], 'requisiciones');
    assert.match(enviados[0][1], /Pedidos de encargados sin atender\* \(1\)/);
    assert.match(enviados[0][1], /Prueba · Material: tornillos de prueba · para el 20 nov/);
    assert.deepEqual(campanas[0].roles, ['almacen']);
    // Misma hora de otro día no; misma día más tarde: el #4 ya pasó 4 h, el #3 ya se recordó hoy
    r = await S.recordarPedidos({ ...piezas, ahora: reloj('2026-11-02T23:00:00Z') });
    assert.equal(r.recordados, 1);
    assert.match(enviados[1][1], /\(1\)/);
    assert.doesNotMatch(enviados[1][1], /20 nov/, 'el #3 no se repite el mismo día');
    // Día 2: los dos otra vez (segunda vez de cada uno)
    r = await S.recordarPedidos({ ...piezas, ahora: reloj('2026-11-03T16:00:00Z') });
    assert.equal(r.recordados, 2);
    // Día 3: el #3 ya va en su máximo → vencido, ya no se le recuerda a Almacén
    r = await S.recordarPedidos({ ...piezas, ahora: reloj('2026-11-04T16:00:00Z') });
    assert.equal(r.recordados, 0);
    assert.equal(r.vencidos, 2);
    assert.equal(enviados.length, 3);
    const estado = JSON.parse(cfg.datos.get('pedidos_encargados_recordatorios'));
    assert.deepEqual(estado['3'], { veces: 2, ultimo: '2026-11-03' });
});

test('recordatorio que no sale: no cuenta, se reintenta y la puerta lo dice; una campana que falla ya no repite el WhatsApp', async () => {
    const pedidos = modelo([pedido(3, '2026-10-31T17:00:00Z')]);
    const cfg = configuracion();
    const enviados = [];
    const vacio = modelo([]);
    const puerta = (ahora) => S.pendientesDePlanta({ ahora: reloj(ahora), modelos: { pedidos, tickets: vacio }, cfg, env: {} });
    const vuelta = (ahora, enviar, notificar) => S.recordarPedidos({ modelo: pedidos, cfg, env: ENCENDIDO, ahora: reloj(ahora), enviar, notificar });
    const falla = async () => { throw new Error('base caída'); };
    const veces = () => JSON.parse(cfg.datos.get('pedidos_encargados_recordatorios'))['3'];

    // Tres días sin que salga nada (WhatsApp apagado y campana caída): no se cuenta, así que no queda «vencido»
    for (const dia of ['2026-11-02', '2026-11-03', '2026-11-04']) {
        const r = await vuelta(`${dia}T16:00:00Z`, async () => false, falla);
        assert.deepEqual([r.recordados, r.porWhatsApp, r.porCampana], [0, false, false], dia);
    }
    assert.deepEqual(veces(), { veces: 0, ultimo: null });
    let p = await puerta('2026-11-04T17:00:00Z');
    assert.equal(p.pedidos.vencidos, 0, 'no salió nada: no se puede dar por recordado');
    assert.equal(p.avisosNoSalieron.recordatorioAlmacen.salioPor, null);
    assert.ok(p.avisos.some((a) => /^El recordatorio a Almacén de las 10:00 no salió \(ni WhatsApp ni campana\): .*Se reintenta cada hora$/.test(a)), p.avisos.join(' | '));
    const resumen = [];
    await S.enviarResumenDiario({ ahora: reloj('2026-11-04T17:00:00Z'), env: ENCENDIDO, notificar: async (n) => { resumen.push(n); }, armar: async () => p });
    assert.match(resumen[0].mensaje, /⚠️ El recordatorio a Almacén de las 10:00 no salió/, 'el resumen de las 8:00 también lo dice');

    // La siguiente vuelta (misma día) sí sale por la campana: ahora cuenta, y se dice que el WhatsApp no salió
    let r = await vuelta('2026-11-04T17:00:00Z', async () => false, async () => {});
    assert.deepEqual([r.recordados, r.porWhatsApp, r.porCampana], [1, false, true]);
    assert.deepEqual(veces(), { veces: 1, ultimo: '2026-11-04' });
    p = await puerta('2026-11-04T18:00:00Z');
    assert.ok(p.avisos.some((a) => a.startsWith('El recordatorio a Almacén de las 11:00 salió solo por la campana: el WhatsApp al grupo Requisiciones no salió')), p.avisos.join(' | '));

    // Al día siguiente el WhatsApp sale y la campana falla DESPUÉS: la cuenta se guarda igual, no se repite en la hora siguiente
    r = await vuelta('2026-11-05T16:00:00Z', async (m) => { enviados.push(m); return true; }, falla);
    assert.deepEqual([r.recordados, r.porWhatsApp, r.porCampana], [1, true, false]);
    assert.deepEqual(veces(), { veces: 2, ultimo: '2026-11-05' });
    r = await vuelta('2026-11-05T17:00:00Z', async (m) => { enviados.push(m); return true; }, async () => {});
    assert.equal(r.recordados, 0);
    assert.equal(enviados.length, 1, 'ni un segundo mensaje igual al grupo');

    // Cuando una vuelta sale completa, el aviso se quita
    const otros = modelo([pedido(8, '2026-11-06T12:00:00Z')]);
    await S.recordarPedidos({ modelo: otros, cfg, env: ENCENDIDO, ahora: reloj('2026-11-06T18:00:00Z'), enviar: async () => true, notificar: async () => {} });
    p = await puerta('2026-11-06T18:30:00Z');
    assert.equal(p.avisosNoSalieron.recordatorioAlmacen, null);
    assert.equal(p.avisos.some((a) => a.includes('recordatorio')), false);
});

test('un pedido para una fecha que ya pasó queda vencido aunque no se le haya recordado; lo atendido se cae de la lista', async () => {
    const e = S.estadoPedido(pedido(5, '2026-11-01T15:00:00Z', { para_fecha: '2026-11-02' }), { ahora: reloj('2026-11-05T15:00:00Z'), horas: 4 });
    assert.equal(e.vencido, true);
    assert.equal(e.motivoVencido, 'ya pasó el día en que lo necesitaba');
    const pedidos = modelo([pedido(6, '2026-11-01T15:00:00Z', { estado: 'surtida' })]);
    const cfg = configuracion();
    cfg.datos.set('pedidos_encargados_recordatorios', JSON.stringify({ 6: { veces: 1, ultimo: '2026-11-01' } }));
    await S.recordarPedidos({ modelo: pedidos, cfg, env: ENCENDIDO, enviar: async () => true, notificar: async () => {}, ahora: reloj('2026-11-05T15:00:00Z') });
    assert.deepEqual(JSON.parse(cfg.datos.get('pedidos_encargados_recordatorios')), {});
});

test('aviso al encargado cuando Almacén contesta: solo con la pieza «encargado», al grupo Requisiciones', async () => {
    const enviados = [];
    const enviar = async (m, d) => { enviados.push([d, m]); return true; };
    const nadaDeCampana = async () => { throw new Error('si salió, no hay campana'); };
    const fila = { id: 11, encargado: 'PRUEBA', texto: 'tornillos de prueba', estado: 'parcial', nota_almacen: 'Solo había 8; el resto el lunes' };
    assert.equal(await S.avisarRespuestaAlEncargado(fila, { env: {}, enviar, notificar: nadaDeCampana }), null, 'apagada: ni se intenta');
    assert.equal(enviados.length, 0);
    assert.equal(await S.avisarRespuestaAlEncargado(fila, { env: { PLANTA_SEGUIMIENTO: 'encargado' }, enviar, notificar: nadaDeCampana, cfg: configuracion() }), true);
    assert.equal(enviados[0][0], 'requisiciones');
    assert.match(enviados[0][1], /Almacén contestó a Prueba\* · Surtido en parte/);
    assert.match(enviados[0][1], /Nota: Solo había 8/);
});

test('aviso al encargado que no sale: queda anotado, campana al administrador (una por hora) y la puerta lo dice', async () => {
    const cfg = configuracion();
    const campanas = [];
    const piezas = { env: ENCENDIDO, cfg, notificar: async (n) => { campanas.push(n); } };
    const fila = { id: 11, encargado: 'PRUEBA', texto: 'tornillos de prueba', estado: 'rechazada', nota_almacen: 'No hay' };
    // WhatsApp apagado (enviarWhatsApp regresa false): ya no se queda solo en un log
    assert.equal(await S.avisarRespuestaAlEncargado(fila, { ...piezas, enviar: async () => false, ahora: reloj('2026-11-06T16:00:00Z') }), false);
    assert.equal(campanas.length, 1);
    assert.deepEqual(campanas[0].roles, ['administrador']);
    assert.equal(campanas[0].titulo, 'No salió el aviso al encargado');
    assert.match(campanas[0].mensaje, /Almacén contestó a Prueba \(«tornillos de prueba»: No se puede\), pero el WhatsApp al grupo Requisiciones no salió/);
    // La cola tira error: también se anota, pero la campana no se repite antes de una hora
    assert.equal(await S.avisarRespuestaAlEncargado({ ...fila, id: 12 }, { ...piezas, enviar: async () => { throw new Error('cola caída'); }, ahora: reloj('2026-11-06T16:20:00Z') }), false, 'nunca tumba la respuesta de Charly');
    assert.equal(campanas.length, 1, 'una campana por hora como máximo');
    const guardado = JSON.parse(cfg.datos.get('avisos_encargado_no_salieron'));
    assert.deepEqual(guardado.lista.map((a) => [a.id, a.respuesta, a.motivo]), [['almacen-12', 'No se puede', 'cola caída'], ['almacen-11', 'No se puede', 'WhatsApp apagado o no se pudo encolar']]);
    // Una hora después, otra campana
    await S.avisarRespuestaAlEncargado({ ...fila, id: 13 }, { ...piezas, enviar: async () => false, ahora: reloj('2026-11-06T17:05:00Z') });
    assert.equal(campanas.length, 2);
    // Si hasta la campana falla, nada lanza y la lista se guarda igual
    await S.avisarRespuestaAlEncargado({ ...fila, id: 14 }, { ...piezas, enviar: async () => false, notificar: async () => { throw new Error('base caída'); }, ahora: reloj('2026-11-06T19:00:00Z') });
    assert.equal(JSON.parse(cfg.datos.get('avisos_encargado_no_salieron')).lista.length, 4);

    // La puerta y el resumen lo dicen
    const vacio = modelo([]);
    const p = await S.pendientesDePlanta({ ahora: reloj('2026-11-06T20:00:00Z'), modelos: { pedidos: vacio, tickets: vacio }, cfg, env: {} });
    assert.equal(p.avisosNoSalieron.alEncargado.length, 4);
    assert.ok(p.avisos.includes('4 avisos a encargados no salieron por WhatsApp en las últimas 24 h (el último: Prueba, No se puede)'), p.avisos.join(' | '));
    // Pasadas 24 h ya no es aviso, pero la lista de 7 días sigue en la puerta
    const q = await S.pendientesDePlanta({ ahora: reloj('2026-11-08T20:00:00Z'), modelos: { pedidos: vacio, tickets: vacio }, cfg, env: {} });
    assert.equal(q.avisos.some((a) => a.includes('encargado')), false);
    assert.equal(q.avisosNoSalieron.alEncargado.length, 4);
});

test('«borrar» un pedido lo deja cancelado: la tableta lo recibe como «No se puede» con su nota y Planta ya no lo lista', async () => {
    const { default: SolicitudAlmacen } = await import('../src/models/SolicitudAlmacen.js');
    const { borrarPedidoEncargado, listarPedidosEncargados } = await import('../src/controllers/pedidosEncargados.controller.js');
    const { listarSolicitudesAlmacen } = await import('../src/routes/sistemas/almacen.js');
    const originales = { findByPk: SolicitudAlmacen.findByPk, findAll: SolicitudAlmacen.findAll, count: SolicitudAlmacen.count };
    const fila = { id: 9, encargado: 'PRUEBA', texto: 'prueba', estado: 'pendiente', referencia: 'operacion:abc', created_at: new Date('2026-11-05T15:00:00Z'),
        update: async function (d) { Object.assign(this, d); }, destroy: async () => { throw new Error('ya no se borra'); } };
    let whereLista = null;
    try {
        SolicitudAlmacen.findByPk = async () => fila;
        SolicitudAlmacen.findAll = async ({ where }) => { whereLista = where; return [fila]; };
        SolicitudAlmacen.count = async () => 0;
        const res = { status(c) { this.codigo = c; return this; }, json(b) { this.cuerpo = b; return this; } };
        await borrarPedidoEncargado({ params: { id: '9' }, usuario: { nombre: 'Admin' } }, res);
        assert.equal(res.cuerpo.success, true);
        assert.equal(fila.estado, 'cancelada');
        assert.equal(fila.atendida_por, 'Admin');
        // La tableta (por la puerta) lo ve como «No se puede» con la nota: no conoce «cancelada»
        const { solicitudes } = await listarSolicitudesAlmacen({ query: { encargado: 'prueba' } }, { modelo: { findAll: async () => [fila] } });
        assert.equal(fila.estado, 'cancelada', 'en Planta se guarda cancelada');
        assert.equal(solicitudes[0].estado, 'rechazada');
        assert.equal(solicitudes[0].nota, 'Lo quitó el administrador en Planta');
        assert.equal(solicitudes[0].cancelada, true);
        assert.equal(solicitudes[0].referencia, 'operacion:abc');
        // Planta no lo lista ni en «todos» ni en «atendidas»
        for (const estado of ['', 'atendidas']) {
            await listarPedidosEncargados({ query: { estado } }, res);
            const condicion = whereLista.estado;
            const excluidos = condicion[Op.ne] ? [condicion[Op.ne]] : condicion[Op.notIn];
            assert.ok(excluidos.includes('cancelada'), `«${estado}» deja fuera los cancelados`);
        }
        // Borrar otra vez: ya no existe
        await borrarPedidoEncargado({ params: { id: '9' }, usuario: { nombre: 'Admin' } }, res);
        assert.equal(res.codigo, 404);
    } finally {
        Object.assign(SolicitudAlmacen, originales);
    }
});

const ticket = (movimiento_id, creado, estado, extra = {}) => ({ movimiento_id, ticket_id: `PED-0511-${movimiento_id}`, proyecto: 'COLEGIO NORTE', estado, intentos: 2, ultimo_error: estado === 'subido' ? null : 'El permiso de Google Drive caducó', created_at: new Date(creado), subido_en: null, ...extra });

test('tickets que no llegan a Drive en 1 h: una campana al administrador por ticket, no se repite', async () => {
    const tickets = modelo([
        ticket(1, '2026-11-05T15:00:00Z', 'error'),
        ticket(2, '2026-11-05T16:30:00Z', 'error'),          // menos de una hora: todavía no
        ticket(3, '2026-11-05T14:00:00Z', 'subido', { subido_en: new Date('2026-11-05T14:01:00Z') })
    ]);
    const cfg = configuracion();
    const campanas = [];
    const piezas = { modelo: tickets, cfg, env: ENCENDIDO, notificar: async (n) => { campanas.push(n); } };
    assert.equal((await S.alertarTicketsAtorados({ ...piezas, env: {}, ahora: reloj('2026-11-05T17:00:00Z') })).apagada, true);
    let r = await S.alertarTicketsAtorados({ ...piezas, ahora: reloj('2026-11-05T17:00:00Z') });
    assert.equal(r.alertados, 1);
    assert.deepEqual(campanas[0].roles, ['administrador']);
    assert.match(campanas[0].titulo, /1 orden de salida no ha llegado a Drive/);
    assert.match(campanas[0].mensaje, /PED-0511-1 \(COLEGIO NORTE\): El permiso de Google Drive caducó/);
    r = await S.alertarTicketsAtorados({ ...piezas, ahora: reloj('2026-11-05T17:10:00Z') });
    assert.equal(r.alertados, 0, 'el mismo ticket no se vuelve a avisar');
    r = await S.alertarTicketsAtorados({ ...piezas, ahora: reloj('2026-11-05T17:40:00Z') });
    assert.equal(r.alertados, 1, 'el #2 ya pasó la hora');
});

test('más de 50 tickets atorados: la cuenta no tiene tope, la alerta toma primero los no avisados y lo de más de 7 días se dice', async () => {
    // 60 tickets de hoy sin llegar (uno cada minuto desde las 8:00 de México) y 2 de hace 9 días
    const filas = Array.from({ length: 60 }, (_, i) => ticket(i + 1, new Date(Date.parse('2026-11-06T14:00:00Z') + i * 60000).toISOString(), 'error'));
    filas.push(ticket(101, '2026-10-28T15:00:00Z', 'error'), ticket(102, '2026-10-28T16:00:00Z', 'pendiente'));
    const tickets = modelo(filas);
    const cfg = configuracion();
    const campanas = [];
    const piezas = { modelo: tickets, cfg, env: ENCENDIDO, notificar: async (n) => { campanas.push(n); } };

    const p = await S.pendientesDePlanta({ ahora: reloj('2026-11-06T18:00:00Z'), modelos: { pedidos: modelo([]), tickets }, cfg, env: {} });
    assert.deepEqual([p.tickets.sinSubir, p.tickets.masDe7Dias, p.tickets.lista.length], [60, 2, 50], 'sinSubir ya no se queda en 50');
    assert.ok(p.avisos.includes('2 tickets de salida llevan más de 7 días sin llegar a Drive y ya no se reintentan solos'), p.avisos.join(' | '));
    assert.match(S.textoResumen(p), /60 tickets de salida sin llegar a Drive/);
    assert.deepEqual(await S.contarTicketsSinSubir({ ahora: reloj('2026-11-06T18:00:00Z'), modelo: tickets }), { sinSubir: 60, masDe7Dias: 2 });

    // Primera vuelta: 50 avisos (los más viejos) y el total
    let r = await S.alertarTicketsAtorados({ ...piezas, ahora: reloj('2026-11-06T18:00:00Z') });
    assert.equal(r.alertados, 50);
    assert.match(campanas[0].mensaje, /En total, 60 sin llegar$/);
    // Llega uno nuevo; la siguiente vuelta avisa los 10 que faltaban y el nuevo, sin esperar a que los viejos salgan de la lista
    tickets.filas.push(ticket(200, '2026-11-06T17:00:00Z', 'sin_carpeta'));
    r = await S.alertarTicketsAtorados({ ...piezas, ahora: reloj('2026-11-06T18:10:00Z') });
    assert.equal(r.alertados, 11);
    assert.ok(campanas[1].datos_adicionales.tickets_drive.includes('PED-0511-200'));
    r = await S.alertarTicketsAtorados({ ...piezas, ahora: reloj('2026-11-06T18:20:00Z') });
    assert.equal(r.alertados, 0, 'cada ticket se avisa una vez');
});

test('tickets por día (hora de México): órdenes, subidos ese día y los que siguen sin subir', () => {
    const dias = S.contarPorDia([
        ticket(1, '2026-11-05T15:00:00Z', 'subido', { subido_en: new Date('2026-11-05T15:01:00Z') }),
        ticket(2, '2026-11-06T04:00:00Z', 'subido', { subido_en: new Date('2026-11-06T05:30:00Z') }), // 22:00 y 23:30 del 5-nov en México
        ticket(3, '2026-11-04T23:00:00Z', 'error'),
        ticket(4, '2026-11-04T20:00:00Z', 'subido', { subido_en: new Date('2026-11-05T16:00:00Z') })   // hecha el 4, subida el 5
    ], { dias: 3, ahora: reloj('2026-11-06T18:00:00Z') });
    assert.deepEqual(dias, [
        { dia: '2026-11-06', ordenes: 0, subidos: 0, sinSubir: 0 },
        { dia: '2026-11-05', ordenes: 2, subidos: 3, sinSubir: 0 },
        { dia: '2026-11-04', ordenes: 2, subidos: 0, sinSubir: 1 }
    ]);
});

test('pendientes de Planta: pedidos, tickets y celdas en una respuesta; lo que no se puede leer se dice', async () => {
    const cfg = configuracion();
    cfg.datos.set('calendario_celdas_no_entendidas', JSON.stringify({ dia: '2026-11-06', celdas: [
        { fecha: '2026-11-05', celda: 'VIEJA / RETRIO', motivos: ['x'] },
        { fecha: '2026-11-10', celda: 'ROSA PÉREZ / RETRIO', motivos: ['«RETRIO» parece RETIRO mal escrito'] }
    ] }));
    const modelos = {
        pedidos: modelo([pedido(3, '2026-10-31T17:00:00Z', { para_fecha: '2026-11-02' }), pedido(7, '2026-11-06T17:00:00Z')]),
        tickets: modelo([ticket(1, '2026-11-06T15:00:00Z', 'sin_carpeta')])
    };
    const ahora = reloj('2026-11-06T18:00:00Z');
    const p = await S.pendientesDePlanta({ ahora, modelos, cfg, env: {} });
    assert.equal(p.sistema, 'planta');
    assert.deepEqual([p.pedidos.porAtender, p.pedidos.atrasados, p.pedidos.vencidos], [2, 1, 1]);
    assert.equal(p.pedidos.lista[0].id, 'almacen-3', 'lo vencido primero');
    assert.equal(p.tickets.sinSubir, 1);
    assert.equal(p.tickets.porDia.length, 7);
    assert.deepEqual(p.calendario, { celdasNoEntendidas: 1, revisadoEl: '2026-11-06', alDia: true, lista: [{ fecha: '2026-11-10', celda: 'ROSA PÉREZ / RETRIO', motivos: ['«RETRIO» parece RETIRO mal escrito'] }] });
    assert.deepEqual(p.avisos, []);
    assert.deepEqual(p.banderas, { PLANTA_SEGUIMIENTO: [], CALENDARIO_VOCABULARIO_UNICO: false });
    assert.doesNotMatch(JSON.stringify(p), /\d{10}|@/, 'ni teléfonos ni correos');

    // La lista de ayer y un modelo caído: sale lo demás, y se dice qué faltó
    const roto = { findAll: async () => { throw new Error('base caída'); } };
    const q = await S.pendientesDePlanta({ ahora: reloj('2026-11-07T18:00:00Z'), modelos: { ...modelos, tickets: roto }, cfg, env: {} });
    assert.equal(q.tickets, null);
    assert.equal(q.calendario.alDia, false);
    assert.deepEqual(q.avisos, ['No se pudieron leer los tickets de salida a Drive', 'La lista de celdas del calendario no es de hoy: la lectura del calendario no ha corrido hoy']);

    // El resumen de las 8:00 al administrador
    const campanas = [];
    const r = await S.enviarResumenDiario({ ahora, env: ENCENDIDO, notificar: async (n) => { campanas.push(n); }, armar: async () => p });
    assert.equal(r.enviado, true);
    assert.deepEqual(campanas[0].roles, ['administrador']);
    assert.match(campanas[0].titulo, /Pendientes de Planta \(3\)/);
    assert.match(campanas[0].mensaje, /1 celda del calendario sin entender: «ROSA PÉREZ \/ RETRIO»/);
    assert.match(campanas[0].mensaje, /1 pedido de encargado vencido: Prueba/);
    assert.match(campanas[0].mensaje, /1 ticket de salida sin llegar a Drive/);
    assert.equal((await S.enviarResumenDiario({ ahora, env: {}, notificar: async () => { throw new Error('no debe'); }, armar: async () => p })).apagada, true);
});

test('agenda: las tres tareas nuevas solo aparecen con su pieza encendida', async () => {
    const { agendaPlanta } = await import('../src/utils/agendaPlanta.js');
    const ids = async () => (await agendaPlanta({ ahora: reloj('2026-11-06T15:00:00Z') })).envios.map((e) => e.id).filter((id) => id.startsWith('pla-seguimiento'));
    assert.deepEqual(await ids(), []);
    process.env.PLANTA_SEGUIMIENTO = 'pedidos';
    assert.deepEqual(await ids(), ['pla-seguimiento-pedidos']);
    process.env.PLANTA_SEGUIMIENTO = '1';
    assert.deepEqual(await ids(), ['pla-seguimiento-resumen', 'pla-seguimiento-pedidos', 'pla-seguimiento-tickets']);
});
