// Sofía (7-nov-2026) · su VENTANA FLOTANTE en Planta. Sofía es la asistente general de Dirección (un servicio aparte);
// su ventana es un guion de su propio sitio (flotante.js) que dibuja el botón con su personaje y abre su chat en un iframe
// de SU origen: la sesión y los permisos son de Sofía. Planta no le pasa datos, llaves ni la sesión de nadie.
//
// VITE_SOFIA_FLOTANTE_URL (pública, se fija al construir; va en las variables de Vercel): la dirección de Sofía, https://…
// sin «/flotante.js». VACÍA (por omisión) = Planta queda idéntica a hoy: ni etiqueta, ni petición nueva, ni nada guardado.
// Este repositorio es PÚBLICO: el valor nunca se escribe aquí (ni en .env.example, ni en pruebas).
//
// Con la variable puesta, el guion de Sofía se pide SOLO en los aparatos de Isa y solo en las pantallas internas (con
// sesión, dentro del armazón): nunca en TV, terminal, anuncios, calendario público, Entrar ni el regreso de Cuentas 3G.
//   - El aparato se marca una vez abriendo cualquier página con #sofia o ?sofia=1 (queda «sofia3g.visible=1» en el
//     localStorage de Planta, la misma marca que usa flotante.js). #sofia-no o ?sofia=0 la quitan.
//   - Sin la marca, Planta no le pide nada al sitio de Sofía (los demás aparatos ni se enteran de que existe).
// Política de seguridad (CSP): hoy Planta no manda ninguna (ni vercel.json ni una <meta>). Si algún día se agrega, debe
// llevar el origen de Sofía en script-src y en frame-src.
//
// Aquí solo hay funciones puras (se prueban en Node, test/sofiaFlotante.test.mjs); quien lee la variable y monta es
// SofiaFlotante.jsx.

export const CLAVE_VISIBLE = 'sofia3g.visible';
export const ID_GUION = 'sofia3g-guion';
// Además de las rutas que flotante.js ya nunca usa (/tv, /terminal, /anuncios, …-tv), las públicas propias de Planta y
// las de entrar. Se le pasan como data-excluir: si Isa sale de la sesión, la ventana se esconde sola.
export const EXCLUIR_PLANTA = ['/login', '/entrar', '/calendario-publico', '/anuncios', '/terminal'];

const LOCALES = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * Lee la dirección de Sofía. null = sin Sofía (vacía o mal escrita: Planta sale como hoy).
 * Solo https (http únicamente en 127.0.0.1/localhost, para pruebas); sin usuario, consulta ni «#». Si alguien pega la
 * dirección completa del guion (…/flotante.js), se acepta igual.
 */
export function origenSofia(valor) {
  const t = String(valor ?? '').trim();
  if (!t) return null;
  let u;
  try { u = new URL(t); } catch { return null; }
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && LOCALES.has(u.hostname))) return null;
  if (u.username || u.password || u.search || u.hash) return null;
  const base = (u.origin + u.pathname.replace(/\/flotante\.js$/i, '')).replace(/\/+$/, '');
  return { origen: u.origin, base, guion: `${base}/flotante.js` };
}

/** ¿La dirección pide marcar (true), desmarcar (false) o nada (null)? Mismas reglas que flotante.js. */
export function marcaDeLaDireccion(loc) {
  const hash = String(loc?.hash || '');
  let q = null;
  try { q = new URLSearchParams(String(loc?.search || '')).get('sofia'); } catch { /* sin consulta */ }
  if (hash === '#sofia' || q === '1') return true;
  if (hash === '#sofia-no' || q === '0') return false;
  return null;
}

/**
 * Aplica la marca de la dirección al aparato y dice si el aparato es de Isa. Sin almacenamiento (ventana privada,
 * datos bloqueados), solo cuenta lo que diga la dirección de esta carga.
 */
export function aparatoDeIsa(loc, almacen) {
  const pide = marcaDeLaDireccion(loc);
  try {
    if (pide === true) almacen.setItem(CLAVE_VISIBLE, '1');
    if (pide === false) almacen.removeItem(CLAVE_VISIBLE);
  } catch { /* sin almacenamiento */ }
  if (pide !== null) return pide;
  try { return almacen.getItem(CLAVE_VISIBLE) === '1'; } catch { return false; }
}

/** ¿Esta ruta es pública, de piso o de entrar? (ahí nunca se pide el guion) */
export function rutaSinSofia(pathname) {
  const p = String(pathname || '/').replace(/\/+$/, '') || '/';
  if (/(^|\/)[a-z0-9-]*-tv(\/|$)/i.test(p)) return true;
  return EXCLUIR_PLANTA.some((r) => p === r || p.startsWith(`${r}/`));
}

/** Pone UNA vez <script src="…/flotante.js" data-sistema="…" data-excluir="…" async>. Devuelve si lo puso. */
export function ponerSofia(doc, s, sistema = 'planta') {
  if (!s || !s.guion || !doc || doc.getElementById(ID_GUION)) return false;
  const el = doc.createElement('script');
  el.id = ID_GUION;
  el.src = s.guion;
  el.async = true;
  el.setAttribute('data-sistema', sistema);
  el.setAttribute('data-excluir', EXCLUIR_PLANTA.join(','));
  (doc.body || doc.head || doc.documentElement).appendChild(el);
  return true;
}
