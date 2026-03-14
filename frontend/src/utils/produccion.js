/**
 * Ordena proyectos por urgencia (criterio único para Dashboard y TV).
 *   0. Proyectos pausados van al final
 *   1. GTIA (Garantía) va primero
 *   2. Vencidos primero (diasRestantes < 0), más atraso = más arriba
 *   3. En retraso por etapa (estadoRetraso.enRetraso)
 *   4. Por prioridad (1 = urgente … 5 = muy baja)
 *   5. Tiebreaker: diasRestantes (menor = más urgente)
 *
 * Retorna un nuevo array; no muta el original.
 */
export const sortProyectosPorUrgencia = (proyectos) =>
    [...proyectos].sort((a, b) => {
        const aPausado = a.pausado ? 1 : 0;
        const bPausado = b.pausado ? 1 : 0;
        if (aPausado !== bPausado) return aPausado - bPausado;

        // Prioridad absoluta: GTIA (Garantía) va primero
        const aEsGarantia = a.tipo_proyecto === 'GTIA' ? 1 : 0;
        const bEsGarantia = b.tipo_proyecto === 'GTIA' ? 1 : 0;
        if (aEsGarantia !== bEsGarantia) return bEsGarantia - aEsGarantia;

        // Vencidos (fecha límite pasada) van primero — más días de atraso = más arriba
        const aVencido = a.diasRestantes !== null && a.diasRestantes < 0;
        const bVencido = b.diasRestantes !== null && b.diasRestantes < 0;
        if (aVencido !== bVencido) return aVencido ? -1 : 1;
        if (aVencido && bVencido) {
            return a.diasRestantes - b.diasRestantes; // más negativo = más atraso = primero
        }

        // En retraso por etapa
        let aEnRetrasoParaSort = a.estadoRetraso?.enRetraso;
        if (a.etapa_actual === 'instalacion') {
            const diasParaEntrega = a.diasRestantes ?? 999;
            if (diasParaEntrega > 2) aEnRetrasoParaSort = false;
            else aEnRetrasoParaSort = true;
        }

        let bEnRetrasoParaSort = b.estadoRetraso?.enRetraso;
        if (b.etapa_actual === 'instalacion') {
            const diasParaEntrega = b.diasRestantes ?? 999;
            if (diasParaEntrega > 2) bEnRetrasoParaSort = false;
            else bEnRetrasoParaSort = true;
        }

        const aRetraso = aEnRetrasoParaSort ? 1 : 0;
        const bRetraso = bEnRetrasoParaSort ? 1 : 0;
        if (aRetraso !== bRetraso) return bRetraso - aRetraso;

        if (aRetraso && bRetraso) {
            const aRetrasoDias = a.estadoRetraso?.diasRetraso || 0;
            const bRetrasoDias = b.estadoRetraso?.diasRetraso || 0;
            if (aRetrasoDias !== bRetrasoDias) return bRetrasoDias - aRetrasoDias;
        }

        let aPrioridad = a.prioridad || 3;
        // Si es instalación y no es urgente (>2 días), bajar prioridad al mínimo (5)
        if (a.etapa_actual === 'instalacion') {
            const diasParaEntrega = a.diasRestantes ?? 999;
            if (diasParaEntrega > 2) aPrioridad = 5;
        }

        let bPrioridad = b.prioridad || 3;
        if (b.etapa_actual === 'instalacion') {
            const diasParaEntrega = b.diasRestantes ?? 999;
            if (diasParaEntrega > 2) bPrioridad = 5;
        }

        if (aPrioridad !== bPrioridad) return aPrioridad - bPrioridad;

        const aDiasEtapa = a.estadoRetraso?.diasRestantesEtapa ?? a.diasRestantes ?? 999;
        const bDiasEtapa = b.estadoRetraso?.diasRestantesEtapa ?? b.diasRestantes ?? 999;
        return aDiasEtapa - bDiasEtapa;
    });

/**
 * Extrae y combina proyectos del objeto resumen agrupado por etapa
 * que retorna el backend: { pendiente: { proyectos: [] }, diseno: { proyectos: [] }, … }
 */
export const flattenProyectos = (resumen) => {
    const proyectos = [];
    Object.keys(resumen).forEach(etapa => {
        proyectos.push(...(resumen[etapa]?.proyectos || []));
    });
    return proyectos;
};

// ---------------------------------------------------------------------------
// Helpers de escalado CSS para la vista TV.
// El contenedor TV setea --escala como custom property; en el dashboard normal
// no existe → defaultean a 1, sin efecto.
// ---------------------------------------------------------------------------
export const s = (val) => `calc(${val}rem * var(--escala, 1))`;
export const px = (val) => `calc(${val}px * var(--escala, 1))`;

