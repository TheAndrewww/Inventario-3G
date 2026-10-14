/* cuentas3g-cliente 1.1.2 · Cuentas 3G (CTA-08; 1.1.0 suma personas(), CTA-09; 1.1.1: personas() no reintenta en cada llamada;
 *   1.1.2: el reloj ya no se salta un tic y la lista y el catálogo llevan la hora en que se pidieron)
 *
 * Lo que cada sistema de 3G necesita para entrar con Cuentas 3G, en UN solo archivo que se copia SIN
 * CAMBIOS a cada sistema (como el paquete Diseño 3G; las huellas están en VERSION.md):
 *
 *   leerConfig(env)        CUENTAS3G_MODO (apagado | ambos | solo) y las demás variables; configuración
 *                          incompleta = se queda en «apagado» y lo dice (PLAN §8.3).
 *   crearCliente(opciones) → iniciar()            la ida a Cuentas 3G con PKCE S256, state y nonce
 *                          → regreso()            canje del código (servidor a servidor, con el secreto) y
 *                                                 validación de la ficha ES256 contra /jwks
 *                          → listaDeVersiones()   la lista firmada cada 60 s; guarda la última buena (en
 *                                                 memoria y en disco o base) y arranca con ella aunque
 *                                                 Cuentas 3G no responda
 *                          → sesionVigente()      ¿sigue valiendo esta sesión? (en cada petición)
 *                          → avisoDeBaja()        el aviso al instante (OpenID Back-Channel Logout)
 *                          → personas()           el catálogo de personas y códigos (C5) para Finanzas,
 *                                                 Operación y Planta, con copia en disco; sin Cuentas 3G
 *                                                 y sin copia: null (el sistema usa su configuración de hoy)
 *                          → arrancar(), estado()
 *   almacenEnDisco(ruta), almacenEnMemoria()     dónde guardar la última lista buena
 *   sellar() / abrir()     para guardar `temporal` en la cookie del sistema (firmada, 10 min)
 *   destinoInterno()       a dónde volver después de entrar: solo rutas propias («/…», nunca «//…»)
 *
 * Sin dependencias: Web Crypto y fetch de Node 18 o más (también sirve en funciones de Vercel). Nunca
 * guarda ni registra fichas, códigos ni secretos; la lista guardada solo trae {sub, ver, activo}.
 * El contrato (rutas, datos de la ficha, reglas) está en VERSION.md y en el README de Cuentas 3G.
 */
'use strict';

const VERSION = '1.1.2';

const MODOS = ['apagado', 'ambos', 'solo'];
const EVENTO_DE_BAJA = 'http://schemas.openid.net/event/backchannel-logout';
const MINUTO = 60 * 1000;
const DIA = 24 * 60 * MINUTO;
/** Holgura para relojes que no coinciden del todo (segundos). */
const HOLGURA_S = 60;

class ErrorCuentas3G extends Error {
  /** @param {string} codigo  @param {string} mensaje */
  constructor(codigo, mensaje) {
    super(mensaje || codigo);
    this.name = 'ErrorCuentas3G';
    this.codigo = codigo;
  }
}

// ── Utilidades (sin dependencias) ─────────────────────────────────────────────────────────────

function cripto() {
  if (globalThis.crypto && globalThis.crypto.subtle) return globalThis.crypto;
  // Node 18 sin el global: el mismo Web Crypto desde node:crypto.
  // eslint-disable-next-line global-require
  return require('node:crypto').webcrypto;
}

