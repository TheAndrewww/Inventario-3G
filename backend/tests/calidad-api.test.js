/**
 * API /api/calidad: apagada responde 404 sin tocar nada; vincular con un código de un solo uso (solo huellas en la
 * base, límite de intentos, vencido, usado, revocado); quién puede qué (tableta, sesión de almacén o de administración);
 * el flujo de la tableta (atributos, puntos, cambioId repetido, obra que cambió de renglón, aval, reporte en PDF) y la
 * versión de la app.
 *
 * Sin base: repositorios en memoria y una sesión de mentira («Bearer sesion-<rol>»). Peticiones por un socket local.
 * Correr:  cd backend && npm test
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

for (const m of ['log', 'info', 'debug', 'warn']) console[m] = () => {};
process.env.DATABASE_URL = 'postgres://prueba:prueba@127.0.0.1:9/prueba_sin_base';
process.env.WHATSAPP_PUENTE_TOKEN = '';

const express = (await import('express')).default;
const { ProduccionProyecto } = await import('../src/models/index.js');
const S = await import('../src/services/calidad.service.js');
const R = await import('../src/routes/calidad.routes.js');
const { crearRepoMemoria } = await import('./_calidadMemoria.js');
const { servir } = await import('./_servidorPrueba.js');

const BANDERAS = ['PANEL_CALIDAD', 'CALIDAD_AVAL_CIERRA', 'CALIDAD_DEFECTO_REABRE'];
const guardadas = Object.fromEntries(BANDERAS.map((n) => [n, process.env[n]]));
const banderas = (b = {}) => {
    for (const n of BANDERAS) delete process.env[n];
    for (const [n, v] of Object.entries(b)) process.env[n] = v;
};

/** Tabletas y códigos en memoria (la forma de repoDispositivosSequelize). */
const repoDispositivosMemoria = () => {
    let sec = 0;
    const codigos = [];
    const dispositivos = [];
    return {
        _codigos: codigos, _dispositivos: dispositivos,
        async crearCodigo(d) { const c = { id: ++sec, usado_en: null, created_at: new Date(), ...d }; codigos.push(c); return c; },
        async codigoPorHuella(h) { return codigos.find((c) => c.codigo_hash === h) || null; },
        async usarCodigo(id, ahora) { const c = codigos.find((x) => x.id === id); if (!c || c.usado_en) return false; c.usado_en = ahora; return true; },
        async ligarCodigo(id, d) { codigos.find((x) => x.id === id).dispositivo_id = d; },
        async crearDispositivo(d) { const x = { id: ++sec, revocado: false, created_at: new Date(), ...d }; dispositivos.push(x); return x; },
        async dispositivoPorHuella(h) { return dispositivos.find((d) => d.token_hash === h) || null; },
        async tocarDispositivo(id, ahora) { dispositivos.find((d) => d.id === id).ultimo_uso = ahora; },
        async dispositivos() { return [...dispositivos]; },
        async dispositivoPorId(id) { return dispositivos.find((d) => d.id === id) || null; },
        async revocar(d, ahora) { d.revocado = true; d.revocado_en = ahora; return d; },
        async limpiarCodigos() {}
    };
};

const sesionDeMentira = (req, res, next) => {
    const t = (/^Bearer\s+sesion-(\S+)$/.exec(req.get('Authorization') || '') || [])[1];
    if (!t) return res.status(401).json({ success: false, message: 'Token inválido' });
    req.usuario = { id: 77, nombre: t === 'administrador' ? 'Oficina' : 'Charly', rol: t, activo: true };
    return next();
};

let repo;
let disp;
let reportes;
let avisos;
let versionApp;
let s;
const armar = async (extra = {}) => {
    const app = express();
    app.use(express.json());
    app.use(R.PREFIJO_CALIDAD, R.crearRutasCalidad({
        repo, repoDispositivos: disp, verificarSesion: sesionDeMentira, intentosVincular: 3,
        fechaDe: (p) => ({ fecha: p.fecha_limite || null, fuente: p.fecha_limite ? 'indice' : null }),
        encolarReporte: (id) => reportes.push(id), avisar: async (d) => { avisos.push(d); },
        leerVersionApp: async () => versionApp(), logo: null, ...extra
    }));
    // Lo que hay después en /api (como en server.js): si /api/calidad lo dejara pasar, se notaría
    app.use('/api', (req, res) => res.status(418).json({ error: 'llegó a otra ruta' }));
    s = await servir(app, 'calidad-api');
    return s;
};
const tableta = (token) => ({ headers: { Authorization: `Bearer ${token}` } });
const sesion = (rol) => ({ headers: { Authorization: `Bearer sesion-${rol}` } });