// Días de asueto oficiales en México y días de asueto de la empresa (formato MM-DD)
// Se omitió el año para que aplique siempre anualmente a menos que sea una fecha móvil, 
// en este caso dejaremos las fechas fijas que siempre caen en los mismos días.
const DIAS_ASUETO = [
    '01-01', // Año nuevo
    '02-05', // Día de la Constitución (se recorre al lunes, pero dejaremos fijo o los exactos del año si se desea)
    '03-21', // Natalicio Benito Juárez
    '05-01', // Día del Trabajo
    '09-16', // Día de la Independencia
    '11-20', // Revolución Mexicana
    '12-25', // Navidad
    // Agregamos fechas específicas de 2026 que sabemos son puente
    '2026-02-02', // Puente constitución
    '2026-03-16', // Puente natalicio Juárez
    '2026-11-16'  // Puente Revolución
];

/**
 * Verifica si una fecha es día de asueto
 */
const esDiaAsueto = (date) => {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return DIAS_ASUETO.includes(`${m}-${d}`) || DIAS_ASUETO.includes(`${y}-${m}-${d}`);
};


/**
 * Suma días hábiles (Lun-Sab) a una fecha.
 * Excluye domingos (0).
 * Basado en la lógica del backend: distance(Sat, Mon) = 1.
 * startDateStr: 'YYYY-MM-DD'
 */
export const addBusinessDays = (startDateStr, daysToAdd) => {
    if (!startDateStr) return null;
    const [year, month, day] = startDateStr.split('-').map(Number);
    // Usar UTC para evitar problemas de horario
    let current = new Date(Date.UTC(year, month - 1, day));

    let added = 0;
    while (added < daysToAdd) {
        current.setUTCDate(current.getUTCDate() + 1);
        if (current.getUTCDay() !== 0 && !esDiaAsueto(current)) { // Si no es Domingo ni asueto
            added++;
        }
    }
    return current;
};

/**
 * Calcula días hábiles (Lun-Sab) entre dos fechas 'YYYY-MM-DD'.
 * Retorna positivo si endStr > startStr, negativo si al revés.
 */
export const calcularDiasHabiles = (startStr, endStr) => {
    if (!startStr || !endStr) return 0;
    const parse = (s) => {
        const [y, m, d] = s.split('-').map(Number);
        return Date.UTC(y, m - 1, d);
    };
    const tsStart = parse(startStr);
    const tsEnd = parse(endStr);
    const start = new Date(Math.min(tsStart, tsEnd));
    const end = new Date(Math.max(tsStart, tsEnd));
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(0, 0, 0, 0);

    let dias = 0;
    const cur = new Date(start);
    while (cur.getTime() < end.getTime()) {
        cur.setUTCDate(cur.getUTCDate() + 1);
        if (cur.getUTCDay() !== 0 && !esDiaAsueto(cur)) dias++;
    }
    return tsStart <= tsEnd ? dias : -dias;
};

/**
 * Retorna la fecha de hoy (hora México, -6) como 'YYYY-MM-DD'.
 */
export const getHoyStr = () => {
    const now = new Date();
    const mexicoOffset = -6 * 60;
    const mx = new Date(now.getTime() + (now.getTimezoneOffset() + mexicoOffset) * 60 * 1000);
    const y = mx.getFullYear();
    const m = String(mx.getMonth() + 1).padStart(2, '0');
    const d = String(mx.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/**
 * Formatea una fecha Date a "d MMM" (ej: "23 feb")
 */
export const formatDateShort = (date) => {
    if (!date) return '';
    // Usar toLocaleDateString con timezone UTC para coincidir con el cálculo
    return date.toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC'
    });
};

/**
 * Resta días hábiles (Lun-Sab) a una fecha.
 * Retorna un Date UTC.
 */
export const restarDiasHabiles = (dateStr, daysToSubtract) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    let current = new Date(Date.UTC(year, month - 1, day));
    let removed = 0;
    while (removed < daysToSubtract) {
        current.setUTCDate(current.getUTCDate() - 1);
        if (current.getUTCDay() !== 0 && !esDiaAsueto(current)) { // Si no es Domingo ni asueto
            removed++;
        }
    }
    return current;
};

// Importar constantes inline para calcularDiasPorEtapa
const TIEMPOS_POR_TIPO_CALC = {
    'C': { diseno: 1, compras: 2, produccion: 5, instalacion: 6 },
    'B': { diseno: 2, compras: 5, produccion: 10, instalacion: 13 },
    'A': { diseno: 5, compras: 10, produccion: 20, instalacion: 25 }
};
const DIAS_INDIVIDUALES_POR_TIPO_CALC = {
    'C': { diseno: 1, compras: 1, produccion: 3, instalacion: 1 },
    'B': { diseno: 2, compras: 3, produccion: 5, instalacion: 3 },
    'A': { diseno: 5, compras: 5, produccion: 10, instalacion: 5 }
};

