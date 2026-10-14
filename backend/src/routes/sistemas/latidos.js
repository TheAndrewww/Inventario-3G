/**
 * D1 · PLA-15 — Latidos de la línea del contable.
 *
 * 1) Julia (Finanzas, FIN-08) agrega a su consulta de cada minuto a GET /api/avisos-whatsapp/pendientes estas cabeceras
 *    (todas ASCII, fechas ISO con zona de México):
 *      X-3G-Latido: 1                       formato
 *      X-3G-Latido-Sistema: finanzas
 *      X-3G-Latido-Whatsapp                 WORKING | STARTING | SCAN_QR_CODE | FAILED | STOPPED | UNKNOWN
 *      X-3G-Latido-Whatsapp-Desde           desde cuándo está en ese estado
 *      X-3G-Latido-Ultimo-Envio             último mensaje que salió por la línea (puede no venir)
 *      X-3G-Latido-Version                  versión de su app
 *      X-3G-Latido-Piezas                   JSON [{ id, estado: ok|aviso|mal|sin_dato, ultimo }] (checador, impresora)
 *    `anotarLatido()` las lee y guarda el último latido de cada sistema (memoria + tabla latidos_sistemas). Nunca cambia
 *    la respuesta a Julia ni la retrasa: si algo falla, el latido se pierde y la cola sigue igual. Sin la cabecera
 *    X-3G-Latido (Julia de antes de FIN-08) no se guarda nada.
 *
 * 2) GET /api/sistemas/v1/latidos — llave NUEVA de Ventas (origen «ventas», alcance «latidos.leer»; hoy Ventas lee Planta
 *    sin llave, así que no hay llave que reusar). Contrato §4.4:
 *      [{ sistema, visto, whatsapp, ultimoEnvio, piezas, whatsappDesde, version }]
 *    `visto` es la hora de Planta al recibirlo (no la del reloj de Julia). «finanzas» siempre aparece: con `visto: null`
 *    si nunca ha llegado su latido. Ventas (VEN-11) decide los avisos: 5 min sin latido, WhatsApp distinto de WORKING…
 */
import LatidoSistema from '../../models/LatidoSistema.js';
import { isoMexico } from '../../utils/revisarConfig.js';

const ESTADOS_PIEZA = ['ok', 'aviso', 'mal', 'sin_dato'];
const FUTURO_MS = 5 * 60 * 1000; // relojes un poco adelantados
const enMemoria = new Map();
let errorAlGuardar = false;

const fecha = (v, ahora) => {
    if (typeof v !== 'string' || !v.trim() || v.length > 40) return null;
    const d = new Date(v.trim());
    if (Number.isNaN(d.getTime()) || d.getTime() > ahora.getTime() + FUTURO_MS) return null;
    return d;
};

/** Lee las cabeceras del latido (nombres en minúsculas, como los deja Node). null si no hay latido. */
export const leerCabecerasLatido = (headers = {}, ahora = new Date()) => {
    const h = (n) => { const v = headers[n]; return Array.isArray(v) ? v[0] : v; };
    if (h('x-3g-latido') === undefined) return null;
    const sistema = String(h('x-3g-latido-sistema') || 'finanzas').trim().toLowerCase();
    if (!/^[a-z][a-z0-9-]{1,29}$/.test(sistema)) return null;
    const whatsapp = String(h('x-3g-latido-whatsapp') || '').trim().toUpperCase();
    const version = String(h('x-3g-latido-version') || '').trim();
    let piezas = [];
    try {
        const p = JSON.parse(String(h('x-3g-latido-piezas') || '[]').slice(0, 4000));
        if (Array.isArray(p)) {
            piezas = p.filter((x) => x && typeof x.id === 'string' && /^[a-z][a-z0-9_-]{0,30}$/.test(x.id)).slice(0, 10)
                .map((x) => ({ id: x.id, estado: ESTADOS_PIEZA.includes(x.estado) ? x.estado : 'sin_dato', ultimo: fecha(x.ultimo, ahora) }));
        }
    } catch { /* piezas ilegibles: el latido vale igual, sin piezas */ }
    return {
        sistema,
        visto: ahora,
        whatsapp: /^[A-Z_]{1,30}$/.test(whatsapp) ? whatsapp : 'UNKNOWN',
        whatsappDesde: fecha(h('x-3g-latido-whatsapp-desde'), ahora),
        ultimoEnvio: fecha(h('x-3g-latido-ultimo-envio'), ahora),
        version: /^[\w.+-]{1,40}$/.test(version) ? version : null,
        piezas
    };
};

/** Lo llama la cola de Julia. Nunca lanza ni espera: lo que pase aquí no toca la respuesta. */
export const anotarLatido = (headers, ahora = new Date()) => {
    let l = null;
    try { l = leerCabecerasLatido(headers, ahora); } catch { return null; }
    if (!l) return null;
    enMemoria.set(l.sistema, l);
    try {
        LatidoSistema.upsert({
            sistema: l.sistema,
            visto: l.visto,
            whatsapp: l.whatsapp,
            whatsapp_desde: l.whatsappDesde,
            ultimo_envio: l.ultimoEnvio,
            version: l.version,
            piezas: l.piezas.map((p) => ({ ...p, ultimo: p.ultimo ? p.ultimo.toISOString() : null }))
        }).then(() => { errorAlGuardar = false; }).catch((e) => {
            // Una sola línea por racha de errores (la consulta es cada minuto)
            if (!errorAlGuardar) console.error('[latido] no se pudo guardar el latido (queda en memoria):', e.message);
            errorAlGuardar = true;
        });
    } catch { /* sin tabla: queda en memoria */ }
    return l;
};

const iso = (v) => (v ? isoMexico(v instanceof Date ? v : new Date(v)) : null);
const formato = (l) => ({
    sistema: l.sistema,
    visto: iso(l.visto),
    whatsapp: l.whatsapp || null,
    ultimoEnvio: iso(l.ultimoEnvio),
    piezas: (l.piezas || []).map((p) => ({ id: p.id, estado: p.estado, ultimo: iso(p.ultimo) })),
    whatsappDesde: iso(l.whatsappDesde),
    version: l.version || null
});

/** GET /api/sistemas/v1/latidos */
export const leerLatidos = async () => {
    const porSistema = new Map();
    try {
        const filas = await LatidoSistema.findAll({ limit: 50 });
        for (const f of filas) {
            porSistema.set(f.sistema, {
                sistema: f.sistema, visto: f.visto, whatsapp: f.whatsapp, whatsappDesde: f.whatsapp_desde,
                ultimoEnvio: f.ultimo_envio, version: f.version, piezas: Array.isArray(f.piezas) ? f.piezas : []
            });
        }
    } catch { /* sin tabla: solo lo de memoria */ }
    // Lo de memoria es lo más nuevo (la tabla se escribe sin esperar)
    for (const [s, l] of enMemoria) {
        const g = porSistema.get(s);
        if (!g || new Date(g.visto).getTime() <= l.visto.getTime()) porSistema.set(s, l);
    }
    const lista = [...porSistema.values()].map(formato);
    if (!porSistema.has('finanzas')) {
        lista.push({ sistema: 'finanzas', visto: null, whatsapp: null, ultimoEnvio: null, piezas: [], whatsappDesde: null, version: null });
    }
    return lista.sort((a, b) => a.sistema.localeCompare(b.sistema)).slice(0, 50);
};

/** Solo para pruebas. */
export const _olvidarLatidos = () => enMemoria.clear();
