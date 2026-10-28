/**
 * API del panel de calidad (28-oct-2026, «3G Calidad»): la tableta de Charly y la pantalla web de Planta.
 *
 * Con PANEL_CALIDAD apagada TODO /api/calidad responde 404 (como si no existiera) y no lee ni escribe nada.
 *
 * Quién entra:
 *   - La tableta: «Authorization: Bearer cal_…», el token que recibió al vincularse con un código de un solo uso. Planta
 *     guarda solo su huella SHA-256; revocado o desconocido → 401 TABLETA_NO_VINCULADA.
 *   - La web: la sesión de Planta (el JWT de siempre, por verificarToken) con rol administrador o almacen. Las rutas de
 *     administración (códigos y tabletas) solo con administrador.
 * Errores { error: 'texto' } en español. `vincular` lleva límite de intentos (10 equivocados cada 15 min por IP).
 *
 *   POST /vincular                    { codigo, nombreDispositivo } → { token, dispositivo: { id, nombre } } (el token se ve una vez)
 *   GET  /app/version.json            para que la app se actualice sola (CALIDAD_APP_VERSION_URL o _ARCHIVO; sin ellas 404)
 *   GET  /yo                          la tableta o el usuario y las banderas que importan a la pantalla
 *   GET  /config                      el checklist y su versión
 *   GET  /obras?vista=taller|listas|avaladas
 *   GET  /obras/:obra                 la hoja completa (:obra = proyectoId o ID 3G)
 *   PUT  /obras/:obra/atributos       { atributos, cambioId }
 *   PUT  /obras/:obra/puntos/:punto   { estado, nota, saleAsi, cambioId, cuando }
 *   POST /obras/:obra/avalar          { nombre, observacionesInstalacion, nota, cambioId }
 *   POST /obras/:obra/reabrir         { motivo }
 *   GET  /obras/:obra/reporte.pdf
 *   POST /sugerencias/:id/aplicar · /sugerencias/:id/descartar
 *   POST /codigos · GET /dispositivos · POST /dispositivos/:id/revocar    (solo administrador)
 *
 * Las escrituras pueden traer `proyecto` (el nombre que la tableta tiene guardado): si la obra de ese proyectoId ya se
 * llama distinto (el renglón del Excel se movió), responde 409 en vez de escribir en otra obra.
 */
import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { Op } from 'sequelize';
import { verificarToken } from '../middleware/auth.middleware.js';
import { panelCalidad, calidadAvalCierra, calidadDefectoReabre } from '../utils/banderasCalidad.js';
import { CalidadDispositivo, CalidadCodigo } from '../models/Calidad.js';
import * as S from '../services/calidad.service.js';
import { VERSION_CONFIG } from '../services/checklistCalidad.js';

export const PREFIJO_CALIDAD = '/api/calidad';
// Sin I, L, O, 0 ni 1: se confunden al dictarlos o leerlos en la tableta
export const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LARGO_CODIGO = 8;
export const MINUTOS_CODIGO = 15;
const PREFIJO_TOKEN = 'cal_';
const ROLES_WEB = ['administrador', 'almacen'];

export const huella = (texto) => crypto.createHash('sha256').update(String(texto), 'utf8').digest('hex');
export const nuevoCodigo = () => Array.from({ length: LARGO_CODIGO }, () => ALFABETO_CODIGO[crypto.randomInt(ALFABETO_CODIGO.length)]).join('');
/** «k7m2-q9xr» → «K7M2Q9XR»; null si no tiene la forma de un código. */
export const normalizarCodigo = (v) => {
    const t = String(v ?? '').toUpperCase().replace(/[\s-]/g, '');
    if (t.length !== LARGO_CODIGO || [...t].some((c) => !ALFABETO_CODIGO.includes(c))) return null;
    return t;
};

