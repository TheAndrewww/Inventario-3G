import React, { memo, useMemo } from 'react';
import { px, s as escalar, calcularDiasPorEtapa, esProyectoMTO, esUrgenteMTO, getEstadoCierrePreparado } from '../../utils/produccion';
import { ETAPAS_CONFIG, getColorPorTipo, usaTimelineSimplificado } from './constants';
import TimelineHeader from './TimelineHeader';
import TimelineStepper from './TimelineStepper';
import TimelineFooter from './TimelineFooter';

// Re-exportar para compatibilidad con imports existentes
export { ETAPAS_CONFIG } from './constants';
export { ETAPAS_ORDEN } from './constants';

/**
 * Componente principal de tarjeta de proyecto con timeline visual.
 * Ahora compuesto por subcomponentes memoizados para mejor rendimiento.
 * 
 * @param {object}   props.proyecto    - Datos del proyecto
 * @param {function} props.onCompletar - Callback para avanzar etapa (opcional)
 * @param {function} props.onTogglePausa - Callback para pausar/reanudar (opcional)
 * @param {Function} props.onAbrirCarpeta - Si se pasa, el nombre del proyecto
 *                   abre la carpeta de Drive (dashboard de producción).
 * @param {boolean}  props.modoPreparados - Vista de Preparados: marca en rojo los
 *        proyectos cuya instalación ya terminó según el calendario (hay que
 *        cerrarlos) y avisa cuando la última cita quedó marcada como FALLA.
 */
const ProyectoTimeline = memo(({ proyecto, onCompletar, onRegresar, onTogglePausa, onCompletarSubEtapa, onToggleEtapa, etapasPermitidas = null, onAbrirCarpeta, modoPreparados = false }) => {
    // Estado de cierre (solo aplica en la vista de Preparados)
    const estadoCierre = useMemo(
        () => (modoPreparados ? getEstadoCierrePreparado(proyecto) : { debeCerrar: false, falla: false, nota: null, diasDesde: 0 }),
        [modoPreparados, proyecto._fechaFinInstalacion, proyecto._fallaInstalacion, proyecto._notaFalla, proyecto.pausado]
    );

    // Memoizar cálculos de estilo del contenedor
    const containerStyles = useMemo(() => {
        const diasRestantes = proyecto.diasRestantes;
        const esGarantia = proyecto.tipo_proyecto?.toUpperCase() === 'GTIA';
        const estadoRetraso = proyecto.estadoRetraso || { enRetraso: false };
        let enRetraso = estadoRetraso.enRetraso;

        // Si el proyecto tiene fecha de calendario, recalcular con calcularDiasPorEtapa
        if (enRetraso && proyecto._fechaCalendario) {
            const diasPorEtapa = calcularDiasPorEtapa(proyecto);
            if (diasPorEtapa) {
                const etapaKey = proyecto.etapa_actual === 'produccion' ? 'produccion' : proyecto.etapa_actual;
                const info = diasPorEtapa[etapaKey];
                if (info && info.dias >= 0) {
                    enRetraso = false;
                }
            }
        }

        // Estado pausado/congelado tiene prioridad visual
        if (proyecto.pausado) {
            return {
                className: `bg-blue-100 border-l-4 border-blue-400 overflow-hidden transition-all rounded-lg shadow-sm opacity-80`,
                style: { marginBottom: px(4) },
                isPaused: true
            };
        }

        const urgenciaPorFecha = diasRestantes !== null && diasRestantes <= 3;
        // MTO: solo cuenta la fecha del calendario. Urgente únicamente si ya se pasó.
        let esUrgente = esProyectoMTO(proyecto)
            ? esUrgenteMTO(proyecto)
            : (proyecto.prioridad === 1 || esGarantia || urgenciaPorFecha || enRetraso);

        // Lógica visual específica para Instalación
        if (proyecto.etapa_actual === 'instalacion') {
            // "ya es como si hubiera terminado" -> No marcar urgencia ni retraso visual
            esUrgente = false;
        }

        const colorTipo = getColorPorTipo(proyecto.tipo_proyecto);

        // Si es Instalación, NUNCA mostrar como retraso (rojo), siempre color normal (verde/azul)
        const mostrarComoRetraso = enRetraso && proyecto.etapa_actual !== 'instalacion';

        const bgFinal = mostrarComoRetraso ? 'bg-red-50' : colorTipo.bg;
        const borderFinal = mostrarComoRetraso ? 'border-l-4 border-red-500' : colorTipo.border;

        // Preparados: la instalación ya pasó según el calendario → hay que cerrar
        // el proyecto. Se enmarca en rojo aunque la etapa sea 'instalacion'.
        const marcoCierre = estadoCierre.debeCerrar
            ? 'ring-2 ring-red-500'
            : (estadoCierre.falla ? 'ring-2 ring-amber-500' : '');

        return {
            className: `${bgFinal} ${borderFinal} overflow-hidden transition-all ${marcoCierre || (esUrgente ? 'ring-2 ring-red-400' : '')} rounded-lg shadow-sm`,
            style: { marginBottom: px(4) },
            isPaused: false
        };
    }, [proyecto.diasRestantes, proyecto.tipo_proyecto, proyecto.estadoRetraso, proyecto.prioridad, proyecto.pausado, proyecto.etapa_actual, estadoCierre]);

    return (
        <div className={containerStyles.className} style={containerStyles.style}>
            <TimelineHeader proyecto={proyecto} isPaused={containerStyles.isPaused} onAbrirCarpeta={onAbrirCarpeta} />
            {estadoCierre.falla && (
                <div
                    className="bg-amber-100 border-y border-amber-300 text-amber-900 font-semibold"
                    style={{ padding: `${px(4)} ${px(12)}`, fontSize: escalar(0.8) }}
                >
                    ⚠️ FALLA EN INSTALACIÓN · reprogramar
                    {estadoCierre.nota && (
                        <span className="font-normal"> — {estadoCierre.nota}</span>
                    )}
                </div>
            )}
            <TimelineStepper proyecto={proyecto} isPaused={containerStyles.isPaused} />
            <TimelineFooter proyecto={proyecto} onCompletar={onCompletar} onRegresar={onRegresar} onTogglePausa={onTogglePausa} isPaused={containerStyles.isPaused} onCompletarSubEtapa={onCompletarSubEtapa} onToggleEtapa={onToggleEtapa} etapasPermitidas={etapasPermitidas} />
        </div>
    );
});

ProyectoTimeline.displayName = 'ProyectoTimeline';

export default ProyectoTimeline;
