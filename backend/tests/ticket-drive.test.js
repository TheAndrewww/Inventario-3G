/**
 * El ticket de cada Orden de salida lo sube el servidor a la carpeta de Drive del proyecto (27-oct-2026).
 *
 * Sin base de datos, sin Drive y sin red: el PDF se arma con imágenes hechas aquí con sharp, y la subida se prueba con
 * piezas de mentira (cargar el pedido, buscar la carpeta, subir y avisar).
 * Correr:  cd backend && npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import sharp from 'sharp';

/** El texto del PDF: abre cada stream comprimido (el ticket va con compress: true). */
const textoDelPDF = (pdf) => {
    const crudo = pdf.toString('latin1');
    const partes = [crudo];
    const patron = /stream\r?\n/g;
    let m;
    while ((m = patron.exec(crudo))) {
        const inicio = m.index + m[0].length;
        const fin = crudo.indexOf('endstream', inicio);
        if (fin < 0) break;
        try { partes.push(inflateSync(pdf.subarray(inicio, fin)).toString('latin1')); } catch { /* no era Flate */ }
        patron.lastIndex = fin;
    }
    return partes.join('\n');
};

// Lo que el servidor escribe con console.log rompe a veces la salida de `node --test`; se calla aquí.
for (const m of ['log', 'info', 'debug']) console[m] = () => {};
console.error = () => {};

process.env.DATABASE_URL = 'postgres://prueba:prueba@127.0.0.1:9/prueba_sin_base';
process.env.WHATSAPP_PUENTE_TOKEN = '';

const { armarTicketPDF, cargarImagenTicket } = await import('../src/utils/ticketPDF.js');
const {
    ticketDriveDesdeServidor, siguienteIntento, motivoLegible, subirTicketADrive, avisarYAnotarTicket, cambiosTrasIntento,
    ticketYaLoSubeElServidor
} = await import('../src/services/ticketDrive.service.js');

const pedidoDePrueba = (datos = {}) => ({
    id: 77,
    ticket_id: 'PED-271026-1430-03',
    proyecto: 'OBRA DE PRUEBA',
    estado: 'pendiente',
    observaciones: 'Entregar en la puerta 2',
    created_at: '2026-10-27T03:30:00Z', // 26-oct 21:30 en México
    supervisor: { nombre: 'GERAS' },
    detalles: [
        { articulo_id: 1, cantidad: 4, articulo: { nombre: 'Tornillo', unidad: 'pz', categoria: { nombre: 'Herrajes' } } },
        { articulo_id: 2, cantidad: 2, articulo: { nombre: 'Lona', unidad: 'm', descripcion: 'Blanca', categoria: null } }
    ],
    ...datos
});

const pngDe = (ancho, alto) => sharp({
    create: { width: ancho, height: alto, channels: 4, background: { r: 10, g: 80, b: 140, alpha: 1 } }
}).png().toBuffer();

const fetchDe = (bytes) => async () => ({ ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });

// ---------- El PDF ----------

test('el PDF sale con el encabezado, el proyecto, los artículos por categoría y las observaciones', () => {
    const pdf = armarTicketPDF(pedidoDePrueba());
    assert.ok(Buffer.isBuffer(pdf));
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    const texto = textoDelPDF(pdf);
    for (const esperado of ['ORDEN DE SALIDA', 'ENCARGADO', 'GERAS', 'OBRA DE PRUEBA', 'HERRAJES', 'GENERAL', 'Tornillo - 4 pz', 'OBSERVACIONES', 'Entregar en la puerta 2']) {
        assert.ok(texto.includes(esperado), `falta «${esperado}» en el PDF`);
    }
});

test('la fecha de salida es la de México aunque el servidor corra en UTC', () => {
    const texto = textoDelPDF(armarTicketPDF(pedidoDePrueba()));
    assert.ok(texto.includes('26/10/2026'), 'a las 03:30 UTC del 27 en México todavía es 26');
});

test('sin encargado dice «Sin encargado» (no pone al creador)', () => {
    const texto = textoDelPDF(armarTicketPDF(pedidoDePrueba({ supervisor: null, usuario: { nombre: 'Diseñador' } })));
    assert.ok(texto.includes('Sin encargado'));
});

test('las imágenes se preparan sin navegador: foto en JPEG con su proporción, logo en PNG', async () => {
    const foto = await cargarImagenTicket('https://ejemplo.test/foto.png', { fetch: fetchDe(await pngDe(200, 100)) });
    assert.equal(foto.formato, 'JPEG');
    assert.ok(foto.base64.startsWith('data:image/jpeg;base64,'));
    assert.equal(foto.aspectRatio, 2);

    const logo = await cargarImagenTicket('https://ejemplo.test/logo.png', { formato: 'PNG', fetch: fetchDe(await pngDe(300, 100)) });
    assert.equal(logo.formato, 'PNG');
    assert.ok(logo.base64.startsWith('data:image/png;base64,'));

    const pdf = armarTicketPDF(pedidoDePrueba(), { logo, marcaAgua: logo, articulos: { 1: foto } });
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length > armarTicketPDF(pedidoDePrueba()).length, 'con imágenes pesa más');
});