/** Las tabletas y los códigos en la base (las pruebas pasan uno en memoria con la misma forma). */
export const repoDispositivosSequelize = {
    async crearCodigo(d) { return CalidadCodigo.create(d); },
    async codigoPorHuella(h) { return CalidadCodigo.findOne({ where: { codigo_hash: h } }); },
    /** Marca el código como usado solo si nadie lo usó antes (dos tabletas con el mismo código: gana una). */
    async usarCodigo(id, ahora) {
        const [n] = await CalidadCodigo.update({ usado_en: ahora }, { where: { id, usado_en: null } });
        return n === 1;
    },
    async ligarCodigo(id, dispositivoId) { await CalidadCodigo.update({ dispositivo_id: dispositivoId }, { where: { id } }); },
    async crearDispositivo(d) { return CalidadDispositivo.create(d); },
    async dispositivoPorHuella(h) { return CalidadDispositivo.findOne({ where: { token_hash: h } }); },
    async tocarDispositivo(id, ahora) { await CalidadDispositivo.update({ ultimo_uso: ahora }, { where: { id } }); },
    async dispositivos() { return CalidadDispositivo.findAll({ order: [['revocado', 'ASC'], ['created_at', 'DESC']], limit: 100 }); },
    async dispositivoPorId(id) { return CalidadDispositivo.findByPk(id); },
    async revocar(d, ahora) { return d.update({ revocado: true, revocado_en: ahora }); },
    async limpiarCodigos(ahora) { await CalidadCodigo.destroy({ where: { vence: { [Op.lt]: new Date(ahora.getTime() - 86400000) } } }); }
};

const iso = (v) => (v ? new Date(v).toISOString() : null);
const vistaDispositivo = (d) => ({
    id: d.id, nombre: d.nombre, creado: iso(d.created_at), ultimoUso: iso(d.ultimo_uso), revocado: !!d.revocado,
    revocadoEn: iso(d.revocado_en), creadoPor: d.creado_por || null
});

/** verificarToken responde { success, message }: aquí todo es { error }. */
const respuestaAdaptada = (res) => ({
    status(c) { res.status(c); return this; },
    set(...a) { res.set(...a); return this; },
    json(b) {
        if (b && b.success === false) return res.json({ error: b.message || 'Sin acceso', ...(b.codigo ? { codigo: b.codigo } : {}) });
        return res.json(b);
    }
});

/**
 * @param {object} [o]
 * @param {object} [o.repo]              repositorio de calidad (el de la base si no se pasa)
 * @param {object} [o.repoDispositivos]  tabletas y códigos (el de la base si no se pasa)
 * @param {Function} [o.verificarSesion] (req, res, next) la sesión de Planta (verificarToken)
 * @param {number} [o.intentosVincular]  equivocados permitidos cada 15 min por IP (10)
 * @param {Function} [o.fechaDe]         (proyecto) → { fecha, fuente } de instalación (la de la puerta si no se pasa)
 * @param {Function} [o.generarPDF]      (vista) → Buffer del reporte (el de calidadReporte.service.js)
 * @param {Function} [o.encolarReporte]  (hojaId) encola la subida a Drive
 * @param {Function} [o.avisar]          aviso «Proyecto completado» (el de siempre)
 * @param {Function} [o.leerVersionApp]  () → objeto de version.json o null
 * @param {*} [o.logo]                   logo del reporte (null = sin logo; sin pasar, el de Cloudinary como el ticket)
 */