function aBase64url(bytes) {
  let s = '';
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64url(texto) {
  if (typeof texto !== 'string' || !/^[A-Za-z0-9_-]*$/.test(texto)) throw new ErrorCuentas3G('formato', 'Texto base64url inválido');
  const b = atob(texto.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((texto.length + 3) % 4));
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
}

const texto = (bytes) => new TextDecoder().decode(bytes);
const bytesDe = (t) => new TextEncoder().encode(t);

function azar(n) {
  const b = new Uint8Array(n);
  cripto().getRandomValues(b);
  return aBase64url(b);
}

async function sha256(t) {
  return new Uint8Array(await cripto().subtle.digest('SHA-256', bytesDe(t)));
}

function iguales(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

/** «https://» (o «http://» solo en localhost), sin usuario, consulta ni fragmento. */
function direccionValida(valor, { finalSinDiagonal = false } = {}) {
  let u;
  try {
    u = new URL(valor);
  } catch (e) {
    return false;
  }
  const h = u.hostname.replace(/^\[|\]$/g, '');
  const local = h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.localhost');
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) return false;
  if (u.username || u.password || u.search || u.hash || /[?#]/.test(valor)) return false;
  if (finalSinDiagonal && valor.endsWith('/')) return false;
  return true;
}

// ── Configuración (PLAN §8.3 y §8.7) ──────────────────────────────────────────────────────────

/**
 * Lee CUENTAS3G_MODO, CUENTAS3G_EMISOR, CUENTAS3G_CLIENTE_ID, CUENTAS3G_CLIENTE_SECRETO,
 * CUENTAS3G_REGRESO y CUENTAS3G_EMERGENCIA (o los nombres que se le den con `prefijo`, p. ej.
 * «VITE_CUENTAS3G_» para lo público de una SPA). Nunca devuelve el secreto en `aviso`.
 *
 * - Sin CUENTAS3G_MODO, o «apagado»: idéntico a hoy (modo «apagado»).
 * - Un modo desconocido: «apagado» y aviso.
 * - «ambos» o «solo» con algo faltante o mal escrito: «apagado» y aviso (nunca se abre, nunca se cae).
 */
function leerConfig(env, opciones) {
  const o = opciones || {};
  const p = o.prefijo || 'CUENTAS3G_';
  const leer = (n) => {
    const v = env && env[p + n];
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
  };
  const pedido = (leer('MODO') || 'apagado').toLowerCase();
  const faltan = [];
  const malas = [];
  const emisor = leer('EMISOR');
  const clienteId = leer('CLIENTE_ID');
  const clienteSecreto = leer('CLIENTE_SECRETO');
  const regreso = leer('REGRESO');
  const necesita = o.necesita || ['EMISOR', 'CLIENTE_ID', 'CLIENTE_SECRETO', 'REGRESO'];
  const valores = { EMISOR: emisor, CLIENTE_ID: clienteId, CLIENTE_SECRETO: clienteSecreto, REGRESO: regreso };
  for (const n of necesita) if (!valores[n]) faltan.push(p + n);
  if (emisor && !direccionValida(emisor, { finalSinDiagonal: true })) malas.push(p + 'EMISOR');
  if (regreso && !direccionValida(regreso)) malas.push(p + 'REGRESO');
  if (clienteId && !/^[a-z][a-z0-9-]{1,30}$/.test(clienteId)) malas.push(p + 'CLIENTE_ID');
  const emergencia = /^(1|si|sí|true)$/i.test(leer('EMERGENCIA') || '');
  const completa = faltan.length === 0 && malas.length === 0;
  let modo = MODOS.includes(pedido) ? pedido : 'apagado';
  let aviso = MODOS.includes(pedido) ? null : `${p}MODO «${pedido}» no existe (usa apagado, ambos o solo): se queda en apagado`;
  if (modo !== 'apagado' && !completa) {
    aviso = `Cuentas 3G pedido en «${modo}» pero la configuración está incompleta (${[...faltan.map((f) => `falta ${f}`), ...malas.map((m) => `${m} no es válida`)].join(', ')}): se queda en apagado`;
    modo = 'apagado';
  }
  return {
    modo,
    pedido,
    emergencia: modo === 'solo' && emergencia,
    completa,
    faltan,
    malas,
    aviso,
    cliente: completa ? { emisor, clienteId, clienteSecreto, regreso } : null,
  };
}

// ── Almacenes para la última lista buena ──────────────────────────────────────────────────────

function almacenEnMemoria() {
  let guardado = null;
  return {
    async leer() {
      return guardado;
    },
    async guardar(t) {
      guardado = t;
    },
  };
}

/** Un archivo local (se escribe en uno temporal y se renombra; permiso 600). Solo trae {sub, ver, activo}. */
function almacenEnDisco(ruta) {
  // eslint-disable-next-line global-require
  const fs = require('node:fs/promises');
  return {
    async leer() {
      try {
        return await fs.readFile(ruta, 'utf8');
      } catch (e) {
        return null;
      }
    },
    async guardar(t) {
      const tmp = `${ruta}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, t, { mode: 0o600 });
      await fs.rename(tmp, ruta);
    },
  };
}

// ── Cookie temporal firmada (state, nonce y verificador mientras la persona va a Cuentas 3G) ──

async function llaveHmac(secreto) {
  if (typeof secreto !== 'string' || secreto.length < 32) throw new ErrorCuentas3G('secreto', 'El secreto para sellar debe tener 32 caracteres o más');
  return cripto().subtle.importKey('raw', bytesDe(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

/** Sella `datos` (JSON) con HMAC-SHA256 y vencimiento: para la cookie temporal del sistema. */
async function sellar(datos, secreto, segundos, ahoraMs) {
  const exp = Math.floor((ahoraMs || Date.now()) / 1000) + (segundos || 600);
  const cuerpo = aBase64url(bytesDe(JSON.stringify({ d: datos, exp })));
  const firma = new Uint8Array(await cripto().subtle.sign('HMAC', await llaveHmac(secreto), bytesDe(cuerpo)));
  return `${cuerpo}.${aBase64url(firma)}`;
}

/** Abre lo sellado; `null` si la firma no cuadra o ya venció. */
async function abrir(valor, secreto, ahoraMs) {
  if (typeof valor !== 'string' || valor.length > 8192) return null;
  const [cuerpo, firma, sobra] = valor.split('.');
  if (!cuerpo || !firma || sobra !== undefined) return null;
  try {
    const esperada = new Uint8Array(await cripto().subtle.sign('HMAC', await llaveHmac(secreto), bytesDe(cuerpo)));
    if (!iguales(esperada, deBase64url(firma))) return null;
    const x = JSON.parse(texto(deBase64url(cuerpo)));
    if (!x || typeof x.exp !== 'number' || x.exp * 1000 < (ahoraMs || Date.now())) return null;
    return x.d;
  } catch (e) {
    return null;
  }
}

/** A dónde volver después de entrar: solo rutas propias. Lo demás → «/». */
function destinoInterno(valor) {
  if (typeof valor !== 'string' || valor.length > 2000) return '/';
  if (!valor.startsWith('/') || valor.startsWith('//') || valor.startsWith('/\\') || /[\u0000-\u001f]/.test(valor)) return '/';
  return valor;
}

// ── JWS ES256 ──────────────────────────────────────────────────────────────────────────────────

function partirJws(jws) {
  if (typeof jws !== 'string' || jws.length > 200000) throw new ErrorCuentas3G('formato', 'Ficha con formato inválido');
  const partes = jws.split('.');
  if (partes.length !== 3) throw new ErrorCuentas3G('formato', 'Ficha con formato inválido');
  let cab;
  let datos;
  try {
    cab = JSON.parse(texto(deBase64url(partes[0])));
    datos = JSON.parse(texto(deBase64url(partes[1])));
  } catch (e) {
    throw new ErrorCuentas3G('formato', 'Ficha con formato inválido');
  }
  if (!cab || typeof cab !== 'object' || !datos || typeof datos !== 'object') throw new ErrorCuentas3G('formato', 'Ficha con formato inválido');
  return { cab, datos, firmado: `${partes[0]}.${partes[1]}`, firma: deBase64url(partes[2]) };
}

async function verificarFirma(jws, buscarLlave) {
  const x = partirJws(jws);
  if (x.cab.alg !== 'ES256') throw new ErrorCuentas3G('algoritmo', 'Solo se aceptan fichas ES256');
  if (typeof x.cab.kid !== 'string' || !x.cab.kid) throw new ErrorCuentas3G('kid', 'La ficha no dice con qué llave se firmó');
  if (x.firma.length !== 64) throw new ErrorCuentas3G('firma', 'Firma inválida');
  const jwk = await buscarLlave(x.cab.kid);
  if (!jwk) throw new ErrorCuentas3G('kid', 'Llave desconocida');
  const llave = await cripto().subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const ok = await cripto().subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, llave, x.firma, bytesDe(x.firmado));
  if (!ok) throw new ErrorCuentas3G('firma', 'La firma no es de Cuentas 3G');
  return x;
}

// ── El cliente ─────────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} o
 * @param {string} o.emisor            CUENTAS3G_EMISOR (sin diagonal final)
 * @param {string} o.clienteId         CUENTAS3G_CLIENTE_ID (inicio, ventas, operacion, planta, finanzas, sitio)
 * @param {string} o.clienteSecreto    CUENTAS3G_CLIENTE_SECRETO
 * @param {string} o.regreso           CUENTAS3G_REGRESO: la dirección de regreso EXACTA registrada
 * @param {{leer(): Promise<string|null>, guardar(t: string): Promise<void>}} [o.almacen]  la última lista buena
 * @param {{leer(): Promise<string|null>, guardar(t: string): Promise<void>}} [o.almacenPersonas]  la última copia del catálogo
 * @param {number} [o.personasCadaMs]  cada cuánto, como mucho, pedir el catálogo (10 min)
 * @param {string[]} [o.niveles]       los niveles que entiende el sistema (otro nivel = no entra)
 * @param {boolean} [o.sinNivel]       aceptar fichas sin nivel (Planta en la fase 1: decide su tabla)
 * @param {number} [o.cadaMs]          cada cuánto pedir la lista (60 000)
 * @param {number} [o.limiteMs]        cuánto esperar a Cuentas 3G (3 000)
 * @param {typeof fetch} [o.pedir]     fetch (pruebas)
 * @param {() => number} [o.ahora]     reloj en ms (pruebas)
 * @param {{info?: Function, warn?: Function}} [o.registro]
 */
function crearCliente(o) {
  if (!o || !direccionValida(o.emisor || '', { finalSinDiagonal: true })) throw new ErrorCuentas3G('config', 'Falta el emisor de Cuentas 3G (https, sin diagonal final)');
  if (!o.clienteId || !o.clienteSecreto) throw new ErrorCuentas3G('config', 'Falta el cliente o el secreto de Cuentas 3G');
  if (!direccionValida(o.regreso || '')) throw new ErrorCuentas3G('config', 'Falta la dirección de regreso exacta');
  const emisor = o.emisor;
  const ahora = o.ahora || (() => Date.now());
  const pedir = o.pedir || ((...a) => fetch(...a));
  const almacen = o.almacen || almacenEnMemoria();
  const cadaMs = o.cadaMs || MINUTO;
  const limiteMs = o.limiteMs || 3000;
  const registro = o.registro || {};
  const basic = `Basic ${btoa(`${encodeURIComponent(o.clienteId)}:${encodeURIComponent(o.clienteSecreto)}`)}`;

  let jwks = null; // { keys, en }
  let jwksPedidoEn = 0;
  const jtis = new Map(); // jti → vence (ms)
  const cortes = new Map(); // sub → cuándo llegó su aviso (ms)
  let lista = null; // { personas: Map, en (ms, cuando se obtuvo), iat, origen }
  let ultimoError = null;
  let pidiendo = null;
  let otraLista = null; // 1.1.2: la lista que se pide en cuanto llegue la que viene en camino (ver `forzar`)
  let reloj = null;
  const almacenPersonas = o.almacenPersonas || almacenEnMemoria();
  const personasCadaMs = o.personasCadaMs || 10 * MINUTO;
  let catalogo = null; // { personas, en (ms), origen }
  let ultimoErrorCatalogo = null;
  let catalogoFallo = 0; // cuándo falló el último intento (ms); 0 = no falló
  let pidiendoCatalogo = null;
  let otroCatalogo = null;

  async function conLimite(url, init) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), limiteMs);
    try {
      return await pedir(url, { ...init, signal: ctrl.signal, redirect: 'manual' });
    } finally {
      clearTimeout(t);
    }
  }

  async function pedirJwks() {
    let r;
    try {
      r = await conLimite(`${emisor}/jwks`, { headers: { accept: 'application/json' } });
    } catch (e) {
      throw new ErrorCuentas3G('sin_respuesta', 'Cuentas 3G no responde');
    }
    if (r.status !== 200) throw new ErrorCuentas3G('jwks', `Cuentas 3G no dio sus llaves (${r.status})`);
    const j = await r.json();
    if (!j || !Array.isArray(j.keys)) throw new ErrorCuentas3G('jwks', 'Llaves con formato inválido');
    jwks = { keys: j.keys.filter((k) => k && k.kty === 'EC' && k.crv === 'P-256' && typeof k.kid === 'string' && !('d' in k)), en: ahora() };
    jwksPedidoEn = ahora();
    return jwks;
  }

  /** La llave pública de `kid`: 10 min en memoria; con un kid desconocido se vuelve a pedir (máximo 1 vez por minuto). */
  async function llavePara(kid) {
    if (!jwks || ahora() - jwks.en > 10 * MINUTO) await pedirJwks();
    let k = jwks.keys.find((x) => x.kid === kid);
    if (!k && ahora() - jwksPedidoEn >= MINUTO) {
      await pedirJwks();
      k = jwks.keys.find((x) => x.kid === kid);
    }
    return k || null;
  }

  function revisarTiempos(d, { exigirExp = true } = {}) {
    const s = Math.floor(ahora() / 1000);
    if (exigirExp && (typeof d.exp !== 'number' || d.exp + HOLGURA_S < s)) throw new ErrorCuentas3G('vencida', 'La ficha ya venció');
    if (typeof d.iat === 'number' && d.iat - HOLGURA_S > s) throw new ErrorCuentas3G('futuro', 'La ficha viene del futuro');
  }

  function revisarAudiencia(d) {
    const aud = Array.isArray(d.aud) ? d.aud : [d.aud];
    if (!aud.includes(o.clienteId)) throw new ErrorCuentas3G('audiencia', 'La ficha es de otro sistema');
    if (aud.length > 1 && d.azp !== o.clienteId) throw new ErrorCuentas3G('audiencia', 'La ficha es de otro sistema');
  }

  function recordarJti(jti) {
    const t = ahora();
    for (const [k, v] of jtis) if (v < t) jtis.delete(k);
    if (typeof jti !== 'string' || !jti) throw new ErrorCuentas3G('jti', 'La ficha no trae jti');
    if (jtis.has(jti)) throw new ErrorCuentas3G('repetida', 'Esa ficha ya se usó');
    jtis.set(jti, t + 10 * MINUTO);
  }

  /** 1. La ida: la dirección de /autorizar y lo que el sistema guarda en su cookie temporal (10 min). */
  async function iniciar(op) {
    const x = op || {};
    const temporal = { state: azar(24), nonce: azar(24), verificador: azar(48), despues: destinoInterno(x.despues || '/'), en: ahora() };
    const desafio = aBase64url(await sha256(temporal.verificador));
    const q = new URLSearchParams({
      client_id: o.clienteId,
      redirect_uri: o.regreso,
      response_type: 'code',
      scope: 'openid',
      state: temporal.state,
      nonce: temporal.nonce,
      code_challenge: desafio,
      code_challenge_method: 'S256',
    });
    if (x.pedirGoogle) q.set('prompt', 'login');
    return { url: `${emisor}/autorizar?${q}`, temporal };
  }

  /**
   * 2. El regreso: compara el state, canjea el código y valida la ficha. Devuelve a la persona para
   * crear la sesión del sistema (guardar sub, ver y nivel, y `en` = ahora).
   * `x`: { url } (la dirección completa del regreso) o { codigo, state }; y `temporal` (de iniciar()).
   * Planta (SPA): { codigo, temporal: { nonce, verificador } } sin state (lo compara la SPA).
   */
  async function regreso(x) {
    if (!x || !x.temporal) throw new ErrorCuentas3G('vencida', 'La entrada venció (vuelve a intentarlo)');
    let codigo = x.codigo;
    let state = x.state;
    if (x.url) {
      const u = new URL(x.url, o.regreso);
      if (`${u.origin}${u.pathname}` !== new URL(o.regreso).origin + new URL(o.regreso).pathname) throw new ErrorCuentas3G('regreso', 'Regresó a otra dirección');
      if (u.searchParams.get('error')) throw new ErrorCuentas3G('cancelada', 'No se terminó de entrar');
      codigo = u.searchParams.get('code');
      state = u.searchParams.get('state');
    }
    if (x.temporal.state !== undefined || state !== undefined) {
      if (typeof state !== 'string' || typeof x.temporal.state !== 'string' || !iguales(bytesDe(state), bytesDe(x.temporal.state))) throw new ErrorCuentas3G('state', 'La entrada no corresponde (otra pestaña o venció)');
    }
    if (typeof x.temporal.en === 'number' && ahora() - x.temporal.en > 10 * MINUTO) throw new ErrorCuentas3G('vencida', 'La entrada venció (más de 10 minutos)');
    if (typeof codigo !== 'string' || !codigo) throw new ErrorCuentas3G('codigo', 'Falta el código');

    const cuerpo = new URLSearchParams({ grant_type: 'authorization_code', code: codigo, redirect_uri: o.regreso, code_verifier: x.temporal.verificador });
    let r;
    try {
      r = await conLimite(`${emisor}/token`, { method: 'POST', headers: { authorization: basic, 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: cuerpo.toString() });
    } catch (e) {
      throw new ErrorCuentas3G('sin_respuesta', 'Cuentas 3G no responde');
    }
    let j = null;
    try {
      j = await r.json();
    } catch (e) {
      j = null;
    }
    if (r.status !== 200 || !j || typeof j.id_token !== 'string') throw new ErrorCuentas3G('canje', `Cuentas 3G no aceptó el código (${r.status}${j && j.error ? ` ${j.error}` : ''})`);

    const f = await verificarFirma(j.id_token, llavePara);
    const d = f.datos;
    if (d.iss !== emisor) throw new ErrorCuentas3G('emisor', 'La ficha no es de este Cuentas 3G');
    revisarAudiencia(d);
    revisarTiempos(d);
    if (typeof d.nonce !== 'string' || !iguales(bytesDe(d.nonce), bytesDe(String(x.temporal.nonce)))) throw new ErrorCuentas3G('nonce', 'La ficha no corresponde a esta entrada');
    if (typeof d.sub !== 'string' || !d.sub) throw new ErrorCuentas3G('formato', 'La ficha no dice quién es');
    if (typeof d.ver !== 'number') throw new ErrorCuentas3G('formato', 'La ficha no trae versión');
    recordarJti(d.jti);
    const nivel = typeof d.nivel === 'string' ? d.nivel : null;
    if (nivel === null && !o.sinNivel) throw new ErrorCuentas3G('sin_nivel', 'La ficha no trae nivel para este sistema');
    if (nivel !== null && Array.isArray(o.niveles) && !o.niveles.includes(nivel)) throw new ErrorCuentas3G('nivel_desconocido', 'Este sistema no conoce ese nivel');
    return {
      sub: d.sub,
      ver: d.ver,
      nivel,
      codigos: Array.isArray(d.codigos) ? d.codigos.filter((c) => typeof c === 'string') : [],
      roles: Array.isArray(d.roles) ? d.roles.filter((c) => typeof c === 'string') : [],
      nombre: typeof d.name === 'string' ? d.name : '',
      correo: typeof d.email === 'string' ? d.email : null,
      correoEnSistema: typeof d.correo_en_sistema === 'string' ? d.correo_en_sistema : null,
      authTime: typeof d.auth_time === 'number' ? d.auth_time : null,
      despues: destinoInterno(x.temporal.despues || '/'),
      en: ahora(),
    };
  }

  function usarLista(personas, iat, en, origen) {
    const m = new Map();
    for (const p of personas) if (p && typeof p.sub === 'string' && typeof p.ver === 'number') m.set(p.sub, { ver: p.ver, activo: p.activo === true });
    lista = { personas: m, iat, en, origen };
  }

  async function leerListaFirmada(jws, llaves, { exigirExp }) {
    const buscar = llaves ? async (kid) => llaves.find((k) => k.kid === kid) || null : llavePara;
    const f = await verificarFirma(jws, buscar);
    if (f.cab.typ !== 'estado-personas+jwt') throw new ErrorCuentas3G('formato', 'No es la lista de versiones');
    if (f.datos.iss !== emisor) throw new ErrorCuentas3G('emisor', 'La lista no es de este Cuentas 3G');
    revisarAudiencia(f.datos);
    revisarTiempos(f.datos, { exigirExp });
    if (!Array.isArray(f.datos.personas)) throw new ErrorCuentas3G('formato', 'Lista con formato inválido');
    return f.datos;
  }

  /**
   * 3. La lista firmada de versiones. Se pide a lo más una vez por `cadaMs` (o con `forzar`); si Cuentas
   * 3G no responde, se sigue con la última buena. Devuelve lo que hay (o null si nunca hubo).
   * Desde 1.1.2 la lista lleva la hora en que se PIDIÓ (no la de cuando llegó): una pedida antes de un aviso de
   * baja que llega después de él nunca cuenta como «pedida después del aviso». Y `forzar` quiere una lista pedida
   * DESDE AHORA: si hay una en camino (pedida antes), se pide otra en cuanto llegue (una sola para todos).
   */
  async function listaDeVersiones(op) {
    const forzar = op && op.forzar;
    if (!forzar && lista && lista.origen === 'cuentas' && ahora() - lista.en < cadaMs) return lista;
    if (pidiendo && !forzar) return pidiendo;
    if (pidiendo) {
      if (!otraLista) otraLista = pidiendo.then(() => { otraLista = null; return listaDeVersiones({ forzar: true }); });
      return otraLista;
    }
    pidiendo = (async () => {
      try {
        const en = ahora(); // 1.1.2: la hora en que se pidió
        const r = await conLimite(`${emisor}/v1/estado-personas`, { headers: { authorization: basic, accept: 'application/jwt' } });
        if (r.status !== 200) throw new ErrorCuentas3G('lista', `Cuentas 3G no dio la lista (${r.status})`);
        const jws = await r.text();
        const d = await leerListaFirmada(jws, null, { exigirExp: true });
        usarLista(d.personas, d.iat, en, 'cuentas');
        ultimoError = null;
        try {
          await almacen.guardar(JSON.stringify({ version: 1, jws, llaves: jwks ? jwks.keys : [], en }));
        } catch (e) {
          if (registro.warn) registro.warn({ error: String(e && e.message) }, 'cuentas3g: no se pudo guardar la lista');
        }
      } catch (e) {
        ultimoError = e instanceof ErrorCuentas3G ? e.codigo : 'sin_respuesta';
        if (registro.warn) registro.warn({ error: ultimoError }, 'cuentas3g: sigue con la última lista buena');
      } finally {
        pidiendo = null;
      }
      return lista;
    })();
    return pidiendo;
  }

  /** Carga la última lista guardada (con su firma revisada) y empieza a pedir la lista cada minuto. */
  async function arrancar(op) {
    try {
      const t = await almacen.leer();
      if (t) {
        const g = JSON.parse(t);
        if (g && typeof g.jws === 'string' && Array.isArray(g.llaves)) {
          const d = await leerListaFirmada(g.jws, g.llaves, { exigirExp: false });
          if (!lista || lista.en < g.en) usarLista(d.personas, d.iat, typeof g.en === 'number' ? g.en : 0, 'guardada');
        }
      }
    } catch (e) {
      if (registro.warn) registro.warn({ error: e instanceof ErrorCuentas3G ? e.codigo : 'guardada_ilegible' }, 'cuentas3g: la lista guardada no sirve');
    }
    await listaDeVersiones({ forzar: true });
    if (!(op && op.sinReloj)) {
      if (reloj) clearInterval(reloj);
      // 1.1.2: con `forzar` en cada tic (sin él, la lista de hace casi `cadaMs` se daba por fresca y se pedía cada 2 tics).
      reloj = setInterval(() => {
        listaDeVersiones({ forzar: true }).catch(() => {});
      }, cadaMs);
      if (reloj.unref) reloj.unref();
    }
    return detener;
  }

  function detener() {
    if (reloj) clearInterval(reloj);
    reloj = null;
  }

  /**
   * 4. ¿Sigue valiendo esta sesión? `s` = { sub, ver, en } (en = cuándo creó el sistema la sesión, ms).
   * Se corta si llegó un aviso de baja después de crearla, si la lista dice que no está activa o si su
   * versión subió. A quien se dio de alta después de la última lista no se le corta por no venir en ella.
   * Sin lista todavía (Cuentas 3G nunca respondió), la sesión sigue (y estado() lo dice).
   */
  function sesionVigente(s) {
    return motivoDeCorte(s) === null;
  }

  function motivoDeCorte(s) {
    if (!s || typeof s.sub !== 'string' || typeof s.ver !== 'number') return 'sesion_invalida';
    const en = typeof s.en === 'number' ? s.en : 0;
    const corte = cortes.get(s.sub);
    if (corte !== undefined && en <= corte) return 'aviso_de_baja';
    if (!lista) return null;
    const p = lista.personas.get(s.sub);
    if (!p) return lista.en < en ? null : 'no_esta_en_la_lista';
    if (!p.activo) return 'baja';
    if (p.ver > s.ver) return 'version';
    return null;
  }

  /**
   * 5. El aviso de baja (POST form `logout_token` a la dirección de aviso del sistema). Lo valida, corta
   * al instante las sesiones de ese `sub` creadas antes de ahora y vuelve a pedir la lista. El sistema,
   * después, revoca lo que es de esa persona (enlaces, accesos) y responde 200.
   */
  async function avisoDeBaja(logoutToken) {
    const f = await verificarFirma(String(logoutToken || ''), llavePara);
    const d = f.datos;
    if (f.cab.typ !== 'logout+jwt') throw new ErrorCuentas3G('formato', 'No es un aviso de baja');
    if (d.iss !== emisor) throw new ErrorCuentas3G('emisor', 'El aviso no es de este Cuentas 3G');
    revisarAudiencia(d);
    revisarTiempos(d);
    if (d.nonce !== undefined) throw new ErrorCuentas3G('formato', 'Un aviso de baja no lleva nonce');
    if (!d.events || typeof d.events !== 'object' || !(EVENTO_DE_BAJA in d.events)) throw new ErrorCuentas3G('formato', 'El aviso no trae el evento de baja');
    if (typeof d.sub !== 'string' || !d.sub) throw new ErrorCuentas3G('formato', 'El aviso no dice a quién');
    recordarJti(d.jti);
    const t = ahora();
    for (const [k, v] of cortes) if (t - v > 31 * DIA) cortes.delete(k);
    cortes.set(d.sub, t);
    listaDeVersiones({ forzar: true }).catch(() => {});
    return { sub: d.sub };
  }

  async function leerCatalogoFirmado(jws, llaves, { exigirExp }) {
    const buscar = llaves ? async (kid) => llaves.find((k) => k.kid === kid) || null : llavePara;
    const f = await verificarFirma(jws, buscar);
    if (f.cab.typ !== 'personas+jwt') throw new ErrorCuentas3G('formato', 'No es el catálogo de personas');
    if (f.datos.iss !== emisor) throw new ErrorCuentas3G('emisor', 'El catálogo no es de este Cuentas 3G');
    revisarAudiencia(f.datos);
    revisarTiempos(f.datos, { exigirExp });
    if (!Array.isArray(f.datos.personas)) throw new ErrorCuentas3G('formato', 'Catálogo con formato inválido');
    return f.datos;
  }

  /**
   * 6. El catálogo de personas y códigos (C5, CTA-09). Solo lo leen Finanzas, Operación y Planta (a los
   * demás Cuentas 3G les contesta 403), y cada uno recibe solo sus campos. Se pide a lo más cada
   * `personasCadaMs` (o con `forzar`) y la última copia buena se guarda (con su firma) en `almacenPersonas`.
   * Si Cuentas 3G no responde, sigue con la copia; sin copia devuelve null: el sistema usa su configuración
   * de hoy (teléfonos y comisionistas de siempre). Tras un intento fallido no vuelve a pedir antes de un
   * minuto (salvo `forzar`), para no esperar a Cuentas 3G en cada llamada (1.1.1).
   */
  async function personas(op) {
    const forzar = op && op.forzar;
    if (!forzar && catalogo && catalogo.origen === 'cuentas' && ahora() - catalogo.en < personasCadaMs) return catalogo;
    // Si el último intento falló hace menos de un minuto, no se vuelve a esperar a Cuentas 3G en cada llamada:
    // lo que haya (la copia o null, la configuración de hoy). Así, con Cuentas 3G caída, todo sigue igual de rápido.
    if (!forzar && catalogoFallo && ahora() - catalogoFallo < MINUTO) return catalogo;
    if (pidiendoCatalogo && !forzar) return pidiendoCatalogo;
    if (pidiendoCatalogo) {
      // 1.1.2: como la lista, `forzar` quiere un catálogo pedido desde ahora.
      if (!otroCatalogo) otroCatalogo = pidiendoCatalogo.then(() => { otroCatalogo = null; return personas({ forzar: true }); });
      return otroCatalogo;
    }
    pidiendoCatalogo = (async () => {
      try {
        const en = ahora(); // 1.1.2: la hora en que se pidió (como la lista)
        const r = await conLimite(`${emisor}/v1/personas`, { headers: { authorization: basic, accept: 'application/jwt' } });
        if (r.status !== 200) throw new ErrorCuentas3G('personas', `Cuentas 3G no dio el catálogo (${r.status})`);
        const jws = await r.text();
        const d = await leerCatalogoFirmado(jws, null, { exigirExp: true });
        catalogo = { personas: d.personas, en, origen: 'cuentas' };
        catalogoFallo = 0;
        ultimoErrorCatalogo = null;
        try {
          await almacenPersonas.guardar(JSON.stringify({ version: 1, jws, llaves: jwks ? jwks.keys : [], en }));
        } catch (e) {
          if (registro.warn) registro.warn({ error: String(e && e.message) }, 'cuentas3g: no se pudo guardar el catálogo');
        }
      } catch (e) {
        ultimoErrorCatalogo = e instanceof ErrorCuentas3G ? e.codigo : 'sin_respuesta';
        catalogoFallo = ahora();
        if (!catalogo) {
          try {
            const t = await almacenPersonas.leer();
            if (t) {
              const g = JSON.parse(t);
              const d = await leerCatalogoFirmado(g.jws, g.llaves, { exigirExp: false });
              catalogo = { personas: d.personas, en: typeof g.en === 'number' ? g.en : 0, origen: 'guardada' };
            }
          } catch (e2) {
            if (registro.warn) registro.warn({ error: e2 instanceof ErrorCuentas3G ? e2.codigo : 'guardada_ilegible' }, 'cuentas3g: la copia del catálogo no sirve');
          }
        }
        if (registro.warn) registro.warn({ error: ultimoErrorCatalogo }, catalogo ? 'cuentas3g: sigue con la copia del catálogo' : 'cuentas3g: sin catálogo, se usa la configuración de hoy');
      } finally {
        pidiendoCatalogo = null;
      }
      return catalogo;
    })();
    return pidiendoCatalogo;
  }

  /** Para /salud del sistema: nunca datos de personas. */
  function estado() {
    const t = ahora();
    return {
      version: VERSION,
      lista: lista ? { origen: lista.origen, en: new Date(lista.en).toISOString(), personas: lista.personas.size } : null,
      listaVieja: !lista || t - lista.en > DIA,
      ultimoError,
      avisos: cortes.size,
      catalogo: catalogo ? { origen: catalogo.origen, en: new Date(catalogo.en).toISOString(), personas: catalogo.personas.length } : null,
      ultimoErrorCatalogo,
    };
  }

  return { iniciar, regreso, listaDeVersiones, sesionVigente, motivoDeCorte, avisoDeBaja, personas, arrancar, detener, estado };
}

module.exports = {
  VERSION,
  MODOS,
  ErrorCuentas3G,
  leerConfig,
  crearCliente,
  almacenEnDisco,
  almacenEnMemoria,
  sellar,
  abrir,
  destinoInterno,
};