test('una imagen que no baja o una ruta fuera de uploads/ se omite sin tronar el ticket', async () => {
    const caida = async () => { throw new Error('sin red'); };
    assert.equal(await cargarImagenTicket('https://ejemplo.test/x.png', { fetch: caida }), null);
    assert.equal(await cargarImagenTicket('https://ejemplo.test/x.png', { fetch: async () => ({ ok: false, status: 404 }) }), null);
    assert.equal(await cargarImagenTicket('/uploads/../../server.js'), null);
    assert.equal(await cargarImagenTicket('/uploads/no-existe.jpg'), null);
    assert.equal(await cargarImagenTicket(null), null);
});

// ---------- La subida ----------

const piezasDePrueba = (cambios = {}) => {
    const llamadas = { subir: [], avisar: [], generar: 0, buscar: 0 };
    const piezas = {
        cargarPedido: async () => pedidoDePrueba(),
        buscarCarpeta: async () => { llamadas.buscar++; return { carpetaId: 'carpeta-1', proyectoObj: null }; },
        generarPDF: async () => { llamadas.generar++; return Buffer.from('%PDF-prueba'); },
        subir: async (carpetaId, pdf, nombre) => { llamadas.subir.push({ carpetaId, pdf, nombre }); return { id: 'archivo-1', name: nombre }; },
        avisarYAnotar: async (datos) => { llamadas.avisar.push(datos); return true; },
        escrituraConfigurada: () => true,
        ...cambios
    };
    return { piezas, llamadas };
};

test('sube el PDF a la carpeta del proyecto con el nombre de siempre y avisa', async () => {
    const { piezas, llamadas } = piezasDePrueba();
    const r = await subirTicketADrive(77, piezas);
    assert.equal(r.estado, 'subido');
    assert.equal(r.archivo.id, 'archivo-1');
    assert.equal(llamadas.subir.length, 1);
    assert.equal(llamadas.subir[0].carpetaId, 'carpeta-1');
    assert.equal(llamadas.subir[0].nombre, 'Ticket-PED-271026-1430-03.pdf');
    assert.equal(llamadas.avisar.length, 1);
    assert.equal(llamadas.avisar[0].proyecto, 'OBRA DE PRUEBA');
});

test('sin carpeta del proyecto no arma el PDF ni sube nada', async () => {
    const { piezas, llamadas } = piezasDePrueba({ buscarCarpeta: async () => ({ carpetaId: null, proyectoObj: null }) });
    const r = await subirTicketADrive(77, piezas);
    assert.equal(r.estado, 'sin_carpeta');
    assert.match(r.motivo, /OBRA DE PRUEBA/);
    assert.equal(llamadas.generar, 0);
    assert.equal(llamadas.subir.length, 0);
});

test('un pedido cancelado, sin proyecto o que ya no existe no se sube', async () => {
    for (const pedido of [pedidoDePrueba({ estado: 'cancelado' }), pedidoDePrueba({ proyecto: null }), null]) {
        const { piezas, llamadas } = piezasDePrueba({ cargarPedido: async () => pedido });
        const r = await subirTicketADrive(77, piezas);
        assert.equal(r.estado, 'no_aplica');
        assert.equal(llamadas.buscar, 0);
        assert.equal(llamadas.subir.length, 0);
    }
});

test('sin el permiso de Drive puesto no baja imágenes ni arma el PDF: falla en seguida para reintentar', async () => {
    const { piezas, llamadas } = piezasDePrueba({ escrituraConfigurada: () => false });
    await assert.rejects(subirTicketADrive(77, piezas), /no está autorizado/);
    assert.equal(llamadas.generar, 0);
    assert.equal(llamadas.subir.length, 0);
});

test('si Drive falla, el error sube para que se reintente', async () => {
    const { piezas, llamadas } = piezasDePrueba({ subir: async () => { throw new Error('invalid_grant'); } });
    await assert.rejects(subirTicketADrive(77, piezas), /invalid_grant/);
    assert.equal(llamadas.avisar.length, 0, 'sin subir no se avisa');
});

// ---------- El aviso al grupo ----------

const proyectoDePrueba = (vistos) => {
    const p = { archivos_ticket: vistos, actualizado: null };
    p.reload = async () => p;
    p.update = async (datos) => { p.actualizado = datos; Object.assign(p, datos); return p; };
    return p;
};

test('avisa y anota el ticket la primera vez', async () => {
    const avisos = [];
    const proyectoObj = proyectoDePrueba([{ id: 'viejo', nombre: 'Ticket-viejo.pdf' }]);
    const aviso = await avisarYAnotarTicket({
        proyecto: 'OBRA', proyectoObj, archivo: { id: 'nuevo', name: 'Ticket-X.pdf' }, fileName: 'Ticket-X.pdf',
        avisar: async (d) => { avisos.push(d); }
    });
    assert.equal(aviso, true);
    assert.deepEqual(avisos, [{ proyecto: 'OBRA' }]);
    assert.deepEqual(proyectoObj.archivos_ticket.map(t => t.id), ['viejo', 'nuevo']);
});

