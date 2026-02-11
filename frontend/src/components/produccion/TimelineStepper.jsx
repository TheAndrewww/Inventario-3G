import React, { memo, useMemo } from 'react';
import { s, px, addBusinessDays, formatDateShort } from '../../utils/produccion';
import {
    Package,
    ShoppingCart,
    Factory,
    Scissors,
    Wrench,
    Truck,
    CheckCircle2,
    Calendar
} from 'lucide-react';

import { ETAPAS_CONFIG, ETAPAS_ORDEN, TIEMPOS_POR_TIPO, usaTimelineSimplificado } from './constants';

/**
 * Calcula los días restantes para cada etapa individual de un proyecto.
 * Retorna un objeto { diseno: N, compras: N, produccion: N, instalacion: N }
 * donde N es positivo (a tiempo), 0 (hoy), o negativo (retraso).
 * Retorna null si el proyecto no tiene reglas de tiempo (MTO/GTIA/sin tipo).
 */
const calcularDiasPorEtapa = (proyecto) => {
    const tipo = proyecto.tipo_proyecto?.toUpperCase();
    if (!tipo || !TIEMPOS_POR_TIPO[tipo]) return null;
    if (!proyecto.estadoRetraso || proyecto.estadoRetraso.tiempoPermitido === null) return null;

    const diasEnProyecto = proyecto.estadoRetraso.diasEnProyecto;
    const tiempos = TIEMPOS_POR_TIPO[tipo];
    const etapaActualIdx = ETAPAS_ORDEN.indexOf(proyecto.etapa_actual);

    const resultado = {};
    for (const etapa of ['diseno', 'compras', 'produccion', 'instalacion']) {
        const etapaIdx = ETAPAS_ORDEN.indexOf(etapa);
        if (etapaIdx < etapaActualIdx) {
            // Etapa ya completada — no mostrar
            resultado[etapa] = null;
        } else {
            // Días restantes = tiempo acumulado permitido - días transcurridos
            resultado[etapa] = tiempos[etapa] - diasEnProyecto;
        }
    }
    return resultado;
};

/**
 * Stepper visual SVG con líneas y nodos
 */
