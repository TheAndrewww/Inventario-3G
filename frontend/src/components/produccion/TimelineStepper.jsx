import React, { memo, useMemo } from 'react';
import { s, px, addBusinessDays, formatDateShort, calcularDiasHabiles, getHoyStr } from '../../utils/produccion';
import {
    Factory,
    Scissors,
    Wrench,
    Calendar
} from 'lucide-react';

import { ETAPAS_CONFIG, ETAPAS_ORDEN, TIEMPOS_POR_TIPO, DIAS_INDIVIDUALES_POR_TIPO, usaTimelineSimplificado } from './constants';

/**
 * Calcula los días restantes y fechas límite para cada etapa de un proyecto.
 * Retorna un objeto { diseno: { dias, fechaLimite }, compras: {...}, produccion: {...}, instalacion: {...} }
 * donde dias es positivo (a tiempo), 0 (hoy), o negativo (retraso).
 *
 * REGLA DE RECÁLCULO:
 *   - Si el proyecto no tiene margen suficiente (tiempo total disponible < días necesarios),
 *     se calculan las fechas HACIA ATRÁS desde fecha_limite (Caso 2).
 *     Esto simula: "para cumplir el deadline, cada etapa debería haber terminado en X fecha".
 *     Resultado: días negativos = atraso respecto a cuándo debería haber terminado.
 *
 *   - Si Diseño se atrasó pero SÍ hay margen, se recalculan las etapas restantes
 *     HACIA ADELANTE desde diseno_completado_en (Caso 1).
 *
 *   - Si todo está a tiempo, se usa el cálculo original desde fecha_entrada.
 *
 * Retorna null si el proyecto no tiene reglas de tiempo (MTO/GTIA/sin tipo).
 */
