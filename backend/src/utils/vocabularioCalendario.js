/**
 * Un solo vocabulario para el calendario de instalaciones (revisión del 5-nov-2026, punto 9).
 *
 * Antes cada pantalla entendía la celda con sus propias palabras: la agenda y el tablero pedían la palabra exacta
 * «RETIRO», las citas del día buscaban «retiro» en cualquier parte, Operación acepta cualquier palabra que empiece con
 * «RETIR», y nadie decía si la obra era EXTENSIVO. Aquí vive la lectura única de una celda: el contrato «tipo de cita v1»
 * (CONTRATOS-puertas.md, A1), la MISMA regla que Operación (tipoReal + tipoDeCita) y Julia (separarCitasDeCarla, con
 * `tipo_cita`). Da RETIRO, EXTENSIVO, CIMENTACION, GTIA, MTO o INSTALACION (ver clasificarCita).
 *
 * Bandera CALENDARIO_VOCABULARIO_UNICO (APAGADA por omisión):
 *   apagada  Planta decide fechas y tipos como hasta hoy (reglaAnterior*). El tipo único se calcula igual y viaja en
 *            campos nuevos (tipo_cita en la agenda y en las citas del día, tipoCita en la puerta de producción), y la
 *            lista de celdas que Planta no entiende se arma, pero no cambia ninguna fecha.
 *   `1`      La agenda, el tablero y la puerta de producción usan este vocabulario para decidir: «RETIRAR LONA» ya es
 *            retiro, «MANTTO» ya es MTO, y una obra con CIMENTACIÓN el día de su fecha del Índice (o después) queda sin
 *            fecha en las tres pantallas, no solo en la agenda. El campo viejo `tipo` de las citas del día nunca toma
 *            valores nuevos (tipoAnteriorDeCita).
 *
 * Puro: no lee la base ni Sheets. Se prueba en tests/vocabulario-calendario.test.js.
 */

const SI = new Set(['1', 'true', 'si', 'sí', 'on']);
export const vocabularioUnico = () => SI.has(String(process.env.CALENDARIO_VOCABULARIO_UNICO ?? '').trim().toLowerCase());

// En el orden del contrato «tipo de cita v1»: si una obra tiene dos celdas el mismo día, gana la primera de esta lista.
export const TIPOS_CITA = ['RETIRO', 'EXTENSIVO', 'CIMENTACION', 'GTIA', 'MTO', 'INSTALACION'];

const sinAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Texto de la celda en mayúsculas, sin acentos y con las diagonales como espacios: «ROSA INVENTADA MTO RETIRO». */
export const textoDeCita = (cita) => sinAcentos(`${cita?.nombre || ''} ${cita?.cliente || ''}`)
    .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

// Las palabras del vocabulario (una celda puede traer cualquiera, en cualquiera de sus partes).
const RE_RETIRO = /\bRETIR/;                                   // RETIRO, RETIRAR, RETIROS, RETIRADA (regla de Operación)
const RE_CIMENTACION = /\bCIMENTACI/;                          // CIMENTACIÓN, CIMENTACIONES
const RE_EXTENSIVO = /\bEXTENSIV/;                             // EXTENSIVO, EXTENSIVA
const RE_REINSTALACION = /\bRE ?INST/;                         // REINSTALACIÓN, REINST, RE INSTALACION
const RE_MTO = /\b(MTO|MTTO|MANTTO|MANT)\b|\bMANTENIM/;        // MTO y sus abreviaturas de siempre
const RE_GTIA = /\b(GTIA|GTIAS)\b|\bGARANT/;

/**
 * Lo que dice una celda: contrato «tipo de cita v1» (CONTRATOS-puertas.md, A1), igual en Planta, Operación y Julia.
 * El texto es la celda completa («NOMBRE / resto») sin acentos, en mayúsculas y con todo lo que no es A-Z o 0-9 como
 * espacio. `esExtensivo` = el producto de la obra es EXTENSIVO en el Índice (columna J). El color es el fondo de la celda
 * (tipoProyecto: MANTENIMIENTO, GARANTIA o NORMAL). La primera regla que aplica decide:
 *   1) RETIR…                                   → RETIRO
 *   2) EXTENSIV… en el texto                    → EXTENSIVO
 *   3) producto EXTENSIVO y no es garantía      → EXTENSIVO  («es garantía» = color GARANTIA, o sin color de MTO ni de
 *                                                  GTIA y el texto dice GTIA/GARANT. L14 sin decidir: si el dueño dice
 *                                                  otra cosa, se quita «y no es garantía» en los tres el mismo día)
 *   4) CIMENTACI…                               → CIMENTACION
 *   5) color GARANTIA → GTIA; color MANTENIMIENTO → MTO
 *   6) GTIA, GTIAS, GARANT…                     → GTIA
 *   7) MTO, MTTO, MANTTO, MANT, MANTENIM…, RE INST… → MTO
 *   8) lo demás                                 → INSTALACION
 * Si se cambia algo aquí, se cambia el mismo día en Operación y en Julia (prueba: la tabla de 20 celdas).
 * @returns {{ tipo: string, retiro: boolean, cimentacion: boolean, extensivo: boolean, reinstalacion: boolean }}
 */
