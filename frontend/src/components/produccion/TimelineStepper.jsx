import React, { memo, useMemo } from 'react';
import {
    Package,
    ShoppingCart,
    Factory,
    Truck,
    CheckCircle2,
    Calendar
} from 'lucide-react';
import { s, px } from '../../utils/produccion';
import { ETAPAS_CONFIG, ETAPAS_ORDEN, usaTimelineSimplificado } from './constants';

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
    const enRetraso = estadoRetraso.enRetraso;

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
                return enRetraso ? 'bg-red-500 text-white' : 'bg-green-500 text-white';
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
                    stage: 'manufactura', icon: Factory, label: 'Mfra.', pos: POS5.P3, idx: 3,
                    topPercent: tieneHerreriaLocal ? '20%' : '40%',
                    isSubStage: true,
                    labelPosition: tieneHerreriaLocal ? 'top' : 'bottom'
                });
            }
            if (tieneHerreriaLocal) {
                nodes.push({
                    stage: 'herreria', icon: Factory, label: 'Herr.', pos: POS5.P3, idx: 3,
                    topPercent: tieneManufacturaLocal ? '60%' : '40%',
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

        return nodes.map((node) => (
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
                {node.labelPosition !== 'top' && (
                    <span
                        className="absolute font-bold text-gray-600 bg-gray-50 px-1"
                        style={{ top: node.isSubStage ? px(50) : px(64), fontSize: node.isSubStage ? s(1.1) : s(1.5) }}
                    >
                        {node.label}
                    </span>
                )}
            </div>
        ));
    }, [proyecto.etapa_actual, proyecto.tiene_manufactura, proyecto.tiene_herreria, proyecto.estadoSubEtapas, diasRestantes, esMTO, esGarantia, enRetraso, timelineSimplificado, tieneProduccion]);

    return (
        <div className="bg-gray-50 relative overflow-visible" style={{ height: px(160), padding: px(12) }}>
            {/* Cuadro de fecha límite */}
            {proyecto.fecha_limite && (
                <div
                    className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center origin-right rounded-xl shadow-md ${diasRestantes !== null && diasRestantes < 0 ? 'bg-red-100 text-red-700 border border-red-200' : diasRestantes !== null && diasRestantes <= 3 ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-white text-gray-700 border border-gray-200'}`}
                    style={{ padding: `${px(12)} ${px(16)}`, gap: px(2) }}
                >
                    <span className="text-gray-500 uppercase tracking-wide" style={{ fontSize: s(0.65) }}>Límite</span>
                    <Calendar style={{ width: s(1.25), height: s(1.25), marginBottom: px(4) }} />
                    <span className="font-bold" style={{ fontSize: s(1.5) }}>
                        {new Date(proyecto.fecha_limite + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    </span>
                    <span
                        className={`font-semibold ${diasRestantes !== null && diasRestantes < 0 ? 'text-red-600' : diasRestantes !== null && diasRestantes <= 3 ? 'text-amber-600' : 'text-gray-500'}`}
                        style={{ fontSize: s(1.125) }}
                    >
                        {diasRestantes !== null && diasRestantes < 0 ? 'Venc' : diasRestantes === 0 ? 'Hoy' : `${diasRestantes}d`}
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
