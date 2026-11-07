/**
 * Puerta «pendientes de Planta» (revisión del 6-nov-2026, punto 9 e): GET /api/sistemas/v1/pendientes-planta, la que
 * puede consultar el resumen diario de Operación. Con la llave de Operación (produccion.leer) o la del Inicio
 * (inicio.leer); sin alcance, 403. Sin base: los modelos se cambian por unos vacíos. Socket local, sin puertos.
 * Correr:  cd backend && npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';

for (const m of ['log', 'info', 'debug', 'error']) console[m] = () => {};
process.env.DATABASE_URL = 'postgres://prueba:prueba@127.0.0.1:9/prueba_sin_base';
process.env.WHATSAPP_PUENTE_TOKEN = '';

const { servir } = await import('./_servidorPrueba.js');

test('puerta GET /api/sistemas/v1/pendientes-planta: con produccion.leer o inicio.leer; sin alcance, 403', async () => {
    const { crearPuertas } = await import('../src/routes/sistemas/index.js');
    const { Configuracion } = await import('../src/models/index.js');
    const { default: SolicitudAlmacen } = await import('../src/models/SolicitudAlmacen.js');
    const { default: TicketDrive } = await import('../src/models/TicketDrive.js');
    const { default: LlaveSistema } = await import('../src/models/LlaveSistema.js');
    const originales = { cfg: Configuracion.findOne, sol: SolicitudAlmacen.findAll, tic: TicketDrive.findAll, llave: LlaveSistema.findOne };
    const llave = 'llave-de-prueba-operacion-0123456789';
    const huella = crypto.createHash('sha256').update(llave).digest('hex');
    try {
        Configuracion.findOne = async () => null;
        SolicitudAlmacen.findAll = async () => [];
        TicketDrive.findAll = async () => [];
        LlaveSistema.findOne = async () => { throw new Error('sin base'); };
        const app = express();
        app.use(crearPuertas({ env: {
            LLAVE_ENTRANTE_OPERACION_SHA256: huella, ALCANCES_OPERACION: 'produccion.leer',
            LLAVE_ENTRANTE_VENTAS_SHA256: huella, ALCANCES_VENTAS: 'latidos.leer'
        }, anotar: () => {} }));
        const s = await servir(app, 'pendientes');
        try {
            const ok = await s.pedir('GET', '/api/sistemas/v1/pendientes-planta', { headers: { Authorization: `Bearer ${llave}`, 'X-3G-Origen': 'operacion' } });
            assert.equal(ok.status, 200);
            assert.equal(ok.json.sistema, 'planta');
            assert.equal(ok.json.pedidos.porAtender, 0);
            assert.equal(ok.json.calendario.alDia, false);
            const no = await s.pedir('GET', '/api/sistemas/v1/pendientes-planta', { headers: { Authorization: `Bearer ${llave}`, 'X-3G-Origen': 'ventas' } });
            assert.equal(no.status, 403);
        } finally {
            await s.cerrar();
        }
    } finally {
        Configuracion.findOne = originales.cfg;
        SolicitudAlmacen.findAll = originales.sol;
        TicketDrive.findAll = originales.tic;
        LlaveSistema.findOne = originales.llave;
    }
});
