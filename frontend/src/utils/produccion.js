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
        // Proyectos pausados van al final
        const aPausado = a.pausado ? 1 : 0;
        const bPausado = b.pausado ? 1 : 0;
        if (aPausado !== bPausado) return aPausado - bPausado;

        const aRetraso = a.estadoRetraso?.enRetraso ? 1 : 0;
        const bRetraso = b.estadoRetraso?.enRetraso ? 1 : 0;
        if (aRetraso !== bRetraso) return bRetraso - aRetraso;

        if (aRetraso && bRetraso) {
            const aRetrasoDias = a.estadoRetraso?.diasRetraso || 0;
            const bRetrasoDias = b.estadoRetraso?.diasRetraso || 0;
            if (aRetrasoDias !== bRetrasoDias) return bRetrasoDias - aRetrasoDias;
        }

        const aVencido = a.diasRestantes !== null && a.diasRestantes < 0;
        const bVencido = b.diasRestantes !== null && b.diasRestantes < 0;
        if (aVencido !== bVencido) return aVencido ? -1 : 1;

        const aPrioridad = a.prioridad || 3;
        const bPrioridad = b.prioridad || 3;
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
