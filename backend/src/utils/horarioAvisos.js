/**
 * Regla de noche y domingo de los avisos de Planta a WhatsApp (D7 · PLA-18; decisión D-11).
 *
 * Planta no manda nada: deja el aviso en su cola (avisos_whatsapp) y Julia lo recoge en /api/avisos-whatsapp/pendientes
 * cada minuto. Con HORARIO_AVISOS encendida, /pendientes solo entrega fuera de horario los avisos marcados `urgente`;
 * los demás esperan en la cola y salen al abrir el horario, en el mismo orden. Julia no cambia.
 *
 * Variables (se leen en cada consulta; cambian al reiniciar con la variable nueva):
 *   - HORARIO_AVISOS: vacía o 0 = apagada (hoy: salen a cualquier hora). `1` (también true, sí, on) = lunes a sábado de
 *     8:00 a 21:00 (D-11). También acepta una ventana propia «díaInicio-díaFin,horaInicio-horaFin» con días de lunes = 1 a
 *     domingo = 7, p. ej. `1-6,8-21` (lo mismo que `1`) o `1-5,8:30-20`. Un valor que no se entiende usa la de D-11.
 *   - AVISOS_URGENTES: vacía por omisión (ningún aviso es urgente hasta que el dueño lo marque). Lista separada por comas
 *     de tipos (`adelanto_instalacion`), destinos (`produccion`) o «destino:tipo» (`compras:aprobacion_orden`). Se
 *     marca al encolar, en la columna `urgente`.
 */

const ZONA = 'America/Mexico_City';
const SI = new Set(['1', 'true', 'si', 'sí', 'on']);
const NO = new Set(['', '0', 'no', 'false', 'off', 'apagado', 'apagada']);
const NOMBRES_DIA = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const VENTANA_POR_OMISION = Object.freeze({ diaDesde: 1, diaHasta: 6, desde: 8 * 60, hasta: 21 * 60 });

let avisoInvalida = '';
const hhmm = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;

/** La ventana de HORARIO_AVISOS o null si está apagada. */
export const ventanaAvisos = () => {
    const v = String(process.env.HORARIO_AVISOS ?? '').trim().toLowerCase();
    if (NO.has(v)) return null;
    if (SI.has(v)) return { ...VENTANA_POR_OMISION };
    const m = /^([1-7])\s*-\s*([1-7])\s*,\s*(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?$/.exec(v);
    if (m) {
        const diaDesde = Number(m[1]); const diaHasta = Number(m[2]);
        const desde = Number(m[3]) * 60 + Number(m[4] || 0); const hasta = Number(m[5]) * 60 + Number(m[6] || 0);
        if (diaDesde <= diaHasta && desde < hasta && hasta <= 24 * 60) return { diaDesde, diaHasta, desde, hasta };
    }
    if (avisoInvalida !== v) {
        avisoInvalida = v;
        console.warn('[horario-avisos] HORARIO_AVISOS no se entiende: se usa lunes a sábado de 8:00 a 21:00');
    }
    return { ...VENTANA_POR_OMISION };
};

export const textoVentana = (w = ventanaAvisos()) => (w
    ? `${NOMBRES_DIA[w.diaDesde]} a ${NOMBRES_DIA[w.diaHasta]} de ${hhmm(w.desde)} a ${hhmm(w.hasta)}`
    : 'a cualquier hora');

/** Día de la semana (lunes = 1 … domingo = 7) y minuto del día en la hora de México. */
export const partesMexico = (fecha = new Date()) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: ZONA, hourCycle: 'h23', weekday: 'short', hour: '2-digit', minute: '2-digit'
    }).formatToParts(fecha).map((x) => [x.type, x.value]));
    const dia = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday];
    return { dia, minutos: Number(p.hour) * 60 + Number(p.minute) };
};

/** ¿Dentro del horario? Sin ventana (bandera apagada) siempre sí. */
export const dentroDeHorario = (fecha = new Date(), w = ventanaAvisos()) => {
    if (!w) return true;
    const { dia, minutos } = partesMexico(fecha);
    return dia >= w.diaDesde && dia <= w.diaHasta && minutos >= w.desde && minutos < w.hasta;
};

/** Cuándo vuelve a abrir el horario (minuto exacto), o la misma fecha si ya está dentro. */
export const proximaApertura = (fecha = new Date(), w = ventanaAvisos()) => {
    if (dentroDeHorario(fecha, w)) return new Date(fecha);
    // Recorre de minuto en minuto hasta 8 días (a lo más ~11 520 pasos; solo se usa para mostrar y en pruebas).
    let t = Math.ceil(fecha.getTime() / 60000) * 60000;
    for (let i = 0; i < 8 * 24 * 60; i++, t += 60000) if (dentroDeHorario(new Date(t), w)) return new Date(t);
    return null;
};

/** Lista de AVISOS_URGENTES, en minúsculas. */
export const avisosUrgentes = () => String(process.env.AVISOS_URGENTES ?? '')
    .split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

/** ¿Este aviso pasa de noche? Por tipo, por destino o por «destino:tipo». */
export const esUrgente = ({ tipo, destino } = {}) => {
    const lista = avisosUrgentes();
    if (!lista.length) return false;
    const t = String(tipo || 'informativo').toLowerCase(); const d = String(destino || '').toLowerCase();
    return lista.includes(t) || lista.includes(d) || lista.includes(`${d}:${t}`);
};