const calcularDiasPorEtapa = (proyecto) => {
    const tipo = proyecto.tipo_proyecto?.toUpperCase();
    if (!tipo || !TIEMPOS_POR_TIPO[tipo]) return null;
    if (!proyecto.estadoRetraso || proyecto.estadoRetraso.tiempoPermitido === null) return null;

    const tiemposAcum = TIEMPOS_POR_TIPO[tipo];
    const diasIndiv = DIAS_INDIVIDUALES_POR_TIPO[tipo];
    const hoy = getHoyStr();
    const fechaEntrada = proyecto.fecha_entrada; // 'YYYY-MM-DD'
    const fechaLimite = proyecto.fecha_limite;     // 'YYYY-MM-DD'
    const disenoCompletadoEn = proyecto.diseno_completado_en
        ? proyecto.diseno_completado_en.substring(0, 10)
        : null;

    // Helper: convertir Date UTC a string 'YYYY-MM-DD'
    const dateToStr = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    // --- Calcular fechas originales (hacia adelante desde fecha_entrada) ---
    const fechasOriginales = {};
    for (const etapa of ['diseno', 'compras', 'produccion', 'instalacion']) {
        fechasOriginales[etapa] = addBusinessDays(fechaEntrada, tiemposAcum[etapa]);
    }

    // --- CASO 2: Verificar si hay margen suficiente desde hoy hasta fecha_limite ---
    // Si NO hay margen, calcular TODAS las etapas hacia atrás desde fecha_limite
    if (fechaLimite) {
        const totalDiasNecesarios = tiemposAcum.instalacion; // Total acumulado = días totales del proyecto
        const diasDesdeEntradaALimite = calcularDiasHabiles(fechaEntrada, fechaLimite);

        if (diasDesdeEntradaALimite < totalDiasNecesarios) {
            // No hay tiempo suficiente → calcular hacia atrás desde fecha_limite
            const resultado = {};
            const etapas = ['diseno', 'compras', 'produccion', 'instalacion'];

            for (let i = 0; i < etapas.length; i++) {
                const etapa = etapas[i];
                // Días de etapas POSTERIORES (todo lo que viene después de esta etapa)
                let diasPosteriores = 0;
                for (let j = i + 1; j < etapas.length; j++) {
                    diasPosteriores += diasIndiv[etapas[j]];
                }
                // Esta etapa debe terminar: fecha_limite - diasPosteriores
                const fechaDebeTerminar = restarDiasHabiles(fechaLimite, diasPosteriores);
                // Días restantes = días hábiles desde hoy hasta esa fecha
                const diasRestantes = calcularDiasHabiles(hoy, dateToStr(fechaDebeTerminar));
                resultado[etapa] = {
                    dias: diasRestantes,
                    fechaLimite: fechaDebeTerminar
                };
            }
            return resultado;
        }
    }

    // --- Verificar si Diseño se atrasó ---
    const fechaLimiteDisenoStr = dateToStr(fechasOriginales.diseno);
    let disenoSeAtraso = false;
    if (disenoCompletadoEn && fechaLimiteDisenoStr) {
        disenoSeAtraso = calcularDiasHabiles(fechaLimiteDisenoStr, disenoCompletadoEn) > 0;
    }

    // --- CASO 1: Diseño se atrasó pero hay margen → recalcular hacia adelante ---
    if (disenoSeAtraso && fechaLimite) {
        const diasNecesariosRestantes = diasIndiv.compras + diasIndiv.produccion + diasIndiv.instalacion;
        const margenDisponible = calcularDiasHabiles(disenoCompletadoEn, fechaLimite);

        if (margenDisponible >= diasNecesariosRestantes) {
            const resultado = {};
            // Diseño: mostrar atraso con fecha original
            const diasDesdeEntradaAHoy = calcularDiasHabiles(fechaEntrada, hoy) - 1;
            resultado.diseno = {
                dias: tiemposAcum.diseno - Math.max(0, diasDesdeEntradaAHoy),
                fechaLimite: fechasOriginales.diseno
            };

            // Etapas restantes: hacia adelante desde diseno_completado_en
            let acumulado = 0;
            for (const etapa of ['compras', 'produccion', 'instalacion']) {
                acumulado += diasIndiv[etapa];
                const nuevaFechaLimite = addBusinessDays(disenoCompletadoEn, acumulado);
                const diasRestantes = calcularDiasHabiles(hoy, dateToStr(nuevaFechaLimite));
                resultado[etapa] = {
                    dias: diasRestantes,
                    fechaLimite: nuevaFechaLimite
                };
            }
            return resultado;
        }
    }

    // --- Caso base: todo a tiempo, usar cálculo original ---
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

/**
 * Resta días hábiles (Lun-Sab) a una fecha.
 * Retorna un Date UTC.
 */
const restarDiasHabiles = (dateStr, daysToSubtract) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    let current = new Date(Date.UTC(year, month - 1, day));
    let removed = 0;
    while (removed < daysToSubtract) {
        current.setUTCDate(current.getUTCDate() - 1);
        if (current.getUTCDay() !== 0) removed++;
    }
    return current;
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
        // Posiciones para 5 nodos: 8, 25, 42, 58, 75
        const POS = { P1: 8, P2: 25, P3: 42, P4: 58, P5: 75 };
        const getStrokeColor = (baseStage) => {
            // Logic for main lines: Check if the DESTINATION stage is reached or completed?
            // Standard: Connect A to B if A is done.
            // Mapping baseStage -> targetStage
            // diseno -> compras
            // compras -> produccion (split)
            // ...

            // Simplification: Check exact flag of the "From" stage
            // If Diseno is done, line to Compras is green.
            if (baseStage === 'diseno' && proyecto.diseno_completado_en) return '#10B981';
            if (baseStage === 'compras' && proyecto.compras_completado_en) return '#10B981';
            if (baseStage === 'instalacion' && proyecto.instalacion_completado_en) return '#10B981';

            // Fallback to sequential index if flags missing (legacy safety)
            return ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > ETAPAS_ORDEN.indexOf(baseStage) ? '#10B981' : '#CBD5E1';
        };

        const tieneManufacturaLocal = proyecto.tiene_manufactura !== false;
        const tieneHerreriaLocal = proyecto.tiene_herreria !== false;
        const tieneAmbas = tieneManufacturaLocal && tieneHerreriaLocal;

        const getSubStageStroke = (subStage) => {
            // Independent check for sub-stages
            const isSubStageDone = proyecto.estadoSubEtapas?.[subStage]?.completado ||
                (subStage === 'manufactura' ? proyecto.manufactura_completado : proyecto.herreria_completado);

            if (isSubStageDone) return '#10B981';

            // Fallback: if actual stage is beyond production
            if (ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 3) return '#10B981';

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
    }, [proyecto.etapa_actual, proyecto.tiene_manufactura, proyecto.tiene_herreria, proyecto.estadoSubEtapas, timelineSimplificado, tieneProduccion, proyecto.diseno_completado_en, proyecto.compras_completado_en, proyecto.manufactura_completado, proyecto.herreria_completado, proyecto.instalacion_completado_en]); // Added dependencies

    // Memoizar nodos
    const nodos = useMemo(() => {
        const getNodeColor = (node) => {
            // Check if this specific node/stage is completed
            let isCompleted = false;
            if (node.stage === 'diseno' && proyecto.diseno_completado_en) isCompleted = true;
            if (node.stage === 'compras' && proyecto.compras_completado_en) isCompleted = true;
            if (node.stage === 'manufactura' && (proyecto.estadoSubEtapas?.manufactura?.completado || proyecto.manufactura_completado)) isCompleted = true;
            if (node.stage === 'herreria' && (proyecto.estadoSubEtapas?.herreria?.completado || proyecto.herreria_completado)) isCompleted = true;
            if (node.stage === 'instalacion' && proyecto.instalacion_completado_en) isCompleted = true;
            if (node.stage === 'completado' && proyecto.etapa_actual === 'completado') isCompleted = true;

            // Check if this node is in the "active zone" (current working stage)
            const isInActiveZone = (
                (proyecto.etapa_actual === 'produccion' && (node.stage === 'manufactura' || node.stage === 'herreria')) ||
                (proyecto.etapa_actual === node.stage)
            );

            // 1. Completed AND in active zone -> NARANJA (etapa completada pero proyecto sigue aquí)
            if (isCompleted && isInActiveZone) {
                return 'bg-orange-500 text-white';
            }

            // 2. Completed but NOT in active zone -> Verde (etapa pasada y completada)
            if (isCompleted) {
                return 'bg-green-500 text-white';
            }

            // 3. Active Stage but NOT completed yet
            if (isInActiveZone) {
                // Check for delay (Red)
                if (enRetraso) return 'bg-red-500 text-white';
                // Check for warning (Amber) - Compras in process
                if (node.stage === 'compras' && proyecto.compras_en_proceso) return 'bg-amber-500 text-white';
                // Special MTO delay
                if (esMTO && diasRestantes !== null && diasRestantes < 0) return 'bg-red-500 text-white';

                // Preparado (instalacion) sin completar -> Naranja (listo para marcar)
                if (node.stage === 'instalacion' && !proyecto.instalacion_completado_en) {
                    return 'bg-orange-500 text-white';
                }

                // Sub-etapas de producción (manufactura/herrería) en proceso -> Amber
                if (node.stage === 'manufactura' || node.stage === 'herreria') {
                    return 'bg-amber-500 text-white';
                }

                // Default Active (verde - está trabajando en esta etapa)
                return 'bg-green-500 text-white';
            }

            // 4. Future Stages or not relevant -> Gray
            return 'bg-white border-2 border-gray-200 text-gray-400';
        };

        const getNodeColorSimple = (stage) => {
            const proyectoCompletado = proyecto.etapa_actual === 'completado';
            if (stage === 'completado') return proyectoCompletado ? 'bg-green-500 text-white' : 'bg-white border-2 border-gray-200 text-gray-400';
            if (stage === 'instalacion') {
                if (proyectoCompletado) return 'bg-green-500 text-white';
                if (esGarantia) return 'bg-red-500 text-white';
                if (esMTO && diasRestantes !== null && diasRestantes < 0) return 'bg-red-500 text-white';
                // Independent check for installation if simplificado is used?
                if (proyecto.instalacion_completado_en) return 'bg-green-500 text-white';

                return 'bg-green-500 text-white';
            }
            return 'bg-white border-2 border-gray-200 text-gray-400';
        };

        // Timeline simplificado (posiciones ajustadas: 8% y 75%)
        if (timelineSimplificado) {
            const nodes = [
                { stage: 'instalacion', icon: ETAPAS_CONFIG.instalacion.icon, label: 'Completado', pos: '8%' },
                { stage: 'completado', icon: ETAPAS_CONFIG.completado.icon, label: 'Fin', pos: '75%' }
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
                { stage: 'diseno', icon: ETAPAS_CONFIG.diseno.icon, label: 'Diseño', pos: POS5.P1, idx: 1, topPercent: '40%' },
                { stage: 'compras', icon: ETAPAS_CONFIG.compras.icon, label: 'Compras', pos: POS5.P2, idx: 2, topPercent: '40%' },
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
                { stage: 'instalacion', icon: ETAPAS_CONFIG.instalacion.icon, label: 'Comp.', pos: POS5.P4, idx: 4, topPercent: '40%' },
                { stage: 'completado', icon: ETAPAS_CONFIG.completado.icon, label: 'Fin', pos: POS5.P5, idx: 5, topPercent: '40%' }
            );
        } else {
            // Posiciones para 4 nodos: 8%, 30%, 52%, 75%
            const POS4 = { P1: '8%', P2: '30%', P3: '52%', P4: '75%' };
            nodes = [
                { stage: 'diseno', icon: ETAPAS_CONFIG.diseno.icon, label: 'Diseño', pos: POS4.P1, idx: 1, topPercent: '40%' },
                { stage: 'compras', icon: ETAPAS_CONFIG.compras.icon, label: 'Compras', pos: POS4.P2, idx: 2, topPercent: '40%' },
                { stage: 'instalacion', icon: ETAPAS_CONFIG.instalacion.icon, label: 'Comp.', pos: POS4.P3, idx: 4, topPercent: '40%' },
                { stage: 'completado', icon: ETAPAS_CONFIG.completado.icon, label: 'Fin', pos: POS4.P4, idx: 5, topPercent: '40%' }
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
            let fechaLimiteEtapa = null; // Date object for badge

            if (node.stage === 'completado') {
                // No mostrar en "Fin"
            } else if (node.isSubStage) {
                if (!subStageCountdownShown) {
                    const info = diasPorEtapa?.['produccion'];
                    if (info) {
                        diasEtapa = info.dias;
                        fechaLimiteEtapa = info.fechaLimite;
                        stageForDate = 'produccion';
                        subStageCountdownShown = true;
                    }
                }
            } else if (diasPorEtapa?.[node.stage]) {
                const info = diasPorEtapa[node.stage];
                diasEtapa = info.dias;
                fechaLimiteEtapa = info.fechaLimite;
            }
            const mostrarDias = diasEtapa !== null;

            let diasLabel = '';
            let diasColor = '';
            let fechaLabel = '';
            let fechaColor = '';

            if (mostrarDias) {
                // Usar la fecha límite recalculada para el badge
                if (fechaLimiteEtapa) {
                    fechaLabel = formatDateShort(fechaLimiteEtapa);
                }

                // Badge de días: siempre mostrar días restantes o atraso
                if (diasEtapa < 0) {
                    diasLabel = `${Math.abs(diasEtapa)}D ATRASO`;
                    diasColor = 'bg-red-100 text-red-700 border-red-200';
                    fechaColor = 'bg-red-50 text-red-600 border-red-200';
                } else if (diasEtapa === 0) {
                    diasLabel = 'HOY';
                    diasColor = 'bg-amber-100 text-amber-700 border-amber-200';
                    fechaColor = 'bg-amber-50 text-amber-600 border-amber-200';
                } else if (diasEtapa <= 1) {
                    diasLabel = `${diasEtapa}D ENTREGA`;
                    diasColor = 'bg-amber-100 text-amber-700 border-amber-200';
                    fechaColor = 'bg-amber-50 text-amber-600 border-amber-200';
                } else {
                    diasLabel = `${diasEtapa}D ENTREGA`;
                    diasColor = 'bg-green-50 text-green-700 border-green-200';
                    fechaColor = 'bg-green-50 text-green-600 border-green-200';
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
                    {/* Badges: fecha + días, lado a lado */}
                    {mostrarDias && (
                        <div
                            className="absolute flex flex-row items-center whitespace-nowrap"
                            style={{ top: node.labelPosition === 'top' ? px(50) : px(-22), gap: px(3) }}
                        >
                            {fechaLabel && (
                                <span
                                    className={`font-bold rounded-full border ${fechaColor}`}
                                    style={{ fontSize: s(0.75), padding: `${px(1)} ${px(5)}` }}
                                >
                                    {fechaLabel}
                                </span>
                            )}
                            <span
                                className={`font-bold rounded-full border ${diasColor}`}
                                style={{ fontSize: s(0.75), padding: `${px(1)} ${px(5)}` }}
                            >
                                {diasLabel}
                            </span>
                        </div>
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
