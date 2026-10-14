/**
 * C9 · PLA-07 — Calendario laboral común (lo de Planta).
 *
 * Festivos oficiales: copia del cálculo `festivosOficiales` de Operación (src/services/diasHabiles.ts), con los
 * mismos casos de prueba. Ley Federal del Trabajo, art. 74: los movibles se calculan (primer lunes de febrero,
 * tercer lunes de marzo y de noviembre) y el 1 de diciembre solo cada seis años (cambio de gobierno).
 * Si Operación cambia su cálculo, se cambia también aquí y en frontend/src/utils/produccion.js.
 *
 * Festivos del negocio (Semana Santa, 12 de diciembre, puentes…): los captura Operación (Configuración › Días
 * festivos) y Planta los lee por la puerta del contrato (OPE-08):
 *   GET {OPERACION_URL}/api/sistemas/v1/calendario-laboral?anio=AAAA
 *   Authorization: Bearer {LLAVE_HACIA_OPERACION} · X-3G-Origen: planta   (alcance calendario.leer)
 *   → { anio, festivosOficiales, festivosNegocio, reglas, version }
 * Se guardan 24 horas. Sin esas dos variables, o si Operación no responde y lo guardado ya venció, quedan solo
 * los oficiales (nunca se detiene nada por esto ni se llama a la red sin configuración).
 */

const iso = (y, m, dia) => `${y}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
const diaSemana = (y, m, dia) => new Date(Date.UTC(y, m - 1, dia, 12)).getUTCDay();

/** El n-ésimo lunes de un mes (1 = primer lunes). */
function lunesNumero(y, m, n) {
    let dia = 1;
    while (diaSemana(y, m, dia) !== 1) dia++;
    return dia + (n - 1) * 7;
}

const oficialesPorAnio = new Map();
/** Los festivos oficiales de México de un año, como "YYYY-MM-DD" (copia de Operación). */
export function festivosOficiales(y) {
    if (oficialesPorAnio.has(y)) return oficialesPorAnio.get(y);
    const dias = [
        iso(y, 1, 1),                        // Año Nuevo
        iso(y, 2, lunesNumero(y, 2, 1)),     // Día de la Constitución
        iso(y, 3, lunesNumero(y, 3, 3)),     // Natalicio de Benito Juárez
        iso(y, 5, 1),                        // Día del Trabajo
        iso(y, 9, 16),                       // Independencia
        iso(y, 11, lunesNumero(y, 11, 3)),   // Revolución
        iso(y, 12, 25),                      // Navidad
    ];
    if ((y - 2024) % 6 === 0 && y >= 2024) dias.push(iso(y, 12, 1)); // transmisión del Poder Ejecutivo
    const lista = dias.sort();
    oficialesPorAnio.set(y, lista);
    return lista;
}

// ---------- Festivos del negocio desde Operación (OPE-08), guardados 24 h ----------
const VIGENCIA_MS = 24 * 60 * 60 * 1000;
const REINTENTO_MS = 15 * 60 * 1000;
const FORMATO = /^(\d{4}-)?\d{2}-\d{2}$/; // "YYYY-MM-DD" (un día) o "MM-DD" (todos los años), como en Operación

const estado = { lista: [], conjunto: new Set(), leidoEn: 0, intentoEn: 0, leyendo: null, ultimoError: null };

const conexion = () => {
    const url = String(process.env.OPERACION_URL || '').trim().replace(/\/+$/, '');
    const llave = String(process.env.LLAVE_HACIA_OPERACION || '').trim();
    return url && llave ? { url, llave } : null;
};

async function leerDeOperacion() {
    const c = conexion();
    if (!c) return;
    estado.intentoEn = Date.now();
    try {
        const anio = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric' }).format(new Date()));
        const juntos = new Set();
        for (const a of [anio, anio + 1]) { // los plazos de diciembre ya cruzan al año siguiente
            const r = await fetch(`${c.url}/api/sistemas/v1/calendario-laboral?anio=${a}`, {
                headers: { Authorization: `Bearer ${c.llave}`, 'X-3G-Origen': 'planta', Accept: 'application/json' },
                signal: AbortSignal.timeout(3000)
            });
            if (!r.ok) throw new Error(`Operación respondió ${r.status}`);
            const j = await r.json();
            const lista = Array.isArray(j?.festivosNegocio) ? j.festivosNegocio : [];
            for (const f of lista) if (FORMATO.test(String(f).trim())) juntos.add(String(f).trim());
            if (Array.isArray(j?.festivosOficiales) && JSON.stringify([...j.festivosOficiales].sort()) !== JSON.stringify(festivosOficiales(a))) {
                console.warn(`[calendario-laboral] los festivos oficiales ${a} de Operación no coinciden con los de Planta: revisar las dos copias del cálculo`);
            }
        }
        estado.lista = [...juntos].sort();
        estado.conjunto = juntos;
        estado.leidoEn = Date.now();
        estado.ultimoError = null;
        console.log(`[calendario-laboral] festivos del negocio leídos de Operación: ${estado.lista.length}`);
    } catch (error) {
        estado.ultimoError = error.message;
        console.warn(`[calendario-laboral] no se pudieron leer los festivos del negocio de Operación (${error.message}); se usan los oficiales${Date.now() - estado.leidoEn < VIGENCIA_MS ? ' y los últimos leídos' : ''}`);
    }
}

/** Pide a Operación los festivos del negocio si lo guardado venció (sin esperar la respuesta). */
function refrescarSiHaceFalta() {
    if (!conexion() || estado.leyendo) return;
    const vencido = Date.now() - estado.leidoEn >= VIGENCIA_MS;
    const puedeReintentar = Date.now() - estado.intentoEn >= REINTENTO_MS;
    if (vencido && puedeReintentar) {
        estado.leyendo = leerDeOperacion().finally(() => { estado.leyendo = null; });
    }
}

/** Festivos del negocio vigentes ("YYYY-MM-DD" o "MM-DD"); vacío si no hay o si lo guardado tiene más de 24 h. */
export function festivosNegocio() {
    refrescarSiHaceFalta();
    return Date.now() - estado.leidoEn < VIGENCIA_MS ? estado.lista : [];
}

/** ¿Este día calendario es festivo (oficial o del negocio)? Mes 1-12. */
export function esFestivo(y, m, dia) {
    const fecha = iso(y, m, dia);
    if (festivosOficiales(y).includes(fecha)) return true;
    refrescarSiHaceFalta();
    if (!estado.conjunto.size || Date.now() - estado.leidoEn >= VIGENCIA_MS) return false;
    return estado.conjunto.has(fecha) || estado.conjunto.has(fecha.slice(5));
}

/** Lo mismo para un Date a medianoche UTC (como los usa calcularDiasHabiles). */
export const esFestivoUTC = (d) => esFestivo(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());

/** Para /salud (PLA-08 y PLA-13): de dónde salen los festivos, sin datos. */
export const estadoCalendarioLaboral = () => ({
    operacionConfigurada: !!conexion(),
    festivosNegocio: Date.now() - estado.leidoEn < VIGENCIA_MS ? estado.lista.length : 0,
    leidoEn: estado.leidoEn ? new Date(estado.leidoEn).toISOString() : null,
    ultimoError: estado.ultimoError
});

/** Solo para pruebas: pone los festivos del negocio como si se hubieran leído de Operación. */
export function _ponerFestivosNegocioParaPrueba(lista, leidoEn = Date.now()) {
    const juntos = new Set((lista || []).map(String).filter((f) => FORMATO.test(f)));
    estado.lista = [...juntos].sort();
    estado.conjunto = juntos;
    estado.leidoEn = leidoEn;
}
