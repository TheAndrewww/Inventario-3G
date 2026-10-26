/**
 * Pedidos de los encargados a Almacén (23-oct-2026): lo que llega por la puerta entre sistemas
 * (POST /api/sistemas/v1/almacen/solicitudes) y lo que contesta Almacén.
 *
 * Sin base de datos: el modelo se cambia por uno en memoria.
 * Correr:  cd backend && npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

for (const m of ['log', 'info', 'debug']) console[m] = () => {};

process.env.DATABASE_URL = 'postgres://prueba:prueba@127.0.0.1:9/prueba_sin_base';
process.env.WHATSAPP_PUENTE_TOKEN = '';

const { leerSolicitudAlmacen, registrarSolicitudAlmacen, listarSolicitudesAlmacen } = await import('../src/routes/sistemas/almacen.js');
const { leerRespuesta } = await import('../src/controllers/pedidosEncargados.controller.js');

const BUENO = { encargado: 'geras', tipo: 'reposicion', texto: ' 2 cajas de pijas 1/4 y silicón ', paraFecha: '2026-10-24', referencia: 'ope-alm-17' };

const modeloEnMemoria = () => {
    const filas = [];
    return {
        filas,
        findOne: async ({ where }) => filas.find((f) => f.referencia === where.referencia) || null,
        create: async (datos) => { const f = { id: filas.length + 1, estado: 'pendiente', created_at: new Date(), ...datos }; filas.push(f); return f; },
        findAll: async ({ where }) => filas.filter((f) => !where.encargado || f.encargado === where.encargado).reverse()
    };
};

test('un pedido bueno se normaliza (mayúsculas, sin espacios de más)', () => {
    const { errores, datos } = leerSolicitudAlmacen(BUENO);
    assert.deepEqual(errores, []);
    assert.equal(datos.encargado, 'GERAS');
    assert.equal(datos.tipo, 'REPOSICION');
    assert.equal(datos.texto, '2 cajas de pijas 1/4 y silicón');
    assert.equal(datos.para_fecha, '2026-10-24');
    assert.equal(datos.obra_id, null);
});

test('lo que falta o sobra se rechaza con su motivo', () => {
    assert.match(leerSolicitudAlmacen({ ...BUENO, tipo: 'COMPRA' }).errores.join(), /tipo/);
    assert.match(leerSolicitudAlmacen({ ...BUENO, texto: '   ' }).errores.join(), /texto/);
    assert.match(leerSolicitudAlmacen({ ...BUENO, referencia: '' }).errores.join(), /referencia/);
    assert.match(leerSolicitudAlmacen({ ...BUENO, paraFecha: '2026-02-30' }).errores.join(), /paraFecha/);
    assert.match(leerSolicitudAlmacen({ ...BUENO, obra: 'OBRA-1' }).errores.join(), /obra/);
    assert.match(leerSolicitudAlmacen({ ...BUENO, encargado: '' }).errores.join(), /encargado/);
    assert.deepEqual(leerSolicitudAlmacen({ ...BUENO, tipo: 'HERRAMIENTA_ESPECIAL', obra: '3G-26-0412' }).errores, []);
});

test('la misma referencia no se anota dos veces y solo avisa la primera', async () => {
    const modelo = modeloEnMemoria();
    let avisos = 0;
    const avisar = async () => { avisos++; };
    const a = await registrarSolicitudAlmacen(BUENO, { modelo, avisar });
    assert.equal(a.codigo, 201);
    assert.equal(a.cuerpo.id, 'almacen-1');
    assert.equal(a.cuerpo.duplicado, false);
    const b = await registrarSolicitudAlmacen({ ...BUENO, texto: 'otro texto' }, { modelo, avisar });
    assert.equal(b.codigo, 200);
    assert.equal(b.cuerpo.duplicado, true);
    assert.equal(b.cuerpo.id, 'almacen-1');
    assert.equal(modelo.filas.length, 1);
    assert.equal(avisos, 1);
    const c = await registrarSolicitudAlmacen({ ...BUENO, tipo: 'nada' }, { modelo, avisar });
    assert.equal(c.codigo, 400);
});

test('la tableta ve sus pedidos con su estado', async () => {
    const modelo = modeloEnMemoria();
    const avisar = async () => {};
    await registrarSolicitudAlmacen(BUENO, { modelo, avisar });
    await registrarSolicitudAlmacen({ ...BUENO, encargado: 'MANE', referencia: 'ope-alm-18' }, { modelo, avisar });
    const { solicitudes } = await listarSolicitudesAlmacen({ query: { encargado: 'Geras' } }, { modelo });
    assert.equal(solicitudes.length, 1);
    assert.equal(solicitudes[0].referencia, 'ope-alm-17');
    assert.equal(solicitudes[0].estado, 'pendiente');
    assert.equal(solicitudes[0].paraFecha, '2026-10-24');
});

test('Almacén: parcial o no se puede llevan nota; surtido no', () => {
    assert.deepEqual(leerRespuesta({ estado: 'surtida' }), { estado: 'surtida', nota: null });
    assert.match(leerRespuesta({ estado: 'parcial' }).error, /faltó/);
    assert.deepEqual(leerRespuesta({ estado: 'rechazada', nota: 'No hay taladro de banco' }), { estado: 'rechazada', nota: 'No hay taladro de banco' });
    assert.match(leerRespuesta({ estado: 'pendiente' }).error, /estado/);
});

test('26-oct: la requisición del encargado va al grupo Requisiciones con un texto sin importes', async () => {
    const { textoRequisicion } = await import('../src/routes/sistemas/almacen.js');
    const t = textoRequisicion({ encargado: 'GERAS', tipo: 'REPOSICION', texto: '2 cajas de tornillo 1/4', para_fecha: '2026-10-27', proyecto: null });
    assert.equal(t, '📋 *Requisición de Geras* · Reposición de stock\n2 cajas de tornillo 1/4\nPara el 27 oct\nSe atiende en Inventario › Pedidos de encargados.');
});