/**
 * Calcula los días restantes y fechas límite para cada etapa de un proyecto.
 * Maneja 3 casos:
 *   1. No hay tiempo suficiente → Calcula hacia atrás desde fecha_limite
 *   2. Diseño se atrasó pero hay margen → Recalcula hacia adelante desde diseno_completado_en
 *   3. Todo a tiempo → Cálculo original desde fecha_entrada
 * Retorna { diseno: { dias, fechaLimite }, compras: {...}, produccion: {...}, instalacion: {...} }
 * o null si el proyecto no tiene reglas de tiempo.
 */
export const calcularDiasPorEtapa = (proyecto) => {
    const tipo = proyecto.tipo_proyecto?.toUpperCase();
    if (!tipo || !TIEMPOS_POR_TIPO_CALC[tipo]) return null;
    if (!proyecto.estadoRetraso || proyecto.estadoRetraso.tiempoPermitido === null) return null;

    const tiemposAcum = TIEMPOS_POR_TIPO_CALC[tipo];
    const diasIndiv = DIAS_INDIVIDUALES_POR_TIPO_CALC[tipo];
    const hoy = getHoyStr();
    const fechaEntrada = proyecto.fecha_entrada;
    const fechaLimite = proyecto.fecha_limite;
    const disenoCompletadoEn = proyecto.diseno_completado_en
        ? proyecto.diseno_completado_en.substring(0, 10)
        : null;

    const dateToStr = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    // Fechas originales (hacia adelante desde fecha_entrada)
    const fechasOriginales = {};
    for (const etapa of ['diseno', 'compras', 'produccion', 'instalacion']) {
        fechasOriginales[etapa] = addBusinessDays(fechaEntrada, tiemposAcum[etapa]);
    }

    // CASO 1: No hay tiempo suficiente → calcular hacia atrás desde fecha_limite
    if (fechaLimite) {
        const totalDiasNecesarios = tiemposAcum.instalacion;
        const diasDesdeEntradaALimite = calcularDiasHabiles(fechaEntrada, fechaLimite);

        // Si el proyecto tiene fecha impuesta por el calendario, SIEMPRE calculamos hacia atrás.
        // O si no hay tiempo suficiente desde la entrada hasta la fecha límite.
        if (proyecto._fechaCalendario || diasDesdeEntradaALimite < totalDiasNecesarios) {
            const resultado = {};
            const etapas = ['diseno', 'compras', 'produccion', 'instalacion'];
            for (let i = 0; i < etapas.length; i++) {
                const etapa = etapas[i];
                let diasPosteriores = 0;
                for (let j = i + 1; j < etapas.length; j++) {
                    diasPosteriores += diasIndiv[etapas[j]];
                }
                const fechaDebeTerminar = restarDiasHabiles(fechaLimite, diasPosteriores);
                const diasRestantes = calcularDiasHabiles(hoy, dateToStr(fechaDebeTerminar));
                resultado[etapa] = { dias: diasRestantes, fechaLimite: fechaDebeTerminar };
            }
            return resultado;
        }
    }

    // Verificar si Diseño se atrasó
    const fechaLimiteDisenoStr = dateToStr(fechasOriginales.diseno);
    let disenoSeAtraso = false;
    if (disenoCompletadoEn && fechaLimiteDisenoStr) {
        disenoSeAtraso = calcularDiasHabiles(fechaLimiteDisenoStr, disenoCompletadoEn) > 0;
    }

    // CASO 2: Diseño se atrasó pero hay margen → recalcular hacia adelante
    if (disenoSeAtraso && fechaLimite) {
        const diasNecesariosRestantes = diasIndiv.compras + diasIndiv.produccion + diasIndiv.instalacion;
        const margenDisponible = calcularDiasHabiles(disenoCompletadoEn, fechaLimite);

        if (margenDisponible >= diasNecesariosRestantes) {
            const resultado = {};
            const diasDesdeEntradaAHoy = calcularDiasHabiles(fechaEntrada, hoy) - 1;
            resultado.diseno = {
                dias: tiemposAcum.diseno - Math.max(0, diasDesdeEntradaAHoy),
                fechaLimite: fechasOriginales.diseno
            };
            let acumulado = 0;
            for (const etapa of ['compras', 'produccion', 'instalacion']) {
                acumulado += diasIndiv[etapa];
                const nuevaFechaLimite = addBusinessDays(disenoCompletadoEn, acumulado);
                const diasRestantes = calcularDiasHabiles(hoy, dateToStr(nuevaFechaLimite));
                resultado[etapa] = { dias: diasRestantes, fechaLimite: nuevaFechaLimite };
            }
            return resultado;
        }
    }

    // CASO 3: Todo a tiempo, usar cálculo original
    const diasEnProyecto = proyecto.estadoRetraso.diasEnProyecto;
    const resultado = {};
    for (const etapa of ['diseno', 'compras', 'produccion', 'instalacion']) {
        resultado[etapa] = {
            dias: tiemposAcum[etapa] - diasEnProyecto,
            fechaLimite: fechasOriginales[etapa]
        };
    }
    return resultado;
};

