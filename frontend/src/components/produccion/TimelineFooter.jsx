import React, { memo, useState } from 'react';
import { CheckCircle2, RefreshCw, ChevronRight, ChevronLeft, Pause, Play, Snowflake } from 'lucide-react';
import { ETAPAS_CONFIG, ETAPAS_ORDEN, usaTimelineSimplificado } from './constants';

/**
 * Footer de la tarjeta de proyecto
 * Muestra: estado sub-etapas, mensaje completado, botón avanzar, botón pausar
 */
const TimelineFooter = memo(({ proyecto, onCompletar, onRegresar, onTogglePausa, onCompletarSubEtapa, isPaused }) => {
    const [loading, setLoading] = useState(false);
    const [regresarLoading, setRegresarLoading] = useState(false);
    const [pauseLoading, setPauseLoading] = useState(false);
    const [subEtapaLoading, setSubEtapaLoading] = useState(null); // 'manufactura' | 'herreria' | null
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

    const handleCompletarSubEtapa = async (subEtapa) => {
        if (subEtapaLoading || !onCompletarSubEtapa) return;
        setSubEtapaLoading(subEtapa);
        try {
            await onCompletarSubEtapa(proyecto.id, subEtapa);
        } finally {
            setSubEtapaLoading(null);
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

    const handleRegresar = async () => {
        if (regresarLoading || !onRegresar) return;

        const confirmado = window.confirm(`¿Regresar "${proyecto.nombre}" a la etapa anterior?`);
        if (!confirmado) return;

        setRegresarLoading(true);
        try {
            await onRegresar(proyecto.id);
        } finally {
            setRegresarLoading(false);
        }
    };

    // Si no hay callbacks, no mostrar nada
    if (!onCompletar && !onTogglePausa && !onRegresar) return null;

    // Puede regresar si no está en diseño o pendiente
    const puedeRegresar = onRegresar && !isPaused && !['pendiente', 'diseno'].includes(proyecto.etapa_actual);

    // Lógica para Controles de Producción (Sub-etapas)
    const esEtapaProduccion = proyecto.etapa_actual === 'produccion' && !timelineSimplificado;
    const subEtapas = proyecto.estadoSubEtapas || { manufactura: { completado: false }, herreria: { completado: false }, ambosCompletados: false };
    const mostrarControlesSubEtapas = esEtapaProduccion && !subEtapas.ambosCompletados;

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

            {/* Mensaje: producción finalizada (Listo para avanzar) */}
            {!isPaused && subEtapas.ambosCompletados && proyecto.etapa_actual === 'produccion' && (
                <div className="px-6 py-3 bg-green-50 border-t border-green-100 text-center">
                    <span className="text-base text-green-700 font-bold flex items-center justify-center gap-2">
                        <CheckCircle2 size={16} /> Producción Finalizada - Listo para enviar a Instalación
                    </span>
                </div>
            )}

            {/* Footer: proyecto completado */}
            {proyecto.etapa_actual === 'completado' && (
                <div className="px-6 py-4 bg-white border-t border-gray-100 flex gap-3">
                    {puedeRegresar && (
                        <button
                            onClick={handleRegresar}
                            disabled={regresarLoading}
                            className="py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gray-100 hover:bg-gray-200 text-gray-700"
                            title="Regresar a Instalación"
                        >
                            {regresarLoading ? (
                                <RefreshCw size={18} className="animate-spin" />
                            ) : (
                                <ChevronLeft size={18} />
                            )}
                        </button>
                    )}
                    <div className="flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg">
                        <CheckCircle2 size={20} />
                        <span>Proyecto Completado</span>
                    </div>
                </div>
            )}

            {/* Controles Principales (Avanzar / Sub-etapas / Pausar) */}
            {proyecto.etapa_actual !== 'completado' && (
                <div className="px-6 py-4 bg-white border-t border-gray-100 flex gap-3 flex-wrap">
                    {/* Botón regresar etapa */}
                    {puedeRegresar && (
                        <button
                            onClick={handleRegresar}
                            disabled={regresarLoading}
                            className="py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gray-100 hover:bg-gray-200 text-gray-700"
                            title={`Regresar a ${ETAPAS_CONFIG[ETAPAS_ORDEN[ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) - 1]]?.nombre}`}
                        >
                            {regresarLoading ? (
                                <RefreshCw size={18} className="animate-spin" />
                            ) : (
                                <ChevronLeft size={18} />
                            )}
                        </button>
                    )}

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

                    {/* Lógica de botones de avance */}
                    {!isPaused && (
                        <>
                            {/* Caso Producción con sub-etapas pendientes: Mostrar botones divididos */}
                            {mostrarControlesSubEtapas ? (
                                <div className="flex-1 flex gap-2">
                                    {/* Botón Manufactura */}
                                    <button
                                        onClick={() => handleCompletarSubEtapa('manufactura')}
                                        disabled={subEtapas.manufactura.completado || subEtapaLoading === 'manufactura'}
                                        className={`flex-1 py-3 px-2 rounded-xl font-bold flex items-center justify-center gap-1 shadow transition-all text-xs sm:text-sm ${subEtapas.manufactura.completado
                                            ? 'bg-green-100 text-green-700 cursor-default'
                                            : 'bg-amber-100 hover:bg-amber-200 text-amber-800'
                                            }`}
                                    >
                                        {subEtapaLoading === 'manufactura' ? (
                                            <RefreshCw size={16} className="animate-spin" />
                                        ) : subEtapas.manufactura.completado ? (
                                            <CheckCircle2 size={16} />
                                        ) : null}
                                        {subEtapas.manufactura.completado ? 'Manufactura OK' : 'Terminar Manufactura'}
                                    </button>

                                    {/* Botón Herrería */}
                                    <button
                                        onClick={() => handleCompletarSubEtapa('herreria')}
                                        disabled={subEtapas.herreria.completado || subEtapaLoading === 'herreria'}
                                        className={`flex-1 py-3 px-2 rounded-xl font-bold flex items-center justify-center gap-1 shadow transition-all text-xs sm:text-sm ${subEtapas.herreria.completado
                                            ? 'bg-green-100 text-green-700 cursor-default'
                                            : 'bg-red-100 hover:bg-red-200 text-red-800'
                                            }`}
                                    >
                                        {subEtapaLoading === 'herreria' ? (
                                            <RefreshCw size={16} className="animate-spin" />
                                        ) : subEtapas.herreria.completado ? (
                                            <CheckCircle2 size={16} />
                                        ) : null}
                                        {subEtapas.herreria.completado ? 'Herrería OK' : 'Terminar Herrería'}
                                    </button>
                                </div>
                            ) : (
                                /* Caso estándar: Botón único de Avanzar Etapa */
                                /* Se muestra si NO es Producción, O si es Producción y ya se completaron ambas sub-etapas (o es simplificado) */
                                onCompletar && proyecto.etapa_actual !== 'instalacion' && (
                                    <button
                                        onClick={handleCompletar}
                                        disabled={loading || (esEtapaProduccion && !subEtapas.ambosCompletados)}
                                        className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? (
                                            <RefreshCw size={18} className="animate-spin" />
                                        ) : (
                                            <ChevronRight size={18} />
                                        )}
                                        Avanzar a {ETAPAS_CONFIG[ETAPAS_ORDEN[ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) + 1]]?.nombre}
                                    </button>
                                )
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Botón reanudar para MTO/GTIA en estados finales (sin avanzar) */}
            {/* Solo se muestra si no entró en el bloque anterior (que excluye 'completado' y 'instalacion' para avanzar) */}
            {/* Pero ojo, el bloque anterior excluye 'instalacion' del botón de avance, pero MUESTRA el contenedor. */}
            {/* Si es instalacion, entra al bloque anterior pero NO renderiza el botón de avanzar. Renderiza solo Regresar y Pausar. */}
            {/* Revisando lógica original: */}
            {/* El bloque original renderizaba botones SOLO si etapa !== 'completado' && !== 'instalacion' && !simplificado */}
            {/* Ahora lo hemos unificado. Solo necesitamos asegurar que Instalación tenga sus botones. */}

            {/* Ajuste: Si estamos en Instalación (o simplificado), no hay "Avanzar". Solo Pausar/Regresar. */}
            {/* El bloque anterior ya cubre Pausar y Regresar. Lo que falta es que si estamos en Instalación, NO entre al bloque "Lógica de botones de avance" si no hay avanzar. */}
        </div>
    );
});

TimelineFooter.displayName = 'TimelineFooter';

export default TimelineFooter;
