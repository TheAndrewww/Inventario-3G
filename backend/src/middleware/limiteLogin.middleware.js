import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

/**
 * Límite de intentos al entrar a Planta (A10 · PLA-02), solo en POST /api/auth/login.
 *
 * Bandera LOGIN_LIMITE:
 *   - «medir» (o sin poner): no bloquea a nadie. Anota en el registro la IP del
 *     cliente (req.ip) de cada intento fallido y cuándo habría bloqueado, sin el
 *     correo completo. Es la primera semana.
 *   - «1»: exige. 5 intentos fallidos cada 15 minutos por IP y correo, y 30 por
 *     IP (la oficina sale a internet con una sola IP). Responde 429 con
 *     Retry-After y «Demasiados intentos. Espera N minutos.»
 *   - «0»: apagado, como antes de A10 (ni cuenta ni anota).
 *
 * Solo cuentan los intentos fallidos (401): un acierto no cuenta y además
 * reinicia la cuenta de ese correo desde esa IP. Un error del servidor (500) o
 * una petición incompleta (400) tampoco cuentan.
 *
 * Necesita `app.set('trust proxy', 1)` en server.js: detrás del proxy de
 * Railway, sin eso todos comparten la IP del proxy y un descuido bloquearía a
 * todos.
 *
 * Las cuentas viven en memoria (un solo proceso en Railway): al reiniciar el
 * servidor empiezan de cero.
 */

const VENTANA_MS = 15 * 60 * 1000;
const LIMITE_IP_CORREO = 5;
const LIMITE_IP = 30;
const DEMASIADOS_INTENTOS = 'DEMASIADOS_INTENTOS';

export const modoLimiteLogin = () => {
    const valor = String(process.env.LOGIN_LIMITE ?? '').trim().toLowerCase();
    if (valor === '1') return 'exigir';
    if (valor === '0') return 'apagado';
    return 'medir';
};

// Cuántas veces habría bloqueado en «medir», desde que arrancó el servidor (va en el registro).
let habriaBloqueado = 0;

const ipDe = (req) => ipKeyGenerator(req.ip || 'sin-ip');
const correoDe = (req) => String(req.body?.email ?? '').trim().toLowerCase();
const claveIpCorreo = (req) => `${ipDe(req)}|${correoDe(req)}`;

// Para el registro: nunca el correo completo ni las IP intermedias.
const correoOculto = (correo) => {
    if (!correo) return '(vacío)';
    const [usuario, dominio] = correo.split('@');
    return dominio ? `${usuario.slice(0, 2)}***@${dominio}` : `${correo.slice(0, 2)}***`;
};
const saltos = (req) => String(req.headers['x-forwarded-for'] || '').split(',').filter((p) => p.trim()).length;
const quien = (req) => `ip=${req.ip} saltos=${saltos(req)} correo=${correoOculto(correoDe(req))}`;

const textoEspera = (minutos) => `Demasiados intentos. Espera ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`;

const alPasarse = (nombre) => (req, res, next) => {
    const info = req.rateLimit;
    const reinicio = info?.resetTime instanceof Date ? info.resetTime.getTime() : Date.now() + VENTANA_MS;
    const segundos = Math.max(1, Math.ceil((reinicio - Date.now()) / 1000));
    const minutos = Math.max(1, Math.ceil(segundos / 60));

    if (modoLimiteLogin() !== 'exigir') {
        habriaBloqueado += 1;
        console.warn(`[login-limite] medir · habría bloqueado (${nombre}) · ${quien(req)} · intento ${info?.used} de ${info?.limit} · ${habriaBloqueado} desde el arranque`);
        return next();
    }

    console.warn(`[login-limite] bloqueado (${nombre}) · ${quien(req)} · espera ${minutos} min`);
    res.set('Retry-After', String(segundos));
    return res.status(429).json({
        success: false,
        codigo: DEMASIADOS_INTENTOS,
        message: textoEspera(minutos),
        minutos,
        reintentarEn: segundos
    });
};

const comun = {
    windowMs: VENTANA_MS,
    standardHeaders: false,
    legacyHeaders: false,
    // Solo cuenta lo fallido: lo que no sea 401 se descuenta al terminar la respuesta.
    skipSuccessfulRequests: true,
    requestWasSuccessful: (req, res) => res.statusCode !== 401,
    skip: () => modoLimiteLogin() === 'apagado'
};

const porIp = rateLimit({
    ...comun,
    limit: LIMITE_IP,
    keyGenerator: ipDe,
    handler: alPasarse('IP')
});

const porIpYCorreo = rateLimit({
    ...comun,
    limit: LIMITE_IP_CORREO,
    keyGenerator: claveIpCorreo,
    handler: alPasarse('IP y correo')
});

// Un acierto reinicia la cuenta de ese correo desde esa IP; en «medir» anota cada fallido.
const despuesDeEntrar = (req, res, next) => {
    if (modoLimiteLogin() === 'apagado') return next();
    res.on('finish', async () => {
        try {
            if (res.statusCode === 200) {
                await porIpYCorreo.resetKey(claveIpCorreo(req));
            } else if (res.statusCode === 401 && modoLimiteLogin() === 'medir') {
                const [a, b] = await Promise.all([porIpYCorreo.getKey(claveIpCorreo(req)), porIp.getKey(ipDe(req))]);
                console.log(`[login-limite] medir · intento fallido · ${quien(req)} · ${a?.totalHits ?? 0} de ${LIMITE_IP_CORREO} por IP y correo, ${b?.totalHits ?? 0} de ${LIMITE_IP} por IP`);
            }
        } catch (error) {
            console.error('[login-limite] no se pudo anotar el intento:', error.message);
        }
    });
    next();
};

export const limiteLogin = [porIp, porIpYCorreo, despuesDeEntrar];

/**
 * E1 · PLA-23: la entrada con Cuentas 3G (POST /api/auth/cuentas3g) también pasa por el límite de A10, con la misma
 * bandera. Cuenta en el MISMO límite por IP que la contraseña (30 fallidos cada 15 min entre las dos). Antes del canje
 * no hay correo, así que no lleva el de IP y correo. Solo cuentan los 401 (ficha que no sirve, sin usuario en Planta,
 * usuario inactivo); un 503 porque Cuentas 3G no responde no cuenta.
 */
const despuesDeCuentas3g = (req, res, next) => {
    if (modoLimiteLogin() !== 'medir') return next();
    res.on('finish', async () => {
        if (res.statusCode !== 401) return;
        try {
            const b = await porIp.getKey(ipDe(req));
            console.log(`[login-limite] medir · intento fallido (cuenta 3G) · ip=${req.ip} saltos=${saltos(req)} · ${b?.totalHits ?? 0} de ${LIMITE_IP} por IP`);
        } catch (error) {
            console.error('[login-limite] no se pudo anotar el intento:', error.message);
        }
    });
    next();
};

export const limiteCuentas3g = [porIp, despuesDeCuentas3g];

console.log(`[login-limite] modo ${modoLimiteLogin()} (LOGIN_LIMITE): ${LIMITE_IP_CORREO} fallidos por IP y correo, ${LIMITE_IP} por IP, cada 15 min`);
