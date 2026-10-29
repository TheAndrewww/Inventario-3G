/**
 * Servidor de prueba por un socket local (sin puertos de red), como en puerta-produccion.test.js.
 * servir(app) → { pedir(metodo, ruta, { headers, cuerpo }), cerrar() }; la respuesta trae { status, headers, texto,
 * json (si es JSON), cuerpo (Buffer) }.
 */
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

let numero = 0;
export const servir = async (app, etiqueta = 'calidad') => {
    const servidor = http.createServer(app);
    const socket = path.join(os.tmpdir(), `${etiqueta}-${process.pid}-${++numero}.sock`);
    fs.rmSync(socket, { force: true });
    await new Promise((r) => servidor.listen(socket, r));
    const pedir = (metodo, ruta, { headers = {}, cuerpo } = {}) => new Promise((resolve, reject) => {
        const datos = cuerpo === undefined ? null : Buffer.from(JSON.stringify(cuerpo));
        const h = { ...headers, ...(datos ? { 'Content-Type': 'application/json', 'Content-Length': datos.length } : {}) };
        const req = http.request({ socketPath: socket, path: ruta, method: metodo, headers: h }, (res) => {
            const partes = [];
            res.on('data', (c) => partes.push(c));
            res.on('end', () => {
                const buf = Buffer.concat(partes);
                const texto = buf.toString('utf8');
                let json = null;
                if (/json/.test(res.headers['content-type'] || '')) { try { json = JSON.parse(texto); } catch { json = null; } }
                resolve({ status: res.statusCode, headers: res.headers, texto, json, cuerpo: buf });
            });
        });
        req.on('error', reject);
        if (datos) req.write(datos);
        req.end();
    });
    const cerrar = () => new Promise((r) => servidor.close(() => { fs.rmSync(socket, { force: true }); r(); }));
    return { pedir, cerrar };
};

export default servir;