const TimelineStepper = memo(({ proyecto }) => {
    const diasRestantes = proyecto.diasRestantes;
    const esGarantia = proyecto.tipo_proyecto?.toUpperCase() === 'GTIA';
    const esMTO = proyecto.tipo_proyecto?.toUpperCase() === 'MTO';
    const timelineSimplificado = usaTimelineSimplificado(proyecto);
    const tieneProduccion = proyecto.tiene_manufactura || proyecto.tiene_herreria;

    const estadoRetraso = proyecto.estadoRetraso || { enRetraso: false };
    let enRetraso = estadoRetraso.enRetraso;

    // Lógica especial Instalación: "Ya es como si hubiera terminado"
    // No mostrar timeline rojo (enRetraso) a menos que falten <= 2 días para la fecha límite global
    if (proyecto.etapa_actual === 'instalacion') {
        // Solo si la fecha global está muy próxima (< 2 días) podríamos considerar alerta visual,
        // pero el usuario pidió explícitamente "que deje de marcarse en rojo".
        // Asumiremos que quiere verlo verde/normal siempre que esté en instalación.
        enRetraso = false;
    }

    // Memoizar cálculos de líneas SVG
    const lineasSVG = useMemo(() => {
        // Posiciones ajustadas para dejar espacio al cuadro de fecha límite
        // Rango: 8% a 75% (antes era 10% a 90%)
        if (timelineSimplificado) {
            const stroke = proyecto.etapa_actual === 'completado' ? '#10B981' : '#CBD5E1';
            return <line x1="8" y1="40" x2="75" y2="40" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />;
        }

        // Posiciones para 5 nodos: 8, 25, 42, 58, 75
        const POS = { P1: 8, P2: 25, P3: 42, P4: 58, P5: 75 };
        const getStrokeColor = (baseStage) =>
            ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > ETAPAS_ORDEN.indexOf(baseStage) ? '#10B981' : '#CBD5E1';

        const tieneManufacturaLocal = proyecto.tiene_manufactura !== false;
        const tieneHerreriaLocal = proyecto.tiene_herreria !== false;
        const tieneAmbas = tieneManufacturaLocal && tieneHerreriaLocal;

        const getSubStageStroke = (subStage) => {
            if (ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 3) return '#10B981';
            if (proyecto.etapa_actual === 'produccion') {
                return proyecto.estadoSubEtapas?.[subStage]?.completado ? '#10B981' : '#CBD5E1';
            }
            return '#CBD5E1';
        };

        // Sin producción: 4 nodos redistribuidos (8, 30, 52, 75)
        if (!tieneProduccion) {
            return (
                <>
                    <line x1="8" y1="40" x2="30" y2="40" stroke={getStrokeColor('diseno')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    <line x1="30" y1="40" x2="52" y2="40" stroke={getStrokeColor('compras')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    <line x1="52" y1="40" x2="75" y2="40" stroke={getStrokeColor('instalacion')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                </>
            );
        }

        // Con producción: bifurcación manufactura/herrería
        const splitStart = POS.P2;
        const splitEnd = POS.P3;
        const splitMid = (splitStart + splitEnd) / 2;

        return (
            <>
                <line x1={POS.P1} y1="40" x2={POS.P2} y2="40" stroke={getStrokeColor('diseno')} strokeWidth="2" vectorEffect="non-scaling-stroke" />

                {tieneAmbas && (
                    <>
                        <path d={`M ${splitStart} 40 L ${splitMid} 40 L ${splitMid} 20 L ${splitEnd} 20`} fill="none" stroke={getStrokeColor('compras')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                        <path d={`M ${splitEnd} 20 L ${POS.P4 - 5} 20 L ${POS.P4 - 5} 40 L ${POS.P4} 40`} fill="none" stroke={getSubStageStroke('manufactura')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                        <path d={`M ${splitStart} 40 L ${splitMid} 40 L ${splitMid} 60 L ${splitEnd} 60`} fill="none" stroke={getStrokeColor('compras')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                        <path d={`M ${splitEnd} 60 L ${POS.P4 - 5} 60 L ${POS.P4 - 5} 40 L ${POS.P4} 40`} fill="none" stroke={getSubStageStroke('herreria')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    </>
                )}

                {tieneManufacturaLocal && !tieneHerreriaLocal && (
                    <>
                        <line x1={POS.P2} y1="40" x2={POS.P3} y2="40" stroke={getStrokeColor('compras')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                        <line x1={POS.P3} y1="40" x2={POS.P4} y2="40" stroke={getSubStageStroke('manufactura')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    </>
                )}

                {!tieneManufacturaLocal && tieneHerreriaLocal && (
                    <>
                        <line x1={POS.P2} y1="40" x2={POS.P3} y2="40" stroke={getStrokeColor('compras')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                        <line x1={POS.P3} y1="40" x2={POS.P4} y2="40" stroke={getSubStageStroke('herreria')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    </>
                )}

                <line x1={POS.P4} y1="40" x2={POS.P5} y2="40" stroke={getStrokeColor('instalacion')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </>
        );
    }, [proyecto.etapa_actual, proyecto.tiene_manufactura, proyecto.tiene_herreria, proyecto.estadoSubEtapas, timelineSimplificado, tieneProduccion]);

    // Memoizar nodos
    const nodos = useMemo(() => {
        const getNodeColor = (node) => {
            const etapaIndex = ETAPAS_ORDEN.indexOf(proyecto.etapa_actual);

            // Si hay retraso, TODAS las etapas actuales y pasadas se ponen en rojo
            if (enRetraso) {
                // Si la etapa es pasada o actual
                if (etapaIndex >= node.idx) {
                    return 'bg-red-500 text-white';
                }
            }

            // Si es una etapa futura (y no es sub-etapa), asegurar que esté apagada
            // Esto corrige el caso de regresar etapa: si estamos en Diseño, Compras debe estar gris aunque tenga flags
            if (!node.isSubStage && etapaIndex < node.idx) {
                return 'bg-white border-2 border-gray-200 text-gray-400';
            }

            if (node.isSubStage) {
                if (etapaIndex > 3) return 'bg-green-500 text-white';
                if (proyecto.etapa_actual === 'produccion') {
                    return proyecto.estadoSubEtapas?.[node.stage]?.completado ? 'bg-green-500 text-white' : 'bg-amber-500 text-white';
                }
                return 'bg-white border-2 border-gray-200 text-gray-400';
            }

            // Lógica especial para Compras: mostrar naranja si está en proceso
            if (node.stage === 'compras') {
                if (proyecto.compras_completado_en) return 'bg-green-500 text-white'; // Completado
                if (proyecto.compras_en_proceso) return 'bg-amber-500 text-white'; // En proceso (naranja)
                // Si no está en proceso ni completado, usar lógica estándar
            }

            if (node.stage === 'completado' && proyecto.etapa_actual === 'completado') return 'bg-green-500 text-white';
            if (proyecto.etapa_actual === node.stage) {
                if (esMTO && diasRestantes !== null && diasRestantes < 0) return 'bg-red-500 text-white';
                return 'bg-green-500 text-white'; // Si no hay retraso (ya validado arriba), es verde
            }
            if (etapaIndex > node.idx) return 'bg-green-500 text-white';
            return 'bg-white border-2 border-gray-200 text-gray-400';
        };

        const getNodeColorSimple = (stage) => {
            const proyectoCompletado = proyecto.etapa_actual === 'completado';
            if (stage === 'completado') return proyectoCompletado ? 'bg-green-500 text-white' : 'bg-white border-2 border-gray-200 text-gray-400';
            if (stage === 'instalacion') {
                if (proyectoCompletado) return 'bg-green-500 text-white';
                if (esGarantia) return 'bg-red-500 text-white';
                if (esMTO && diasRestantes !== null && diasRestantes < 0) return 'bg-red-500 text-white';
                return 'bg-green-500 text-white';
            }
            return 'bg-white border-2 border-gray-200 text-gray-400';
        };

        // Timeline simplificado (posiciones ajustadas: 8% y 75%)
        if (timelineSimplificado) {
            const nodes = [
                { stage: 'instalacion', icon: Truck, label: 'Instalación', pos: '8%' },
                { stage: 'completado', icon: CheckCircle2, label: 'Fin', pos: '75%' }
            ];

            return nodes.map((node) => (
                <div key={node.stage} className="absolute top-[40%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: node.pos }}>
                    <div className={`rounded-full flex items-center justify-center shadow-md ${getNodeColorSimple(node.stage)}`} style={{ width: px(56), height: px(56) }}>
                        <node.icon style={{ width: px(28), height: px(28) }} />
                    </div>
                    <span className="absolute font-bold text-gray-600 bg-gray-50 px-1" style={{ top: px(64), fontSize: s(1.5) }}>{node.label}</span>
                </div>
            ));
        }

        // Timeline normal
        const tieneManufacturaLocal = proyecto.tiene_manufactura !== false;
        const tieneHerreriaLocal = proyecto.tiene_herreria !== false;

        let nodes = [];

        if (tieneProduccion) {
            // Posiciones para 5 nodos: 8%, 25%, 42%, 58%, 75%
            const POS5 = { P1: '8%', P2: '25%', P3: '42%', P4: '58%', P5: '75%' };

            nodes = [
                { stage: 'diseno', icon: Package, label: 'Diseño', pos: POS5.P1, idx: 1, topPercent: '40%' },
                { stage: 'compras', icon: ShoppingCart, label: 'Compras', pos: POS5.P2, idx: 2, topPercent: '40%' },
            ];

            if (tieneManufacturaLocal) {
                nodes.push({
                    stage: 'manufactura', icon: Scissors, label: 'Mfra.', pos: POS5.P3, idx: 3,
                    topPercent: tieneHerreriaLocal ? '15%' : '40%',
                    isSubStage: true,
                    labelPosition: tieneHerreriaLocal ? 'top' : 'bottom'
                });
            }
            if (tieneHerreriaLocal) {
                nodes.push({
                    stage: 'herreria', icon: Wrench, label: 'Herr.', pos: POS5.P3, idx: 3,
                    topPercent: tieneManufacturaLocal ? '65%' : '40%',
                    isSubStage: true,
                    labelPosition: 'bottom'
                });
            }

            nodes.push(
                { stage: 'instalacion', icon: Truck, label: 'Inst.', pos: POS5.P4, idx: 4, topPercent: '40%' },
                { stage: 'completado', icon: CheckCircle2, label: 'Fin', pos: POS5.P5, idx: 5, topPercent: '40%' }
            );
        } else {
            // Posiciones para 4 nodos: 8%, 30%, 52%, 75%
            const POS4 = { P1: '8%', P2: '30%', P3: '52%', P4: '75%' };
            nodes = [
                { stage: 'diseno', icon: Package, label: 'Diseño', pos: POS4.P1, idx: 1, topPercent: '40%' },
                { stage: 'compras', icon: ShoppingCart, label: 'Compras', pos: POS4.P2, idx: 2, topPercent: '40%' },
                { stage: 'instalacion', icon: Truck, label: 'Inst.', pos: POS4.P3, idx: 4, topPercent: '40%' },
                { stage: 'completado', icon: CheckCircle2, label: 'Fin', pos: POS4.P4, idx: 5, topPercent: '40%' }
            ];
        }

        // Calcular días restantes por etapa
        const diasPorEtapa = calcularDiasPorEtapa(proyecto);
        let subStageCountdownShown = false;

        return nodes.map((node) => {
            // Para sub-etapas (manufactura/herreria), mostrar el tiempo de "produccion"
            // Solo en la primera sub-etapa para no duplicar
            let diasEtapa = null;
            let stageForDate = node.stage;

            if (node.stage === 'completado') {
                // No mostrar en "Fin"
            } else if (node.isSubStage) {
                if (!subStageCountdownShown) {
                    diasEtapa = diasPorEtapa?.['produccion'] ?? null;
                    stageForDate = 'produccion';
                    if (diasEtapa !== null) subStageCountdownShown = true;
                }
            } else {
                diasEtapa = diasPorEtapa?.[node.stage] ?? null;
            }
            const mostrarDias = diasEtapa !== null;

            let diasLabel = '';
            let diasColor = '';

            if (mostrarDias) {
                // Calcular fecha límite de esta etapa
                // Fecha Límite = Fecha Entrada + (Días Acumulados + 1) Días Hábiles
                const tipo = proyecto.tipo_proyecto?.toUpperCase();
                const tiempos = TIEMPOS_POR_TIPO[tipo];
                // Para sub-etapas, usamos el tiempo de 'produccion'
                const tiempoLimite = tiempos?.[stageForDate];

                let fechaLimiteFormatted = '';
                if (tiempoLimite !== undefined && proyecto.fecha_entrada) {
                    // +1 porque la lógica de retraso resta 1 día al inicio
                    const fechaLimiteDate = addBusinessDays(proyecto.fecha_entrada, tiempoLimite + 1);
                    fechaLimiteFormatted = formatDateShort(fechaLimiteDate);
                }

                if (stageForDate === 'instalacion' && proyecto.etapa_actual === 'instalacion') {
                    // Lógica especial Instalación: No marcar "atraso" en rojo.
                    // "ya es como si hubiera terminado" -> Mostrar verde/ámbar siempre.
                    diasLabel = fechaLimiteFormatted || 'Finalizando';
                    diasColor = 'bg-green-50 text-green-700 border-green-200';
                } else if (diasEtapa < 0) {
                    diasLabel = `${Math.abs(diasEtapa)}d atraso`;
                    diasColor = 'bg-red-100 text-red-700 border-red-200';
                } else if (diasEtapa === 0) {
                    diasLabel = 'Hoy';
                    diasColor = 'bg-amber-100 text-amber-700 border-amber-200';
                } else if (diasEtapa <= 1) {
                    diasLabel = fechaLimiteFormatted || `${diasEtapa}d`;
                    diasColor = 'bg-amber-100 text-amber-700 border-amber-200';
                } else {
                    diasLabel = fechaLimiteFormatted || `${diasEtapa}d`;
                    diasColor = 'bg-green-50 text-green-700 border-green-200';
                }
            }

            return (
                <div
                    key={node.stage}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
                    style={{ left: node.pos, top: node.topPercent || '40%' }}
                >
                    <div
                        className={`rounded-full flex items-center justify-center shadow-md ${getNodeColor(node)}`}
                        style={{ width: node.isSubStage ? px(44) : px(56), height: node.isSubStage ? px(44) : px(56) }}
                    >
                        <node.icon style={{ width: node.isSubStage ? px(22) : px(28), height: node.isSubStage ? px(22) : px(28) }} />
                    </div>
                    {node.labelPosition === 'top' && (
                        <span
                            className="absolute font-bold text-gray-600 bg-gray-50 px-1"
                            style={{ bottom: node.isSubStage ? px(50) : px(64), fontSize: node.isSubStage ? s(1.1) : s(1.5) }}
                        >
                            {node.label}
                        </span>
                    )}
                    {node.labelPosition !== 'top' && (
                        <span
                            className="absolute font-bold text-gray-600 bg-gray-50 px-1"
                            style={{ top: node.isSubStage ? px(50) : px(64), fontSize: node.isSubStage ? s(1.1) : s(1.5) }}
                        >
                            {node.label}
                        </span>
                    )}
                    {mostrarDias && (
                        <span
                            className={`absolute font-bold rounded-full border whitespace-nowrap ${diasColor}`}
                            style={{ top: node.labelPosition === 'top' ? px(50) : px(-20), fontSize: s(0.85), padding: `${px(1)} ${px(6)}` }}
                        >
                            {diasLabel}
                        </span>
                    )}
                </div>
            );
        });
    }, [proyecto.etapa_actual, proyecto.tiene_manufactura, proyecto.tiene_herreria, proyecto.estadoSubEtapas, proyecto.estadoRetraso, proyecto.tipo_proyecto, diasRestantes, esMTO, esGarantia, enRetraso, timelineSimplificado, tieneProduccion]);

    return (
        <div className="bg-gray-50 relative overflow-visible" style={{ height: px(160), padding: px(12) }}>
            {/* Cuadro de fecha límite */}
            {proyecto.fecha_limite && (
                <div
                    className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center origin-right rounded-xl shadow-md ${diasRestantes !== null && (diasRestantes < 0 && proyecto.etapa_actual !== 'instalacion')
                        ? 'bg-red-100 text-red-700 border border-red-200'
                        : diasRestantes !== null && (diasRestantes <= 2 && proyecto.etapa_actual === 'instalacion') // Rojo si <= 2 días (incluye negativos)
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : diasRestantes !== null && diasRestantes <= 3
                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : 'bg-white text-gray-700 border border-gray-200'
                        }`}
                    style={{ padding: `${px(12)} ${px(16)}`, gap: px(2) }}
                >
                    <span className="text-gray-500 uppercase tracking-wide" style={{ fontSize: s(0.65) }}>Límite</span>
                    <Calendar style={{ width: s(1.25), height: s(1.25), marginBottom: px(4) }} />
                    <span className="font-bold" style={{ fontSize: s(1.5) }}>
                        {new Date(proyecto.fecha_limite + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    </span>
                    <span
                        className={`font-semibold ${diasRestantes !== null && (diasRestantes < 0 && proyecto.etapa_actual !== 'instalacion')
                                ? 'text-red-600'
                                : diasRestantes !== null && (diasRestantes <= 2 && proyecto.etapa_actual === 'instalacion')
                                    ? 'text-red-600'
                                    : diasRestantes !== null && diasRestantes <= 3
                                        ? 'text-amber-600'
                                        : 'text-gray-500'
                            }`}
                        style={{ fontSize: s(1.125) }}
                    >
                        {
                            diasRestantes !== null && diasRestantes < 0
                                ? 'Venc'
                                : diasRestantes !== null && (diasRestantes <= 2 && proyecto.etapa_actual === 'instalacion')
                                    ? 'Urgente'
                                    : diasRestantes === 0
                                        ? 'Hoy'
                                        : `${diasRestantes}d`
                        }
                    </span>
                </div>
            )}

            {/* Líneas SVG */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                {lineasSVG}
            </svg>

            {/* Nodos */}
            {nodos}
        </div>
    );
});

TimelineStepper.displayName = 'TimelineStepper';

export default TimelineStepper;