test('no avisa dos veces el mismo archivo (lo subieron la pantalla y el servidor)', async () => {
    const avisos = [];
    const aviso = await avisarYAnotarTicket({
        proyecto: 'OBRA', proyectoObj: proyectoDePrueba([{ id: 'mismo', nombre: 'Ticket-X.pdf' }]),
        archivo: { id: 'mismo' }, fileName: 'Ticket-X.pdf', avisar: async (d) => { avisos.push(d); }
    });
    assert.equal(aviso, false);
    assert.equal(avisos.length, 0);
});

test('sin proyecto en la base igual avisa (como antes)', async () => {
    const avisos = [];
    await avisarYAnotarTicket({ proyecto: 'OBRA', proyectoObj: null, archivo: { id: 'a' }, fileName: 'f', avisar: async (d) => { avisos.push(d); } });
    assert.equal(avisos.length, 1);
});

// ---------- Reintentos y bandera ----------

test('cómo queda el registro tras cada intento', () => {
    const ahora = new Date('2026-10-27T18:00:00Z');
    const subido = cambiosTrasIntento({ intentos: 0 }, { estado: 'subido', archivo: { id: 'a', webViewLink: 'https://drive.test/a' } }, ahora);
    assert.equal(subido.estado, 'subido');
    assert.equal(subido.intentos, 1);
    assert.equal(subido.archivo_id, 'a');
    assert.equal(subido.siguiente_intento, null);
    assert.equal(subido.subido_en, ahora);

    const error = cambiosTrasIntento({ intentos: 0 }, { estado: 'error', motivo: 'Drive caído' }, ahora);
    assert.equal(error.estado, 'error');
    assert.equal(error.siguiente_intento.getTime() - ahora.getTime(), 10 * 60000);

    const sinCarpeta = cambiosTrasIntento({ intentos: 2 }, { estado: 'sin_carpeta', motivo: 'x' }, ahora);
    assert.equal(sinCarpeta.estado, 'sin_carpeta');
    assert.ok(sinCarpeta.siguiente_intento instanceof Date);

    const sigueSinCarpeta = cambiosTrasIntento({ intentos: 30 }, { estado: 'sin_carpeta', motivo: 'x' }, ahora);
    assert.equal(sigueSinCarpeta.siguiente_intento.getTime() - ahora.getTime(), 180 * 60000, 'sin carpeta se sigue reintentando cada 3 h');

    const noAplica = cambiosTrasIntento({ intentos: 0 }, { estado: 'no_aplica', motivo: 'cancelado' }, ahora);
    assert.equal(noAplica.siguiente_intento, null);
});

test('la espera entre reintentos crece y no pasa de 3 horas', () => {
    const ahora = new Date(0);
    const minutos = (n) => (siguienteIntento(n, ahora).getTime() - ahora.getTime()) / 60000;
    assert.deepEqual([1, 2, 3, 4, 5, 6, 20].map(minutos), [10, 20, 40, 80, 160, 180, 180]);
});

test('motivos en palabras', () => {
    assert.match(motivoLegible(new Error('invalid_grant')), /caducó/);
    assert.match(motivoLegible(Object.assign(new Error('x'), { code: 'DRIVE_OAUTH_EXPIRADO' })), /caducó/);
    assert.match(motivoLegible(new Error('Drive no está autorizado para subir archivos')), /no está autorizado/);
    assert.match(motivoLegible(new Error('invalid_client')), /no reconoce/);
    assert.equal(motivoLegible(new Error('otra cosa')), 'otra cosa');
});

test('TICKET_DRIVE_DESDE_SERVIDOR viene encendida y se apaga con 0', async () => {
    const antes = process.env.TICKET_DRIVE_DESDE_SERVIDOR;
    try {
        delete process.env.TICKET_DRIVE_DESDE_SERVIDOR;
        assert.equal(ticketDriveDesdeServidor(), true);
        process.env.TICKET_DRIVE_DESDE_SERVIDOR = '1';
        assert.equal(ticketDriveDesdeServidor(), true);
        for (const apagada of ['0', 'no', 'false', 'off', ' 0 ']) {
            process.env.TICKET_DRIVE_DESDE_SERVIDOR = apagada;
            assert.equal(ticketDriveDesdeServidor(), false, `«${apagada}» la apaga`);
        }
        // Apagada, la subida desde la pantalla vuelve a ser la de siempre (ni pregunta a la base)
        assert.equal(await ticketYaLoSubeElServidor('PED-1'), false);
    } finally {
        if (antes === undefined) delete process.env.TICKET_DRIVE_DESDE_SERVIDOR;
        else process.env.TICKET_DRIVE_DESDE_SERVIDOR = antes;
    }
});
