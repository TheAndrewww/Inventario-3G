// Entrar a Planta con tu cuenta 3G (E1 · PLA-24). La pantalla arma la ida a Cuentas 3G (PKCE S256, state y nonce en
// sessionStorage) y, al regresar a /entrar/regreso, manda { code, code_verifier, nonce } al servidor de Planta, que
// canjea, valida y contesta igual que /auth/login: { usuario, token }.
//
// VITE_CUENTAS3G_MODO (pública, al construir): «apagado» o sin poner = la pantalla de siempre, sin ninguna petición nueva;
// «ambos» = botón «Entrar con tu cuenta 3G» más el acceso de siempre; «solo» = solo el botón (el acceso de siempre vuelve
// a salir únicamente si el servidor tiene puesta la llave de emergencia). Sin VITE_CUENTAS3G_EMISOR o
// VITE_CUENTAS3G_CLIENTE_ID se queda en «apagado». Las tres son públicas: ningún secreto vive en la pantalla.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const IDA = 'cuentas3g-ida';
const DIEZ_MIN = 10 * 60 * 1000;

const emisor = () => String(import.meta.env.VITE_CUENTAS3G_EMISOR || '').trim().replace(/\/+$/, '');
const clienteId = () => String(import.meta.env.VITE_CUENTAS3G_CLIENTE_ID || '').trim();

export const modoCuentas3g = () => {
  const m = String(import.meta.env.VITE_CUENTAS3G_MODO || '').trim().toLowerCase();
  if (m !== 'ambos' && m !== 'solo') return 'apagado';
  return emisor() && clienteId() ? m : 'apagado';
};

export const emisorCuentas3g = () => emisor();

// Solo rutas internas: empiezan con «/» y no con «//» (DISEÑO §2.6).
const destinoSeguro = (d) => (typeof d === 'string' && d.startsWith('/') && !d.startsWith('//') && !d.startsWith('/\\') ? d : null);

// Con el servidor en «apagado», o con un servidor anterior a PLA-23, las rutas /auth/cuentas3g… no existen, y la petición
// sin sesión cae en las rutas de Planta que piden sesión: responde 401 «No se proporcionó token…» (no 404). Las rutas
// encendidas nunca dan 401 sin un código CUENTAS3G_… (verificación independiente de la ronda 3).
const rutaNoEncendida = (r, cuerpo) => r.status === 404 || (r.status === 401 && !String(cuerpo?.codigo || '').startsWith('CUENTAS3G_'));

const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const aleatorio = (n) => b64u(crypto.getRandomValues(new Uint8Array(n)));

/** «Entrar con tu cuenta 3G»: guarda la ida y manda a Cuentas 3G. */
export async function irACuentas3g(destino) {
  const state = aleatorio(16);
  const nonce = aleatorio(16);
  const verificador = aleatorio(32);
  const reto = b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador)));
  try {
    sessionStorage.setItem(IDA, JSON.stringify({ state, nonce, verificador, destino: destinoSeguro(destino), en: Date.now() }));
  } catch {
    throw new Error('Este navegador no deja guardar la entrada (modo privado sin almacenamiento). Prueba en una ventana normal.');
  }
  const q = new URLSearchParams({
    client_id: clienteId(),
    redirect_uri: `${window.location.origin}/entrar/regreso`,
    response_type: 'code',
    scope: 'openid',
    state,
    nonce,
    code_challenge: reto,
    code_challenge_method: 'S256',
  });
  window.location.assign(`${emisor()}/autorizar?${q}`);
}

/** Al regresar: compara el state, canjea en el servidor de Planta y devuelve { token, usuario, destino }. */
export async function regresoDeCuentas3g(busqueda) {
  const q = new URLSearchParams(busqueda);
  let ida = null;
  try {
    ida = JSON.parse(sessionStorage.getItem(IDA) || 'null');
    sessionStorage.removeItem(IDA);
  } catch { /* sin almacenamiento */ }
  if (q.get('error')) {
    throw new Error(q.get('error') === 'access_denied'
      ? 'No terminaste de entrar con tu cuenta 3G. Vuelve a intentarlo.'
      : 'Cuentas 3G no te dejó entrar a Planta. Vuelve a intentarlo o pide acceso a Dirección.');
  }
  if (!ida || !q.get('code') || q.get('state') !== ida.state || Date.now() - (ida.en || 0) > DIEZ_MIN) {
    throw new Error('La entrada con tu cuenta 3G venció o no empezó en este navegador. Vuelve a intentarlo.');
  }
  let r;
  try {
    r = await fetch(`${API_URL}/auth/cuentas3g`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' },
      body: JSON.stringify({ code: q.get('code'), code_verifier: ida.verificador, nonce: ida.nonce }),
    });
  } catch {
    throw new Error('No hay conexión con Planta. Revisa tu internet y vuelve a intentarlo.');
  }
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok || !cuerpo?.data?.token) {
    if (rutaNoEncendida(r, cuerpo)) throw new Error('La entrada con cuenta 3G todavía no está encendida en Planta. Usa el acceso de siempre.');
    if (r.status === 429) throw new Error(cuerpo?.message || 'Demasiados intentos. Espera unos minutos.');
    throw new Error(cuerpo?.message || 'No se pudo entrar con tu cuenta 3G. Vuelve a intentarlo.');
  }
  return { token: cuerpo.data.token, usuario: cuerpo.data.usuario, destino: ida.destino };
}

/** { modo, emergencia } del servidor; 'apagado' si la ruta no existe (404 o 401, ver rutaNoEncendida); null si no hay conexión. */
export async function estadoServidorCuentas3g() {
  try {
    const r = await fetch(`${API_URL}/auth/cuentas3g/estado`, { headers: { Accept: 'application/json' } });
    if (rutaNoEncendida(r, null)) return { modo: 'apagado', emergencia: false };
    if (!r.ok) return null;
    const cuerpo = await r.json();
    return cuerpo?.data || null;
  } catch {
    return null;
  }
}