beforeEach(() => {
    banderas({ PANEL_CALIDAD: '1' });
    repo = crearRepoMemoria(ProduccionProyecto);
    S.usarRepoCalidad(repo);
    disp = repoDispositivosMemoria();
    reportes = [];
    avisos = [];
    versionApp = async () => null;
});
afterEach(async () => {
    if (s) await s.cerrar();
    s = null;
    S.usarRepoCalidad(null);
    for (const n of BANDERAS) { if (guardadas[n] === undefined) delete process.env[n]; else process.env[n] = guardadas[n]; }
});

/** Vincula una tableta con un código que genera la administración. → token */
const vincular = async (nombre = 'Tableta de Charly') => {
    const c = await s.pedir('POST', '/api/calidad/codigos', sesion('administrador'));
    assert.equal(c.status, 201, c.texto);
    const v = await s.pedir('POST', '/api/calidad/vincular', { cuerpo: { codigo: c.json.codigo, nombreDispositivo: nombre } });
    assert.equal(v.status, 201, v.texto);
    return v.json.token;
};

test('apagada (sin PANEL_CALIDAD): todo /api/calidad responde 404 y no lee ni escribe nada', async () => {
    banderas({});
    const tocado = [];
    const espia = new Proxy({}, { get: (_, k) => () => { tocado.push(k); throw new Error('no debía tocarse'); } });
    repo = espia;
    S.usarRepoCalidad(espia);
    disp = espia;
    await armar({ repo: espia, repoDispositivos: espia, leerVersionApp: async () => { tocado.push('version'); return { version: '1.0.0' }; } });
    const rutas = [
        ['POST', '/api/calidad/vincular', { cuerpo: { codigo: 'K7M2Q9XR' } }], ['GET', '/api/calidad/yo', sesion('administrador')],
        ['GET', '/api/calidad/config', tableta('cal_x')], ['GET', '/api/calidad/obras?vista=taller', sesion('administrador')],
        ['GET', '/api/calidad/obras/1', sesion('administrador')], ['PUT', '/api/calidad/obras/1/puntos/M1', { ...sesion('administrador'), cuerpo: { estado: 'ok' } }],
        ['POST', '/api/calidad/obras/1/avalar', sesion('administrador')], ['GET', '/api/calidad/obras/1/reporte.pdf', sesion('administrador')],
        ['POST', '/api/calidad/codigos', sesion('administrador')], ['GET', '/api/calidad/dispositivos', sesion('administrador')],
        ['GET', '/api/calidad/app/version.json', {}], ['GET', '/api/calidad', {}], ['GET', '/api/calidad/cualquier/cosa', {}]
    ];
    for (const [metodo, ruta, op] of rutas) {
        const r = await s.pedir(metodo, ruta, op);
        assert.equal(r.status, 404, `${metodo} ${ruta}`);
        assert.equal(r.json.error, 'No existe esa ruta en Planta.');
    }
    assert.deepEqual(tocado, []);
});

