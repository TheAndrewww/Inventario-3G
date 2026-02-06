import React, { memo, useState } from 'react';
import { CheckCircle2, RefreshCw, ChevronRight, Pause, Play, Snowflake } from 'lucide-react';
import { ETAPAS_CONFIG, ETAPAS_ORDEN, usaTimelineSimplificado } from './constants';

/**
 * Footer de la tarjeta de proyecto
 * Muestra: estado sub-etapas, mensaje completado, botón avanzar, botón pausar
 */
const TimelineFooter = memo(({ proyecto, onCompletar, onTogglePausa, isPaused }) => {
    const [loading, setLoading] = useState(false);
    const [pauseLoading, setPauseLoading] = useState(false);
    const timelineSimplificado = usaTimelineSimplificado(proyecto);

    const handleCompletar = async () => {
        if (loading || proyecto.etapa_actual === 'completado' || !onCompletar) return;
        setLoading(true);
        try {
            await onCompletar(proyecto.id);
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePausa = async () => {
        if (pauseLoading || !onTogglePausa) return;

        // Si está pausado, solo reanudar (sin pedir motivo)
        // Si no está pausado, pedir motivo para pausar
        let motivo = '';
        if (!isPaused) {
            motivo = window.prompt('¿Cuál es el motivo de la pausa? (opcional)');
            // Si el usuario cancela el prompt, no hacer nada
            if (motivo === null) return;
        }

        setPauseLoading(true);
        try {
            await onTogglePausa(proyecto.id, motivo);
        } finally {
            setPauseLoading(false);
        }
    };

    // Si no hay callbacks, no mostrar nada
    if (!onCompletar && !onTogglePausa) return null;

    return (
        <div className={isPaused ? 'grayscale-[50%]' : ''}>
            {/* Indicador de proyecto pausado */}
            {isPaused && (
                <div className="px-6 py-3 bg-blue-100 border-t border-blue-200 text-center">
                    <span className="text-base text-blue-700 font-bold flex items-center justify-center gap-2">
                        <Snowflake size={18} className="text-blue-500" /> Proyecto Pausado
                        {proyecto.pausado_motivo && <span className="font-normal text-sm">- {proyecto.pausado_motivo}</span>}
                    </span>
                </div>
            )}

            {/* Detalle sub-etapas cuando está en producción */}
            {!isPaused && proyecto.etapa_actual === 'produccion' && proyecto.estadoSubEtapas && !proyecto.estadoSubEtapas.ambosCompletados && (
                <div className="px-6 py-3 bg-amber-50 border-t border-amber-100 flex justify-center gap-8 text-sm">
                    <div className="flex items-center gap-2">
                        <div className={`w-3.5 h-3.5 rounded-full ${proyecto.estadoSubEtapas.manufactura?.completado ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className={proyecto.estadoSubEtapas.manufactura?.completado ? 'text-green-700 font-medium line-through' : 'text-gray-500'}>
                            Manufactura
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-3.5 h-3.5 rounded-full ${proyecto.estadoSubEtapas.herreria?.completado ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className={proyecto.estadoSubEtapas.herreria?.completado ? 'text-green-700 font-medium line-through' : 'text-gray-500'}>
                            Herrería
                        </span>
                    </div>
                </div>
            )}

            {/* Mensaje: producción finalizada */}
            {!isPaused && proyecto.estadoSubEtapas?.ambosCompletados && proyecto.etapa_actual === 'produccion' && (
                <div className="px-6 py-3 bg-green-50 border-t border-green-100 text-center">
                    <span className="text-base text-green-700 font-bold flex items-center justify-center gap-2">
                        <CheckCircle2 size={16} /> Producción Finalizada - Listo para enviar a Instalación
                    </span>
                </div>
            )}

            {/* Footer: proyecto completado */}
            {proyecto.etapa_actual === 'completado' && (
                <div className="px-6 py-4 bg-white border-t border-gray-100">
                    <div className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg">
                        <CheckCircle2 size={20} />
                        <span>Proyecto Completado</span>
                    </div>
                </div>
            )}

            {/* Botones: avanzar etapa + pausar */}
            {proyecto.etapa_actual !== 'completado' && proyecto.etapa_actual !== 'instalacion' && !timelineSimplificado && (
                <div className="px-6 py-4 bg-white border-t border-gray-100 flex gap-3">
                    {/* Botón pausar/reanudar */}
                    {onTogglePausa && (
                        <button
                            onClick={handleTogglePausa}
                            disabled={pauseLoading}
                            className={`py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isPaused
                                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white'
                                : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                                }`}
                            title={isPaused ? 'Reanudar proyecto' : 'Pausar proyecto'}
                        >
                            {pauseLoading ? (
                                <RefreshCw size={18} className="animate-spin" />
                            ) : isPaused ? (
                                <Play size={18} />
                            ) : (
                                <Pause size={18} />
                            )}
                        </button>
                    )}

                    {/* Botón avanzar etapa (deshabilitado si está pausado) */}
                    {onCompletar && (
                        <button
                            onClick={handleCompletar}
                            disabled={loading || isPaused}
                            className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <RefreshCw size={18} className="animate-spin" />
                            ) : (
                                <ChevronRight size={18} />
                            )}
                            Avanzar a {ETAPAS_CONFIG[ETAPAS_ORDEN[ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) + 1]]?.nombre}
                        </button>
                    )}
                </div>
            )}

            {/* Botón pausar para MTO/GTIA (sin botón avanzar) */}
            {proyecto.etapa_actual !== 'completado' && (proyecto.etapa_actual === 'instalacion' || timelineSimplificado) && onTogglePausa && (
                <div className="px-6 py-4 bg-white border-t border-gray-100">
                    <button
                        onClick={handleTogglePausa}
                        disabled={pauseLoading}
                        className={`w-full py-3 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isPaused
                            ? 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white'
                            : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                            }`}
                    >
                        {pauseLoading ? (
                            <RefreshCw size={18} className="animate-spin" />
                        ) : isPaused ? (
                            <>
                                <Play size={18} /> Reanudar Proyecto
                            </>
                        ) : (
                            <>
                                <Pause size={18} /> Pausar Proyecto
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
});

TimelineFooter.displayName = 'TimelineFooter';

export default TimelineFooter;
