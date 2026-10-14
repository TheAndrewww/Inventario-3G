/**
 * Terminal de producción: «✓ COMPLETADO» de Diseño, Compras e Instalación.
 *
 * La tableta manda POST /api/produccion/terminal/:id/completar SIN cuerpo. Con Express 5
 * (body-parser 2), un POST sin cuerpo deja req.body en undefined (Express 4 lo dejaba en {}),
 * y completarEtapa desestructuraba req.body directo: respondía 500 y el proyecto no avanzaba.
 *
 * La prueba arma un Express igual al del servidor (express.json() y la misma ruta), le pone un
 * proyecto inventado en lugar de la base de datos y manda la petición por un socket local
 * (sin puertos de red). No toca ninguna base ni ningún servicio externo.
 *
 * Correr:  cd backend && npm test      (o: node --test tests/*.test.js, sin comillas: así sirve en Node 20)
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Lo que el servidor escribe con console.log (emojis, el aviso de dotenv) va por el mismo canal que usa
// `node --test` para sus resultados y a veces lo rompe («Unable to deserialize cloned data»). Se calla aquí;
// console.error (stderr) sigue saliendo.
for (const m of ['log', 'info', 'debug']) console[m] = () => {};

// Antes de cargar los modelos: base inexistente y avisos de WhatsApp apagados, para que aunque
// exista un backend/.env nada de la prueba pueda llegar a una base o a un servicio de verdad.
process.env.DATABASE_URL = 'postgres://prueba:prueba@127.0.0.1:9/prueba_sin_base';
process.env.WHATSAPP_PUENTE_TOKEN = '';

const express = (await import('express')).default;
const { ProduccionProyecto, AvisoWhatsApp } = await import('../src/models/index.js');
const { completarEtapa } = await import('../src/controllers/produccion.controller.js');

const originales = { findByPk: ProduccionProyecto.findByPk, create: AvisoWhatsApp.create };
let proyecto;
let llamadas;
let servidor;
const socket = path.join(os.tmpdir(), `terminal-completar-${process.pid}.sock`);

const proyectoInventado = (etapa) => ({
    id: 7,
    nombre: 'Obra de prueba',
    etapa_actual: etapa,
    async completarEtapaActual(usuarioId, observaciones) {
        llamadas.push({ usuarioId, observaciones });
        const siguiente = { diseno: 'compras', compras: 'produccion', instalacion: 'completado' };
        this.etapa_actual = siguiente[this.etapa_actual] || this.etapa_actual;
        return this;
    },
    toJSON() {
        return { id: this.id, nombre: this.nombre, etapa_actual: this.etapa_actual };
    },
    getDiasRestantes: () => 5,
    getPorcentajeAvance: () => 20
});

const pedir = ({ ruta, cuerpo, cabeceras = {} }) => new Promise((resolve, reject) => {
    const req = http.request({ socketPath: socket, path: ruta, method: 'POST', headers: cabeceras }, (res) => {
        let texto = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { texto += c; });
        res.on('end', () => resolve({ status: res.statusCode, json: texto ? JSON.parse(texto) : null }));
    });
    req.on('error', reject);
    if (cuerpo !== undefined) req.write(cuerpo);
    req.end();
});

before(async () => {
    ProduccionProyecto.findByPk = async (id) => (String(id) === String(proyecto?.id) ? proyecto : null);
    AvisoWhatsApp.create = async () => { throw new Error('la prueba no debe encolar avisos'); };

    // Igual que server.js y produccion.routes.js (la ruta de la terminal es pública).
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.post('/api/produccion/terminal/:id/completar', completarEtapa);
    app.post('/api/produccion/:id/completar-etapa', completarEtapa);

    fs.rmSync(socket, { force: true });
    servidor = http.createServer(app);
    await new Promise((resolve) => servidor.listen(socket, resolve));
});

after(async () => {
    ProduccionProyecto.findByPk = originales.findByPk;
    AvisoWhatsApp.create = originales.create;
    await new Promise((resolve) => servidor.close(resolve));
    fs.rmSync(socket, { force: true });
});

for (const [etapa, siguiente] of [['diseno', 'compras'], ['compras', 'produccion']]) {
    test(`terminal: POST sin cuerpo cierra ${etapa} y avanza a ${siguiente} (antes: 500)`, async () => {
        proyecto = proyectoInventado(etapa);
        llamadas = [];

        // Como la tableta: sin Content-Type y Content-Length 0 (Node lo pone solo al no escribir cuerpo).
        const r = await pedir({ ruta: '/api/produccion/terminal/7/completar' });

        assert.equal(r.status, 200, `respondió ${r.status}: ${JSON.stringify(r.json)}`);
        assert.equal(r.json.success, true);
        assert.equal(r.json.data.etapaAnterior, etapa);
        assert.equal(r.json.data.etapaNueva, siguiente);
        assert.deepEqual(llamadas, [{ usuarioId: null, observaciones: undefined }]);
    });
}

// Control: así NO manda la tableta (axios quita el Content-Type cuando no hay cuerpo), y por eso este caso
// ya funcionaba: con Content-Type JSON y cuerpo vacío, Express sí deja req.body en {}.
test('control: POST vacío con Content-Type JSON avanza (antes también)', async () => {
    proyecto = proyectoInventado('diseno');
    llamadas = [];

    const r = await pedir({
        ruta: '/api/produccion/terminal/7/completar',
        cabeceras: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': '0' }
    });

    assert.equal(r.status, 200, `respondió ${r.status}: ${JSON.stringify(r.json)}`);
    assert.equal(r.json.data.etapaNueva, 'compras');
});

test('panel: con cuerpo {observaciones} las sigue pasando igual que antes', async () => {
    proyecto = proyectoInventado('diseno');
    llamadas = [];

    const r = await pedir({
        ruta: '/api/produccion/7/completar-etapa',
        cuerpo: JSON.stringify({ observaciones: 'Planos revisados' }),
        cabeceras: { 'Content-Type': 'application/json' }
    });

    assert.equal(r.status, 200, `respondió ${r.status}: ${JSON.stringify(r.json)}`);
    assert.deepEqual(llamadas, [{ usuarioId: null, observaciones: 'Planos revisados' }]);
});

test('terminal: proyecto que no existe sigue respondiendo 404 (no 500)', async () => {
    proyecto = proyectoInventado('diseno');
    llamadas = [];

    const r = await pedir({ ruta: '/api/produccion/terminal/999/completar' });

    assert.equal(r.status, 404, `respondió ${r.status}: ${JSON.stringify(r.json)}`);
    assert.equal(llamadas.length, 0);
});
