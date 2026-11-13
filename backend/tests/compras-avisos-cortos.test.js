/**
 * Compras sin ruido (13-nov-2026, pedido de Isa): los avisos del grupo de Compras en corto y UNO al día el de
 * solicitudes. Sin base de datos: solo los textos y la regla del día.
 * Correr:  cd backend && npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

for (const m of ['log', 'info', 'debug']) console[m] = () => {};

process.env.DATABASE_URL = 'postgres://prueba:prueba@127.0.0.1:9/prueba_sin_base';
process.env.WHATSAPP_PUENTE_TOKEN = '';

const { construirAvisoSolicitudes, decidirAvisoDelDia } = await import('../src/services/barridoCompras.service.js');
const { construirMensajeAutorizacion } = await import('../src/services/whatsapp.service.js');

const URL = 'https://inventario-3-g.vercel.app/solicitudes-compra';

test('solicitudes por revisar: dos renglones, lo más urgente con 2 proveedores / 4 artículos y sin «PIEZAS»', () => {
    const texto = construirAvisoSolicitudes({
        total: 19, proveedores: 8, url: URL,
        recientes: [
            { proveedor: 'FORMALASSER', articulo: 'CERRAMIENTO RECTO GRANDE', cantidad: '189.00', unidad: 'PIEZAS', prioridad: 'urgente' },
            { proveedor: 'FORMALASSER', articulo: 'SOPORTE MEDIO  MURO', cantidad: 43, unidad: 'pieza', prioridad: 'alta' },
            { proveedor: null, articulo: 'TORNILLO RARO', cantidad: 5, unidad: 'pza', prioridad: 'urgente' },
            { proveedor: 'RE.BA.CE / BALEROS', articulo: 'BALERO GRANDE', cantidad: 6, unidad: 'PIEZAS', prioridad: 'alta' },
            { proveedor: 'LONAS PRUEBA', articulo: 'LONA 3X50', cantidad: 2, unidad: 'rollo', prioridad: 'media' }
        ]
    });
    assert.equal(texto,
        '🧾 Hay 19 solicitudes de compra (8 proveedores). Lo más urgente: Formalasser — cerramiento recto grande 189, ' +
        'soporte medio muro 43; Re.ba.ce / Baleros — balero grande 6; y 2 más.\n' +
        `Ver: ${URL}`);
    assert.equal(texto.split('\n').length, 2);
    assert.doesNotMatch(texto, /PIEZAS|\*Solicitudes/);
});

test('solicitudes por revisar: singular, unidad que no es pieza y «sin proveedor» si es lo único', () => {
    const texto = construirAvisoSolicitudes({
        total: 1, proveedores: 0, url: URL,
        recientes: [{ proveedor: null, articulo: 'LONA 3X50', cantidad: 2.5, unidad: 'ROLLOS', prioridad: 'media' }]
    });
    assert.equal(texto, `🧾 Hay 1 solicitud de compra. Lo más urgente: sin proveedor — lona 3x50 2.5 rollos.\nVer: ${URL}`);
});

test('un aviso al día: si el de hoy ya salió, lo nuevo espera; si hay uno sin salir, se actualiza', () => {
    const ahora = new Date('2026-11-12T13:31:00Z');                       // 7:31 en México
    const hoy = { estado: 'enviado', enviado_at: new Date('2026-11-12T13:00:00Z') };   // 7:00 en México
    const ayer = { estado: 'enviado', enviado_at: new Date('2026-11-12T03:00:00Z') };  // 21:00 del 11-nov en México
    const enCola = { estado: 'pendiente', created_at: new Date('2026-11-12T04:00:00Z') };

    assert.equal(decidirAvisoDelDia(hoy, hoy, ahora), 'esperar', 'el 12-nov salieron dos (7:00 y 7:31): el segundo espera');
    assert.equal(decidirAvisoDelDia(enCola, hoy, ahora), 'esperar', 'uno en cola cuando ya salió el de hoy tampoco sale');
    assert.equal(decidirAvisoDelDia(enCola, ayer, ahora), 'actualizar', 'el que espera el horario se actualiza, no se encola otro');
    assert.equal(decidirAvisoDelDia(ayer, ayer, ahora), 'nuevo', 'el de ayer (en hora de México) no cuenta para hoy');
    assert.equal(decidirAvisoDelDia(null, null, ahora), 'nuevo');
});

test('orden por autorizar: un mensaje compacto que conserva lo que lee Julia (encabezado y «Folio:»)', () => {
    const orden = {
        ticket_id: 'OC-111126-2219-01',
        proveedor: { nombre: 'EL TORNILLO' },
        creador: { nombre: 'SUSANA GASCA' },
        detalles: [
            { cantidad_solicitada: '150.00', articulo: { nombre: 'TUERCA SEGURIDAD 3/8"', unidad: 'PIEZAS' } },
            { cantidad_solicitada: 50, articulo: { nombre: 'TORNILLO MAQUINA 3/16"', unidad: 'PIEZAS' } },
            { cantidad_solicitada: 50, articulo: { nombre: 'TUERCA 3/16"', unidad: 'pieza' } }
        ]
    };
    const texto = construirMensajeAutorizacion(orden);
    assert.equal(texto,
        '🛒 *EL TORNILLO* (pidió Susana): tuerca seguridad 3/8" ×150, tornillo maquina 3/16" ×50, tuerca 3/16" ×50.\n' +
        'Orden de compra por autorizar ✅ / ❌ · Folio: OC-111126-2219-01');
    // Lo mismo que hace auxiliar-contable-3g (server.js y inventario/aprobaciones.js)
    assert.equal((texto.match(/Folio:\s*([\w-]+)/i) || [])[1], 'OC-111126-2219-01');
    assert.ok(texto.includes('Orden de compra por autorizar'));
});

test('orden por autorizar: más de 8 artículos se resumen y la unidad que no es pieza se dice', () => {
    const detalles = Array.from({ length: 10 }, (_, i) => ({ cantidad_solicitada: i + 1, articulo: { nombre: `ART ${i + 1}`, unidad: i === 0 ? 'ROLLO' : 'PZA' } }));
    const texto = construirMensajeAutorizacion({ ticket_id: 'OC-1', proveedor: { nombre: 'X' }, detalles });
    assert.match(texto, /^🛒 \*X\*: art 1 ×1 rollo, art 2 ×2, .* art 8 ×8, y 2 más\.\n/);
});
