import React, { memo, useState } from 'react';
import { CheckCircle2, RefreshCw, ChevronRight, ChevronLeft, Pause, Play, Snowflake } from 'lucide-react';
import { ETAPAS_CONFIG, ETAPAS_ORDEN, usaTimelineSimplificado } from './constants';

/**
 * Footer de la tarjeta de proyecto
 * Muestra: estado sub-etapas, mensaje completado, botón avanzar, botón pausar
 */
const TimelineFooter = memo(({ proyecto, onCompletar, onRegresar, onTogglePausa, onCompletarSubEtapa, onToggleEtapa, isPaused }) => {
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
                    {/* Lógica de botones de avance independiente */}
                    {!isPaused && !timelineSimplificado && onToggleEtapa && (
                        <div className="w-full flex flex-wrap gap-2 mt-2">
                            {[
                                { key: 'diseno', label: 'Diseño', done: !!proyecto.diseno_completado_en, color: 'indigo' },
                                { key: 'compras', label: 'Compras', done: !!proyecto.compras_completado_en, color: 'emerald' },
                                { key: 'manufactura', label: 'Manufactura', done: proyecto.estadoSubEtapas?.manufactura?.completado || proyecto.manufactura_completado, color: 'amber' },
                                { key: 'herreria', label: 'Herrería', done: proyecto.estadoSubEtapas?.herreria?.completado || proyecto.herreria_completado, color: 'red' },
                                { key: 'instalacion', label: 'Instalación', done: !!proyecto.instalacion_completado_en, color: 'blue' }
                            ].map((etapa) => (
                                <button
                                    key={etapa.key}
                                    onClick={async () => {
                                        if (loading) return;
                                        setLoading(true);
                                        try {
                                            await onToggleEtapa(proyecto.id, etapa.key, !etapa.done);
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                    disabled={loading}
                                    className={`flex-1 min-w-[100px] py-2 px-3 rounded-lg border text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm
                                        ${etapa.done
                                            ? `bg-${etapa.color}-100 border-${etapa.color}-200 text-${etapa.color}-700`
                                            : `bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700`
                                        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {etapa.done ? <CheckCircle2 size={16} /> : <div className={`w-4 h-4 rounded-full border-2 border-gray-300`} />}
                                    {etapa.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Botones de Regresar y Pausar/Reanudar */}
                    <div className="w-full flex gap-2 mt-2">
                        {puedeRegresar && (
                            <button
                                onClick={handleRegresar}
                                disabled={regresarLoading}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200 transition-all"
                            >
                                <ChevronLeft size={16} />
                                {regresarLoading ? 'Regresando...' : 'Regresar'}
                            </button>
                        )}
                        {onTogglePausa && (
                            <button
                                onClick={handleTogglePausa}
                                disabled={pauseLoading}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border ml-auto ${isPaused
                                        ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                                        : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                                    }`}
                            >
                                {isPaused ? <Play size={16} /> : <Pause size={16} />}
                                {pauseLoading ? '...' : isPaused ? 'Reanudar' : 'Pausar'}
                            </button>
                        )}
                    </div>
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
