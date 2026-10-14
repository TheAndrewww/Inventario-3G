/**
 * Terminal de Instalación: «✓ COMPLETADO» no cierra la obra.
 *
 * En la terminal de Instalación salen las obras en «instalacion» (en el tablero: Completados /
 * Preparados). Cerrarlas pasa la obra a «completado», que está reservado para las obras cerradas en
 * el Índice (casilla Entregado): la sincronización con el Excel (cada 5 min) la regresa a Diseño si la
 * casilla no está marcada, y al cerrarla el gancho de ProduccionProyecto anula sus tickets abiertos.
 * Por eso la terminal (sin sesión) responde 409 con un mensaje; con sesión todo sigue igual.
 *
 * Sin base de datos ni puertos de red (socket local). Correr:  cd backend && npm test
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

process.env.DATABASE_URL = 'postgres://prueba:prueba@127.0.0.1:9/prueba_sin_base';
process.env.WHATSAPP_PUENTE_TOKEN = '';

const express = (await import('express')).default;
const { ProduccionProyecto, AvisoWhatsApp } = await import('../src/models/index.js');
const { completarEtapa } = await import('../src/controllers/produccion.controller.js');

const originales = { findByPk: ProduccionProyecto.findByPk, create: AvisoWhatsApp.create };
let proyecto;
let llamadas;
let servidor;
const socket = path.join(os.tmpdir(), `terminal-instalacion-${process.pid}.sock`);

const proyectoInventado = (etapa) => ({
    id: 8,
    nombre: 'Obra de prueba',
    etapa_actual: etapa,
    async completarEtapaActual(usuarioId) {
        llamadas.push(usuarioId);
        this.etapa_actual = this.etapa_actual === 'instalacion' ? 'completado' : this.etapa_actual;
        return this;
    },
    toJSON() {
        return { id: this.id, nombre: this.nombre, etapa_actual: this.etapa_actual };
    },
    getDiasRestantes: () => 0,
    getPorcentajeAvance: () => 100
});

const pedir = (ruta) => new Promise((resolve, reject) => {
    const req = http.request({ socketPath: socket, path: ruta, method: 'POST' }, (res) => {
        let texto = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { texto += c; });
        res.on('end', () => resolve({ status: res.statusCode, json: texto ? JSON.parse(texto) : null }));
    });
    req.on('error', reject);
    req.end();
});

before(async () => {
    ProduccionProyecto.findByPk = async (id) => (String(id) === String(proyecto?.id) ? proyecto : null);
    AvisoWhatsApp.create = async () => { throw new Error('la prueba no debe encolar avisos'); };

    const app = express();
    app.use(express.json());
    // Ruta pública de la terminal (sin sesión), como en produccion.routes.js
    app.post('/api/produccion/terminal/:id/completar', completarEtapa);
    // Ruta con sesión: aquí verificarToken ya dejó req.usuario
    app.post('/api/produccion/:id/completar-etapa', (req, _res, next) => {
        req.usuario = { id: 1, nombre: 'Usuario de prueba' };
        next();
    }, completarEtapa);

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

test('terminal de Instalación: 409 con mensaje y la obra no se cierra', async () => {
    proyecto = proyectoInventado('instalacion');
    llamadas = [];

    const r = await pedir('/api/produccion/terminal/8/completar');

    assert.equal(r.status, 409, `respondió ${r.status}: ${JSON.stringify(r.json)}`);
    assert.equal(r.json.success, false);
    assert.match(r.json.message, /Índice/);
    assert.equal(llamadas.length, 0);
    assert.equal(proyecto.etapa_actual, 'instalacion');
});

test('con sesión (ruta del panel) Instalación se sigue cerrando como antes', async () => {
    proyecto = proyectoInventado('instalacion');
    llamadas = [];

    const r = await pedir('/api/produccion/8/completar-etapa');

    assert.equal(r.status, 200, `respondió ${r.status}: ${JSON.stringify(r.json)}`);
    assert.deepEqual(llamadas, [1]);
    assert.equal(r.json.data.etapaNueva, 'completado');
});