export const clasificarCita = (cita, { esExtensivo = false } = {}) => {
    const t = textoDeCita(cita);
    const retiro = RE_RETIRO.test(t);
    const cimentacion = RE_CIMENTACION.test(t);
    const extensivoTexto = RE_EXTENSIVO.test(t);
    const extensivo = !!esExtensivo || extensivoTexto;
    const reinstalacion = RE_REINSTALACION.test(t);
    const mtoTexto = RE_MTO.test(t) || reinstalacion;
    const gtiaTexto = RE_GTIA.test(t);
    const color = String(cita?.tipoProyecto || '').toUpperCase();
    const colorMto = color === 'MANTENIMIENTO';
    const colorGtia = color === 'GARANTIA';
    const esGarantia = colorGtia || (!colorMto && gtiaTexto);
    let tipo = 'INSTALACION';
    if (retiro) tipo = 'RETIRO';
    else if (extensivoTexto) tipo = 'EXTENSIVO';
    else if (esExtensivo && !esGarantia) tipo = 'EXTENSIVO';
    else if (cimentacion) tipo = 'CIMENTACION';
    else if (colorGtia) tipo = 'GTIA';
    else if (colorMto) tipo = 'MTO';
    else if (gtiaTexto) tipo = 'GTIA';
    else if (mtoTexto) tipo = 'MTO';
    return { tipo, retiro, cimentacion, extensivo, reinstalacion };
};

// ---------- La regla de antes (bandera apagada): exactamente lo que hacían agenda, tablero y citas del día ----------
const normalizadoAnterior = (cita) => sinAcentos(`${cita?.nombre || ''} ${cita?.cliente || ''}`)
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
/** fechaInstalacion.service y el tablero: la palabra exacta «retiro». */
export const reglaAnteriorRetiro = (cita) => normalizadoAnterior(cita).split(' ').includes('retiro');
/** fechaInstalacion.service y el tablero: «cimentacion» en cualquier parte. */
export const reglaAnteriorCimentacion = (cita) => normalizadoAnterior(cita).includes('cimentacion');
/** GET /produccion/citas: el tipo como lo ponía antes (sin CIMENTACION ni EXTENSIVO). */
export const reglaAnteriorTipoCitas = (cita) => {
    const completo = cita?.cliente ? `${String(cita.nombre || '').trim()} / ${String(cita.cliente).trim()}` : String(cita?.nombre || '').trim();
    return /retiro/i.test(completo) ? 'RETIRO'
        : /gtia|garant/i.test(completo) ? 'GTIA'
            : /\bmto\b|mantenim/i.test(completo) ? 'MTO' : 'INSTALACION';
};

/**
 * El campo VIEJO `tipo` de GET /produccion/citas: SIEMPRE RETIRO, GTIA, MTO o INSTALACION, con la bandera apagada o
 * encendida (verificación del 6-nov-2026). Julia reparte las citas con `['MTO','GTIA','RETIRO'].includes(tipo)`: un valor
 * nuevo (EXTENSIVO, CIMENTACION) sacaría la cita de la lista de Carla y se le confirmaría al cliente como instalación.
 *   apagada   la regla de antes, igual que siempre.
 *   encendida el tipo único solo si es RETIRO, MTO o GTIA («RETIRAR LONA», «MANTTO» o el color de la celda ya se
 *             reconocen); si es EXTENSIVO, CIMENTACION o INSTALACION, la regla de antes. Así encender la bandera solo
 *             puede pasar una cita de INSTALACION a la lista de Carla, nunca al revés.
 * El tipo único de aquí se calcula SIN el producto de la obra (sin esExtensivo; vuelta 1 de la verificación integrada):
 * con él, «X / MANTTO» o una celda pintada de mantenimiento de una obra EXTENSIVO daban EXTENSIVO, caían a la regla de
 * antes y salían como INSTALACION, mientras que la misma celda en otra obra daba MTO.
 * Quien quiera el vocabulario nuevo lee `tipo_cita` y `es_extensivo`.
 */
