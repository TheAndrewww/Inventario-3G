/**
 * Ordena proyectos por urgencia (criterio único para Dashboard y TV).
 *   0. Proyectos pausados van al final (después de todos los activos)
 *   1. En retraso primero (estadoRetraso.enRetraso — solo tipos A/B/C)
 *   2. Más días de retraso cuando ambos están en retraso
 *   3. Vencidos (diasRestantes < 0)
 *   4. Por prioridad (1 = urgente … 5 = muy baja)
 *   5. Tiebreaker: diasRestantesEtapa (menor = más urgente)
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

        // Lógica especial para Instalación: Solo es "urgente" si faltan <= 2 días para la FECHA LÍMITE del proyecto
        // Si ya pasó la fecha (< 0), TAMBIÉN es urgente (Vencido).
        let aEnRetrasoParaSort = a.estadoRetraso?.enRetraso;
        if (a.etapa_actual === 'instalacion') {
            const diasParaEntrega = a.diasRestantes ?? 999;
            // Solo si faltan > 2 días no es urgente.
            // Si faltan <= 2 días (incluyendo negativos), SÍ es urgente.
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

        let aVencido = a.diasRestantes !== null && a.diasRestantes < 0;
        // Permitir que Instalación sea Vencido si pasó la fecha
        // if (a.etapa_actual === 'instalacion') aVencido = false; 

        let bVencido = b.diasRestantes !== null && b.diasRestantes < 0;
        // if (b.etapa_actual === 'instalacion') bVencido = false;

        if (aVencido !== bVencido) return aVencido ? -1 : 1;

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
        if (current.getUTCDay() !== 0) { // Si no es Domingo
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
        if (cur.getUTCDay() !== 0) dias++;
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
