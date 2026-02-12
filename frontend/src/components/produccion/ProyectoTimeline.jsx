import React, { memo, useMemo } from 'react';
import { px } from '../../utils/produccion';
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
 */
const ProyectoTimeline = memo(({ proyecto, onCompletar, onRegresar, onTogglePausa, onCompletarSubEtapa, onToggleEtapa }) => {
    // Memoizar cálculos de estilo del contenedor
    const containerStyles = useMemo(() => {
        const diasRestantes = proyecto.diasRestantes;
        const esGarantia = proyecto.tipo_proyecto?.toUpperCase() === 'GTIA';
        const estadoRetraso = proyecto.estadoRetraso || { enRetraso: false };
        const enRetraso = estadoRetraso.enRetraso;

        // Estado pausado/congelado tiene prioridad visual
        if (proyecto.pausado) {
            return {
                className: `bg-blue-100 border-l-4 border-blue-400 overflow-hidden transition-all rounded-lg shadow-sm opacity-80`,
                style: { marginBottom: px(4) },
                isPaused: true
            };
        }

        const urgenciaPorFecha = diasRestantes !== null && diasRestantes <= 3;
        let esUrgente = proyecto.prioridad === 1 || esGarantia || urgenciaPorFecha || enRetraso;

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

        return {
            className: `${bgFinal} ${borderFinal} overflow-hidden transition-all ${esUrgente ? 'ring-2 ring-red-400' : ''} rounded-lg shadow-sm`,
            style: { marginBottom: px(4) },
            isPaused: false
        };
    }, [proyecto.diasRestantes, proyecto.tipo_proyecto, proyecto.estadoRetraso, proyecto.prioridad, proyecto.pausado]);

    return (
        <div className={containerStyles.className} style={containerStyles.style}>
            <TimelineHeader proyecto={proyecto} isPaused={containerStyles.isPaused} />
            <TimelineStepper proyecto={proyecto} isPaused={containerStyles.isPaused} />
            <TimelineFooter proyecto={proyecto} onCompletar={onCompletar} onRegresar={onRegresar} onTogglePausa={onTogglePausa} isPaused={containerStyles.isPaused} onCompletarSubEtapa={onCompletarSubEtapa} onToggleEtapa={onToggleEtapa} />
        </div>
    );
});

ProyectoTimeline.displayName = 'ProyectoTimeline';

export default ProyectoTimeline;