export const TIPOS_CITA_ANTERIORES = ['RETIRO', 'GTIA', 'MTO', 'INSTALACION'];
export const tipoAnteriorDeCita = (cita, { unico = vocabularioUnico() } = {}) => {
    const antes = reglaAnteriorTipoCitas(cita);
    if (!unico) return antes;
    const nuevo = clasificarCita(cita).tipo;
    return ['RETIRO', 'MTO', 'GTIA'].includes(nuevo) ? nuevo : antes;
};

/**
 * Los tres campos de tipo de una cita de GET /produccion/citas (lo que lee Julia para repartir las citas):
 *  · tipo         el campo viejo (tipoAnteriorDeCita): RETIRO, GTIA, MTO o INSTALACION, sin el producto de la obra;
 *  · tipo_cita    el contrato «tipo de cita v1», con el producto de la obra (`esExtensivo`);
 *  · es_extensivo el producto es EXTENSIVO o la celda lo dice.
 */
export const tiposDeCitaDelDia = (cita, { esExtensivo = false, unico = vocabularioUnico() } = {}) => {
    const clasificada = clasificarCita(cita, { esExtensivo });
    return { tipo: tipoAnteriorDeCita(cita, { unico }), tipo_cita: clasificada.tipo, es_extensivo: clasificada.extensivo };
};

/**
 * ¿Esta cita es un retiro? Con la bandera, el vocabulario único; sin ella, la regla de antes. `unico` deja calcular con
 * la otra regla (la pasada de 5 min compara contra la foto con la regla con que se tomó la foto).
 */
export const esRetiro = (cita, unico = vocabularioUnico()) => (unico ? clasificarCita(cita).retiro : reglaAnteriorRetiro(cita));
/** ¿Esta cita es una cimentación? Con la bandera, el vocabulario único; sin ella, la regla de antes. */
export const esCimentacion = (cita, unico = vocabularioUnico()) => (unico ? clasificarCita(cita).cimentacion : reglaAnteriorCimentacion(cita));

// ---------- Celdas que Planta no entiende ----------
const levenshtein = (a, b) => {
    const m = [];
    for (let i = 0; i <= b.length; i++) m[i] = [i];
    for (let j = 0; j <= a.length; j++) m[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1));
        }
    }
    return m[b.length][a.length];
};
// Palabras largas del vocabulario: una palabra a 1 o 2 letras de distancia que no es ninguna de ellas es un error de dedo.
const LARGAS = ['RETIRO', 'CIMENTACION', 'EXTENSIVO', 'REINSTALACION', 'MANTENIMIENTO', 'GARANTIA', 'INSTALACION'];
// Palabras cortas: solo a una letra.
const CORTAS = ['MTO', 'GTIA'];
// Las dos (largas y cortas) se revisan solo después de la primera diagonal de la celda: antes va el nombre del cliente,
// y ahí daban falsos avisos («RAMIRO GONZALEZ / MTO» salía como RETIRO mal escrito; verificación del 6-nov-2026). En una
// celda sin diagonal, solo las 2 últimas palabras (ver motivosNoEntendida).
const conocida = (p) => RE_RETIRO.test(p) || RE_CIMENTACION.test(p) || RE_EXTENSIVO.test(p) || RE_REINSTALACION.test(p)
    || RE_MTO.test(p) || RE_GTIA.test(p) || /^INSTALACION(ES)?$/.test(p);
// Palabras de uso común que quedan cerca de una del vocabulario y no son error (se amplía si sale alguna en la lista).
// MTZ (Martínez) y RAMIRO: nombres que también llegan después de la diagonal («OBRA / JUAN MTZ / MTO»).
// EXTENSION, INTENSIVO, METRO y MTY (Monterrey): palabras normales que también caen en una celda sin diagonal (vuelta 1).
const COMUNES = new Set(['RETIRA', 'GARANTIZA', 'INSTALADO', 'INSTALADA', 'INSTALAR', 'MOTO', 'GOTA', 'META', 'MITO', 'MATO', 'MOTA', 'GITA', 'GATO', 'GUIA', 'TIA',
    'MTZ', 'RAMIRO', 'EXTENSION', 'INTENSIVO', 'METRO', 'MTY']);

/**
 * Por qué Planta no entiende una celda (lista vacía = la entiende). Tres casos, los que hacen que una pantalla adivine:
 *  · una palabra parecida a una del vocabulario pero mal escrita («RETRIO», «CIMENTASION», «GRANTIA», «GTA»);
 *  · el texto y el color dicen cosas distintas (dice MTO y está pintada de garantía, o al revés);
 *  · dos tipos que se excluyen en la misma celda (RETIRO y REINSTALACIÓN, RETIRO y CIMENTACIÓN).
 * @returns {string[]} motivos en español sencillo
 */