test('vincular: código de un solo uso (8 caracteres sin ambiguos), solo huellas guardadas, el token se ve una vez', async () => {
    await armar();
    const c = await s.pedir('POST', '/api/calidad/codigos', sesion('administrador'));
    assert.equal(c.status, 201);
    assert.match(c.json.codigo, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    assert.equal(c.json.minutos, 15);
    assert.equal(c.json.enlace, `calidad3g://vincular?c=${c.json.codigo}`);
    assert.ok(Math.abs(new Date(c.json.vence) - Date.now() - 15 * 60000) < 5000);
    // Se escribe en minúsculas y con guion, como en la app de Carla
    const escrito = `${c.json.codigo.slice(0, 4).toLowerCase()}-${c.json.codigo.slice(4)}`;
    const v = await s.pedir('POST', '/api/calidad/vincular', { cuerpo: { codigo: escrito, nombreDispositivo: '  Tableta   de Charly ' } });
    assert.equal(v.status, 201);
    assert.match(v.json.token, /^cal_[A-Za-z0-9_-]{40,}$/);
    assert.deepEqual(v.json.dispositivo, { id: disp._dispositivos[0].id, nombre: 'Tableta de Charly' });
    // En la base solo huellas
    const guardado = JSON.stringify([disp._codigos, disp._dispositivos]);
    assert.ok(!guardado.includes(c.json.codigo), 'el código no se guarda');
    assert.ok(!guardado.includes(v.json.token), 'el token no se guarda');
    assert.equal(disp._dispositivos[0].token_hash, R.huella(v.json.token));
    // Con el token ya entra; la lista de tabletas nunca enseña el token ni la huella
    const yo = await s.pedir('GET', '/api/calidad/yo', tableta(v.json.token));
    assert.equal(yo.status, 200);
    assert.deepEqual(yo.json.dispositivo, { id: v.json.dispositivo.id, nombre: 'Tableta de Charly' });
    assert.deepEqual(yo.json.banderas, { avalCierra: false, defectoReabre: false });
    const lista = await s.pedir('GET', '/api/calidad/dispositivos', sesion('administrador'));
    assert.equal(lista.json.dispositivos.length, 1);
    assert.ok(!lista.texto.includes('token') && !lista.texto.includes(R.huella(v.json.token)));
    // El mismo código otra vez: ya se usó
    const otraVez = await s.pedir('POST', '/api/calidad/vincular', { cuerpo: { codigo: c.json.codigo } });
    assert.equal(otraVez.status, 403);
    assert.match(otraVez.json.error, /ya se usó o ya venció/);
});

test('vincular: vencido, mal escrito y límite de intentos (los aciertos no cuentan)', async () => {
    await armar();
    const c = await s.pedir('POST', '/api/calidad/codigos', sesion('administrador'));
    disp._codigos[0].vence = new Date(Date.now() - 1000);
    assert.equal((await s.pedir('POST', '/api/calidad/vincular', { cuerpo: { codigo: c.json.codigo } })).status, 403, 'vencido');
    assert.equal((await s.pedir('POST', '/api/calidad/vincular', { cuerpo: { codigo: 'K7M2Q9X0' } })).status, 403, 'con 0');
    // Un acierto en medio no suma
    const bueno = await s.pedir('POST', '/api/calidad/codigos', sesion('administrador'));
    assert.equal((await s.pedir('POST', '/api/calidad/vincular', { cuerpo: { codigo: bueno.json.codigo } })).status, 201);
    assert.equal((await s.pedir('POST', '/api/calidad/vincular', { cuerpo: {} })).status, 403);
    const bloqueado = await s.pedir('POST', '/api/calidad/vincular', { cuerpo: { codigo: 'AAAAAAAA' } });
    assert.equal(bloqueado.status, 429);
    assert.match(bloqueado.json.error, /Demasiados intentos/);
    assert.ok(Number(bloqueado.headers['retry-after']) > 0);
});

test('quién puede qué: tableta, almacén y administración; revocada ya no entra', async () => {
    await armar();
    const token = await vincular();
    // Sin nada, sesión inválida, rol sin acceso
    assert.equal((await s.pedir('GET', '/api/calidad/yo')).status, 401);
    const mala = await s.pedir('GET', '/api/calidad/yo', { headers: { Authorization: 'Bearer otra-cosa' } });
    assert.equal(mala.status, 401);
    assert.deepEqual(mala.json, { error: 'Token inválido' }, 'los errores de la sesión también salen como { error }');
    assert.equal((await s.pedir('GET', '/api/calidad/yo', sesion('diseñador'))).status, 403);
    assert.equal((await s.pedir('GET', '/api/calidad/yo', tableta('cal_inventado'))).status, 401);
    // Almacén lee y marca, pero no administra tabletas
    const yo = await s.pedir('GET', '/api/calidad/yo', sesion('almacen'));
    assert.deepEqual(yo.json.usuario, { nombre: 'Charly', rol: 'almacen' });
    assert.equal((await s.pedir('POST', '/api/calidad/codigos', sesion('almacen'))).status, 403);
    assert.equal((await s.pedir('POST', '/api/calidad/codigos', tableta(token))).status, 403);
    assert.equal((await s.pedir('GET', '/api/calidad/dispositivos', tableta(token))).status, 403);
    // Revocar
    const id = disp._dispositivos[0].id;
    const rv = await s.pedir('POST', `/api/calidad/dispositivos/${id}/revocar`, sesion('administrador'));
    assert.equal(rv.status, 200);
    assert.equal(rv.json.dispositivo.revocado, true);
    const fuera = await s.pedir('GET', '/api/calidad/yo', tableta(token));
    assert.equal(fuera.status, 401);
    assert.equal(fuera.json.codigo, 'TABLETA_NO_VINCULADA');
    assert.equal((await s.pedir('POST', '/api/calidad/dispositivos/9999/revocar', sesion('administrador'))).status, 404);
    assert.equal((await s.pedir('GET', '/api/calidad/no-existe', sesion('administrador'))).status, 404);
});

test('la tableta: atributos, puntos, cambioId repetido, obra que cambió de renglón, aval y reporte en PDF', async () => {
    await armar();
    const token = await vincular();
    repo.agregarProyecto({ id: 7, nombre: 'LONA ESCUELA RURAL', cliente: 'Escuela tel 462 555 0101', fecha_limite: '2026-11-04', etapa_actual: 'produccion' }, '3G-26-0707');
    const t = tableta(token);
    const cfg = await s.pedir('GET', '/api/calidad/config', t);
    assert.equal(cfg.json.version, '2026-10-16');
    assert.equal(cfg.json.config.hojas.length, 2);

    let r = await s.pedir('PUT', '/api/calidad/obras/7/atributos', { ...t, cuerpo: { atributos: { lleva_membrana: true, lleva_estructura: false, acabado_estructura: 'ninguno' }, cambioId: 'a-1' } });
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.hoja.conteos.total, 8);
    r = await s.pedir('PUT', '/api/calidad/obras/7/puntos/M2', { ...t, cuerpo: { estado: 'defecto', nota: '' } });
    assert.equal(r.status, 400);
    assert.match(r.json.error, /necesita una nota/);
    r = await s.pedir('PUT', '/api/calidad/obras/7/puntos/M1', { ...t, cuerpo: { estado: 'na' } });
    assert.equal(r.status, 400);
    const p1 = await s.pedir('PUT', '/api/calidad/obras/7/puntos/M2', { ...t, cuerpo: { estado: 'defecto', nota: 'Corte corto', saleAsi: false, cambioId: 'p-1', cuando: '2026-10-20T10:00:00Z' } });
    assert.equal(p1.status, 200);
    assert.equal(p1.json.punto.actualizadoPor, 'Tableta de Charly');
    const p2 = await s.pedir('PUT', '/api/calidad/obras/7/puntos/M2', { ...t, cuerpo: { estado: 'defecto', nota: 'Corte corto', saleAsi: false, cambioId: 'p-1', cuando: '2026-10-20T10:00:00Z' } });
    assert.equal(p2.status, 200);
    assert.equal(p2.json.repetido, true);
    assert.deepEqual({ ...p2.json, repetido: false }, p1.json);
    // La tableta cree que el 7 es otra obra: no escribe
    const cambio = await s.pedir('PUT', '/api/calidad/obras/7/puntos/M1', { ...t, cuerpo: { estado: 'ok', proyecto: 'OTRA OBRA' } });
    assert.equal(cambio.status, 409);
    assert.equal(cambio.json.codigo, 'OBRA_CAMBIO');
    // Por ID 3G también
    const porId = await s.pedir('GET', '/api/calidad/obras/3G-26-0707', t);
    assert.equal(porId.status, 200);
    assert.equal(porId.json.obra.proyectoId, 7);
    assert.equal(porId.json.obra.cliente, 'Escuela tel •••', 'sin teléfonos');
    assert.deepEqual(porId.json.obra.fechaInstalacion, { fecha: '2026-11-04', fuente: 'indice' });
    // Lista del taller
    const taller = await s.pedir('GET', '/api/calidad/obras?vista=taller', t);
    assert.deepEqual(taller.json.obras.map((o) => [o.proyectoId, o.hoja.estado]), [[7, 'con_defectos']]);
    assert.equal((await s.pedir('GET', '/api/calidad/obras?vista=todas', t)).status, 400);
    // Avalar antes de tiempo: 409 con el porqué
    r = await s.pedir('POST', '/api/calidad/obras/7/avalar', { ...t, cuerpo: {} });
    assert.equal(r.status, 409);
    assert.ok(r.json.porQueNo.length >= 1);
    for (const id of ['M1', 'M5', 'M9', 'M11', 'M12', 'M13', 'M14']) {
        assert.equal((await s.pedir('PUT', `/api/calidad/obras/7/puntos/${id}`, { ...t, cuerpo: { estado: 'ok', proyecto: 'Lona Escuela Rural' } })).status, 200);
    }
    r = await s.pedir('PUT', '/api/calidad/obras/7/puntos/M2', { ...t, cuerpo: { estado: 'defecto', nota: 'Corte corto, autorizado por el supervisor', saleAsi: true } });
    assert.equal(r.json.hoja.estado, 'lista');
    r = await s.pedir('POST', '/api/calidad/obras/7/avalar', { ...t, cuerpo: { nombre: 'Charly', observacionesInstalacion: 'Revisar tensión al montar', cambioId: 'aval-1' } });
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.hoja.estado, 'avalada');
    assert.equal(reportes.length, 1);
    assert.deepEqual(avisos, [], 'sin CALIDAD_AVAL_CIERRA no avisa ni cierra');
    // El reporte
    const pdf = await s.pedir('GET', '/api/calidad/obras/7/reporte.pdf', t);
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers['content-type'], 'application/pdf');
    assert.equal(pdf.cuerpo.subarray(0, 5).toString(), '%PDF-');
    assert.match(pdf.headers['content-disposition'], /CALIDAD - 3G-26-0707 - \d{4}-\d{2}-\d{2}\.pdf/);
    // Una obra sin hoja no tiene reporte
    repo.agregarProyecto({ id: 8, nombre: 'SIN HOJA' });
    assert.equal((await s.pedir('GET', '/api/calidad/obras/8/reporte.pdf', t)).status, 404);
    // Reabrir pide motivo
    assert.equal((await s.pedir('POST', '/api/calidad/obras/7/reabrir', { ...t, cuerpo: {} })).status, 400);
    assert.equal((await s.pedir('POST', '/api/calidad/obras/7/reabrir', { ...t, cuerpo: { motivo: 'Cambió el color' } })).status, 200);
    // La web (almacén) ve lo mismo
    const web = await s.pedir('GET', '/api/calidad/obras/7', sesion('almacen'));
    assert.equal(web.status, 200);
    assert.equal(web.json.hoja.estado, 'lista');
    assert.ok(web.json.eventos.some((e) => e.tipo === 'reabrio'));
    assert.equal((await s.pedir('GET', '/api/calidad/obras/999', t)).status, 404);
});

test('versión de la app: sin configurar 404; configurada la regresa; si falla 503', async () => {
    await armar();
    let r = await s.pedir('GET', '/api/calidad/app/version.json');
    assert.equal(r.status, 404);
    assert.match(r.json.error, /no está configurada/);
    versionApp = async () => ({ version: '1.0.0', versionCode: 1, apk: 'https://ejemplo.invalid/3g-calidad-1.0.0.apk' });
    r = await s.pedir('GET', '/api/calidad/app/version.json');
    assert.equal(r.status, 200);
    assert.equal(r.json.versionCode, 1);
    versionApp = async () => { throw new Error('caído'); };
    r = await s.pedir('GET', '/api/calidad/app/version.json');
    assert.equal(r.status, 503);
});