export const crearRutasCalidad = (o = {}) => {
    const router = express.Router();
    const repoDisp = o.repoDispositivos || repoDispositivosSequelize;
    const verificarSesion = o.verificarSesion || verificarToken;
    const repo = () => o.repo || undefined; // undefined = el repositorio por omisión del servicio

    // Apagada: como si no existiera (nada se lee ni se escribe)
    router.use((req, res, next) => (panelCalidad() ? next() : res.status(404).json({ error: 'No existe esa ruta en Planta.' })));
    router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

    const manejar = (fn) => async (req, res) => {
        try {
            const r = await fn(req, res);
            if (r === undefined || res.headersSent) return;
            res.status(r?.__codigo || 200).json(r?.__codigo ? r.cuerpo : r);
        } catch (e) {
            if (e instanceof S.ErrorCalidad) return res.status(e.codigo).json({ error: e.message, ...(e.extra || {}) });
            console.error(`[calidad] ${req.method} ${req.originalUrl.split('?')[0]}:`, e.message);
            return res.status(500).json({ error: 'Planta no pudo hacerlo; intenta de nuevo.' });
        }
    };

    // ---------- Vincular (sin sesión) ----------
    const limiteVincular = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: o.intentosVincular ?? 10,
        standardHeaders: false,
        legacyHeaders: false,
        skipSuccessfulRequests: true,
        requestWasSuccessful: (req, res) => res.statusCode < 400,
        keyGenerator: (req) => ipKeyGenerator(req.ip || 'sin-ip'),
        handler: (req, res) => {
            const reinicio = req.rateLimit?.resetTime instanceof Date ? req.rateLimit.resetTime.getTime() : Date.now() + 15 * 60000;
            const minutos = Math.max(1, Math.ceil((reinicio - Date.now()) / 60000));
            res.set('Retry-After', String(minutos * 60));
            return res.status(429).json({ error: `Demasiados intentos. Espera ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.` });
        }
    });

    router.post('/vincular', limiteVincular, manejar(async (req) => {
        const codigo = normalizarCodigo(req.body?.codigo);
        const nombre = String(req.body?.nombreDispositivo ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Tableta de calidad';
        const sinServir = { __codigo: 403, cuerpo: { error: `Ese código no sirve: está mal escrito, ya se usó o ya venció (duran ${MINUTOS_CODIGO} minutos). Pide uno nuevo en Planta.` } };
        if (!codigo) return sinServir;
        const ahora = new Date();
        const fila = await repoDisp.codigoPorHuella(huella(codigo));
        if (!fila || fila.usado_en || new Date(fila.vence) <= ahora) return sinServir;
        if (!(await repoDisp.usarCodigo(fila.id, ahora))) return sinServir;
        const token = PREFIJO_TOKEN + crypto.randomBytes(32).toString('base64url');
        const d = await repoDisp.crearDispositivo({ nombre, token_hash: huella(token), creado_por: fila.creado_por || null, ultimo_uso: ahora });
        await repoDisp.ligarCodigo(fila.id, d.id);
        console.log(`[calidad] tableta vinculada: «${nombre}» (${d.id})`);
        return { __codigo: 201, cuerpo: { token, dispositivo: { id: d.id, nombre: d.nombre } } };
    }));

    // ---------- Versión de la app (sin sesión: la app pregunta aunque no esté vinculada) ----------
    const leerVersionApp = o.leerVersionApp || (async () => {
        const url = String(process.env.CALIDAD_APP_VERSION_URL || '').trim();
        const archivo = String(process.env.CALIDAD_APP_VERSION_ARCHIVO || '').trim();
        if (/^https:\/\//i.test(url)) {
            const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        }
        if (archivo && fs.existsSync(archivo)) return JSON.parse(fs.readFileSync(archivo, 'utf8'));
        return null;
    });
    router.get('/app/version.json', manejar(async () => {
        let v;
        try {
            v = await leerVersionApp();
        } catch (e) {
            console.error('[calidad] no se pudo leer la versión de la app:', e.message);
            return { __codigo: 503, cuerpo: { error: 'No se pudo leer la versión de la app; intenta más tarde.' } };
        }
        if (!v || typeof v !== 'object') return { __codigo: 404, cuerpo: { error: 'La actualización de la app no está configurada.' } };
        return v;
    }));

    // ---------- Quién llama ----------
    const autenticar = async (req, res, next) => {
        const token = (/^Bearer\s+(.+)$/i.exec(req.get('Authorization') || '') || [])[1]?.trim();
        if (!token) return res.status(401).json({ error: 'Falta la sesión o el token de la tableta.' });
        if (token.startsWith(PREFIJO_TOKEN)) {
            try {
                const d = await repoDisp.dispositivoPorHuella(huella(token));
                if (!d || d.revocado) return res.status(401).json({ error: 'Esta tableta ya no está vinculada. Pide un código nuevo en Planta.', codigo: 'TABLETA_NO_VINCULADA' });
                req.calidad = { tipo: 'tableta', dispositivo: d, quien: d.nombre, origen: 'tableta', usuarioId: null };
                // El último uso se anota a lo más una vez por minuto, sin hacer esperar a la tableta
                const ahora = new Date();
                if (!d.ultimo_uso || ahora - new Date(d.ultimo_uso) > 60000) repoDisp.tocarDispositivo(d.id, ahora).catch(() => {});
                return next();
            } catch (e) {
                console.error('[calidad] no se pudo revisar la tableta:', e.message);
                return res.status(503).json({ error: 'Planta no pudo revisar la tableta; intenta de nuevo.' });
            }
        }
        return verificarSesion(req, respuestaAdaptada(res), () => {
            if (!req.usuario || !ROLES_WEB.includes(req.usuario.rol)) return res.status(403).json({ error: 'Tu usuario no tiene acceso al panel de calidad.' });
            req.calidad = { tipo: 'sesion', usuario: req.usuario, quien: req.usuario.nombre || 'Planta', origen: 'web', usuarioId: req.usuario.id ?? null };
            return next();
        });
    };
    router.use(autenticar);
    const soloAdministrador = (req, res, next) => (req.calidad?.tipo === 'sesion' && req.usuario?.rol === 'administrador'
        ? next()
        : res.status(403).json({ error: 'Solo la administración de Planta puede hacer esto.' }));

    const ctx = (req) => ({
        repo: repo(), quien: req.calidad.quien, origen: req.calidad.origen, usuarioId: req.calidad.usuarioId,
        ...(o.encolarReporte ? { encolarReporte: o.encolarReporte } : {}),
        ...(o.avisar ? { avisar: o.avisar } : {})
    });

    /** Si la tableta dice qué proyecto cree que es y ya se llama distinto, no se escribe en otra obra. */
    const revisarProyecto = async (req) => {
        const esperado = req.body?.proyecto;
        if (!esperado) return;
        const obra = await S.cargarObra(req.params.obra, { repo: repo() });
        if (obra && S.claveNombre(obra.nombre) !== S.claveNombre(esperado)) {
            throw new S.ErrorCalidad(409, `Esa obra ahora es «${obra.nombre}»: el renglón del Excel se movió. Actualiza la lista y vuelve a mandarlo.`, { codigo: 'OBRA_CAMBIO' });
        }
    };

    router.get('/yo', manejar(async (req) => ({
        dispositivo: req.calidad.tipo === 'tableta' ? { id: req.calidad.dispositivo.id, nombre: req.calidad.dispositivo.nombre } : null,
        usuario: req.calidad.tipo === 'sesion' ? { nombre: req.usuario.nombre || null, rol: req.usuario.rol } : null,
        banderas: { avalCierra: calidadAvalCierra(), defectoReabre: calidadDefectoReabre() },
        version: VERSION_CONFIG
    })));

    router.get('/config', manejar(async () => S.configParaApp()));

    router.get('/obras', manejar(async (req) => {
        const vista = String(req.query.vista || 'taller');
        if (!['taller', 'listas', 'avaladas'].includes(vista)) return { __codigo: 400, cuerpo: { error: '«vista» debe ser taller, listas o avaladas.' } };
        const P = await import('./sistemas/produccion.js');
        const foto = o.fechaDe ? null : await P.leerFotoDeBase();
        const ahora = new Date();
        return S.listarObras(vista, {
            repo: repo(), ahora, hoyMx: P.diaMexico(ahora), limpiar: P.sinDatos,
            fechaDe: o.fechaDe || ((p) => P.fechaDeObra(p, foto))
        });
    }));

    router.get('/obras/:obra', manejar(async (req) => {
        const v = await S.vistaObra(req.params.obra, { repo: repo() });
        const P = await import('./sistemas/produccion.js');
        const p = (await S.cargarObra(req.params.obra, { repo: repo() }))?.proyecto;
        const fecha = p ? (o.fechaDe ? o.fechaDe(p) : P.fechaDeObra(p, await P.leerFotoDeBase())) : null;
        return { ...v, obra: { ...v.obra, cliente: p ? P.sinDatos(p.cliente, 200) : null, fechaInstalacion: fecha } };
    }));

    router.put('/obras/:obra/atributos', manejar(async (req) => {
        await revisarProyecto(req);
        return S.cambiarAtributos(req.params.obra, req.body || {}, ctx(req));
    }));

    router.put('/obras/:obra/puntos/:punto', manejar(async (req) => {
        await revisarProyecto(req);
        return S.marcarPunto(req.params.obra, req.params.punto, req.body || {}, ctx(req));
    }));

    router.post('/obras/:obra/avalar', manejar(async (req) => {
        await revisarProyecto(req);
        return S.avalar(req.params.obra, req.body || {}, ctx(req));
    }));

    router.post('/obras/:obra/reabrir', manejar(async (req) => {
        await revisarProyecto(req);
        return S.reabrir(req.params.obra, req.body || {}, ctx(req));
    }));

    router.get('/obras/:obra/reporte.pdf', manejar(async (req, res) => {
        const { generarReporteDeObra } = await import('../services/calidadReporte.service.js');
        const r = await generarReporteDeObra(req.params.obra, {
            repo: repo(),
            ...(o.generarPDF ? { generarPDF: o.generarPDF } : {}),
            ...(o.fechaDe ? { fechaDe: o.fechaDe } : {}),
            ...(o.logo !== undefined ? { logo: o.logo } : {})
        });
        res.status(200).set('Content-Type', 'application/pdf').set('Content-Disposition', `inline; filename="${r.nombreArchivo.replace(/[^\w .-]/g, '_')}"`).send(r.pdf);
        return undefined;
    }));

    router.post('/sugerencias/:id/aplicar', manejar(async (req) => S.aplicarSugerencia(req.params.id, ctx(req))));
    router.post('/sugerencias/:id/descartar', manejar(async (req) => S.descartarSugerencia(req.params.id, ctx(req))));

    // ---------- Administración (solo sesión de administrador) ----------
    router.post('/codigos', soloAdministrador, manejar(async (req) => {
        const ahora = new Date();
        repoDisp.limpiarCodigos(ahora).catch(() => {});
        const codigo = nuevoCodigo();
        const vence = new Date(ahora.getTime() + MINUTOS_CODIGO * 60000);
        await repoDisp.crearCodigo({ codigo_hash: huella(codigo), vence, creado_por: req.usuario.nombre || null });
        return { __codigo: 201, cuerpo: { codigo, vence: vence.toISOString(), minutos: MINUTOS_CODIGO, enlace: `calidad3g://vincular?c=${codigo}` } };
    }));

    router.get('/dispositivos', soloAdministrador, manejar(async () => ({ dispositivos: (await repoDisp.dispositivos()).map(vistaDispositivo) })));

    router.post('/dispositivos/:id/revocar', soloAdministrador, manejar(async (req) => {
        const d = await repoDisp.dispositivoPorId(Number(req.params.id));
        if (!d) return { __codigo: 404, cuerpo: { error: 'No existe esa tableta.' } };
        if (!d.revocado) await repoDisp.revocar(d, new Date());
        return { ok: true, dispositivo: vistaDispositivo(d) };
    }));

    router.use((req, res) => res.status(404).json({ error: 'No existe esa ruta en Planta.' }));
    return router;
};

export default crearRutasCalidad;