export const motivosNoEntendida = (cita) => {
    const motivos = [];
    // La celda completa partida por sus diagonales; la primera parte (el nombre del cliente) no se revisa.
    const partes = [cita?.nombre, cita?.cliente].filter(Boolean).join(' / ').split('/').map((p) => sinAcentos(p).toUpperCase());
    const palabrasDe = (parte) => parte.replace(/[^A-Z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
    // Una celda sin diagonal («ROSA PEREZ RETRIO») también se revisa, pero solo en sus 2 últimas palabras (donde suele ir
    // el tipo) y nunca en la primera (el nombre de pila). Vuelta 1 de la verificación integrada: antes no se revisaba.
    const revisar = partes.length > 1 ? partes.slice(1).flatMap(palabrasDe) : palabrasDe(partes[0] || '').slice(1).slice(-2);
    for (const palabra of revisar) {
        if (palabra.length < 3 || conocida(palabra) || COMUNES.has(palabra)) continue;
        const larga = palabra.length >= 5 && LARGAS.find((k) => Math.abs(k.length - palabra.length) <= 2 && levenshtein(palabra, k) <= 2);
        const corta = palabra.length <= 5 && CORTAS.find((k) => levenshtein(palabra, k) === 1);
        const parecida = larga || corta;
        if (parecida) motivos.push(`«${palabra}» parece ${parecida} mal escrito`);
    }
    const c = clasificarCita(cita);
    const t = textoDeCita(cita);
    const color = String(cita?.tipoProyecto || '').toUpperCase();
    const mtoTexto = RE_MTO.test(t) || c.reinstalacion;
    const gtiaTexto = RE_GTIA.test(t);
    if (mtoTexto && !gtiaTexto && color === 'GARANTIA') motivos.push('dice MTO pero está pintada de garantía');
    if (gtiaTexto && !mtoTexto && color === 'MANTENIMIENTO') motivos.push('dice GTIA pero está pintada de mantenimiento');
    if (c.retiro && c.reinstalacion) motivos.push('dice RETIRO y REINSTALACIÓN en la misma celda: ¿cuál de los dos es?');
    if (c.retiro && c.cimentacion) motivos.push('dice RETIRO y CIMENTACIÓN en la misma celda: ¿cuál de los dos es?');
    return motivos;
};

/**
 * Las celdas de una lista de citas que Planta no entiende, sin repetir (la misma celda puede venir de dos pestañas).
 * @returns {{ fecha: string|null, celda: string, motivos: string[] }[]} ordenadas por fecha
 */
export const celdasNoEntendidas = (citas) => {
    const vistas = new Set();
    const lista = [];
    for (const cita of citas || []) {
        if (!cita?.nombre) continue;
        const motivos = motivosNoEntendida(cita);
        if (!motivos.length) continue;
        const celda = [cita.nombre, cita.cliente].filter(Boolean).map((p) => String(p).trim()).join(' / ').slice(0, 160);
        const clave = `${cita.fecha || ''}|${celda}`;
        if (vistas.has(clave)) continue;
        vistas.add(clave);
        lista.push({ fecha: cita.fecha || null, celda, motivos });
    }
    return lista.sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')) || a.celda.localeCompare(b.celda));
};

/**
 * La respuesta de GET /api/calendario/mes/:mes con cuatro campos nuevos en cada cita, para que el tablero
 * (frontend/src/utils/produccion.js) decida igual que la agenda sin repetir la regla: tipoCita (vocabulario único),
 * esRetiro y esCimentacion (lo que Planta usa hoy para las fechas: la regla de antes o la única, según la bandera) y
 * unaFecha (bandera encendida: la cimentación deja la obra sin fecha también en el tablero). No toca el original.
 */
export const conVocabulario = (resultado) => {
    const proyectos = resultado?.data?.proyectos;
    if (!Array.isArray(proyectos)) return resultado;
    const unaFecha = vocabularioUnico();
    return {
        ...resultado,
        data: {
            ...resultado.data,
            proyectos: proyectos.map((c) => ({ ...c, tipoCita: clasificarCita(c).tipo, esRetiro: esRetiro(c, unaFecha), esCimentacion: esCimentacion(c, unaFecha), unaFecha }))
        }
    };
};

export default { vocabularioUnico, clasificarCita, tipoAnteriorDeCita, tiposDeCitaDelDia, esRetiro, esCimentacion, motivosNoEntendida, celdasNoEntendidas, conVocabulario };