// ===== Calendar-based deadline override =====

/**
 * Normaliza un nombre para comparación: minúsculas, sin acentos, sin espacios extra
 */
const normalizarNombre = (str) => {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
};

/**
 * Calcula la distancia de Levenshtein entre dos strings
 */
const levenshtein = (a, b) => {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            const cost = b[i - 1] === a[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    return matrix[b.length][a.length];
};

/**
 * Compara dos nombres y devuelve true si:
 * - La similitud Levenshtein es >= 80%, O
 * - Uno contiene al otro como substring (para nombres parciales del calendario)
 */
export const matchNombre = (nombreA, nombreB) => {
    const a = normalizarNombre(nombreA);
    const b = normalizarNombre(nombreB);
    if (!a || !b) return false;
    if (a === b) return true;
    
    // Check substring containment (calendar often has shorter names)
    // Solo si el substring tiene al menos 8 caracteres para evitar falsos positivos
    if (a.length >= 8 && b.length >= 8) {
        if (a.includes(b) || b.includes(a)) return true;
    }
    
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return false;
    const dist = levenshtein(a, b);
    const similarity = 1 - dist / maxLen;
    return similarity >= 0.8;
};

/**
 * Aplica fechas del calendario como fecha_limite a los proyectos de producción.
 * Para cada proyecto del calendario, busca un match de nombre (≥80%) en la lista de producción.
 * Si encuentra match, overridea fecha_limite con (día del calendario - 1).
 *
 * @param {Array} proyectos - Proyectos de producción
 * @param {Array} calendarioProyectos - Proyectos del calendario [{nombre, dia, ...}]
 * @param {number} anio - Año actual
 * @param {number} mes - Mes actual (1-12)
 * @returns {Array} Proyectos con fecha_limite actualizada donde corresponde
 */
export const aplicarFechasCalendario = (proyectos, calendarioProyectos, anio, mes) => {
    if (!calendarioProyectos?.length || !proyectos?.length) return proyectos;

    // Crear mapa de nombre calendario → menor día encontrado
    const fechasPorNombre = {};
    calendarioProyectos.forEach(cp => {
        if (!cp.nombre || !cp.dia) return;
        const key = normalizarNombre(cp.nombre);
        if (!key) return;
        // Ignorar entradas de cimentación
        if (key.includes('cimentacion')) return;
        // Guardar el menor día (primera aparición del proyecto en el calendario)
        if (!fechasPorNombre[key] || cp.dia < fechasPorNombre[key]) {
            fechasPorNombre[key] = cp.dia;
        }
    });

    const nombresCalendario = Object.keys(fechasPorNombre);
    if (nombresCalendario.length === 0) return proyectos;

    return proyectos.map(p => {
        const nombreProd = normalizarNombre(p.nombre);
        if (!nombreProd) return p;

        // Buscar match en nombres del calendario
        for (const nombreCal of nombresCalendario) {
            if (matchNombre(nombreProd, nombreCal)) {
                const diaCal = fechasPorNombre[nombreCal];
                // Fecha calendario real
                const fechaCalendarioStr = `${anio}-${String(mes).padStart(2, '0')}-${String(diaCal).padStart(2, '0')}`;
                
                // Fecha de entrega para Completado: 1 día de TRABAJO (Lun-Vie) antes de la instalación
                // Ignora sábados, domingos y días de asueto
                const [yDate, mDate, dDate] = fechaCalendarioStr.split('-').map(Number);
                let current = new Date(Date.UTC(yDate, mDate - 1, dDate));
                let removed = 0;
                while (removed < 1) {
                    current.setUTCDate(current.getUTCDate() - 1);
                    // 0 = Domingo, 6 = Sábado
                    if (current.getUTCDay() !== 0 && current.getUTCDay() !== 6 && !esDiaAsueto(current)) {
                        removed++;
                    }
                }
                
                const y = current.getUTCFullYear();
                const m = String(current.getUTCMonth() + 1).padStart(2, '0');
                const d = String(current.getUTCDate()).padStart(2, '0');
                const nuevaFechaLimite = `${y}-${m}-${d}`;

                // El calendario manda. Siempre overridear la fecha_limite con la del calendario.
                return { ...p, fecha_limite: nuevaFechaLimite, _fechaCalendario: true };
            }
        }
        return p;
    });
};
