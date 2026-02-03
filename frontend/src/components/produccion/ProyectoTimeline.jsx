import React, { useState } from 'react';
import {
    Package,
    ShoppingCart,
    Factory,
    Truck,
    CheckCircle2,
    Clock,
    Calendar,
    User,
    Circle,
    RefreshCw,
    ChevronRight
} from 'lucide-react';

export const ETAPAS_CONFIG = {
    pendiente: { nombre: 'Pendiente', color: '#9CA3AF', bgColor: 'bg-gray-400', icon: Circle, orden: 0 },
    diseno: { nombre: 'Diseño', color: '#8B5CF6', bgColor: 'bg-violet-500', icon: Package, orden: 1 },
    compras: { nombre: 'Compras', color: '#10B981', bgColor: 'bg-emerald-500', icon: ShoppingCart, orden: 2 },
    produccion: { nombre: 'Producción', color: '#F59E0B', bgColor: 'bg-amber-500', icon: Factory, orden: 3 },
    instalacion: { nombre: 'Instalación', color: '#3B82F6', bgColor: 'bg-blue-500', icon: Truck, orden: 4 },
    completado: { nombre: 'Completado', color: '#22C55E', bgColor: 'bg-green-500', icon: CheckCircle2, orden: 5 }
};

export const ETAPAS_ORDEN = ['pendiente', 'diseno', 'compras', 'produccion', 'instalacion', 'completado'];

/**
 * Componente compartido de tarjeta de proyecto con stepper visual.
 * @param {object}   props.proyecto     - Datos del proyecto (con diasRestantes, estadoSubEtapas, etc.)
 * @param {function} props.onCompletar  - (opcional) Callback para avanzar etapa.
 *                                        Cuando se pasa, aparecen: detalle sub-etapas, footer completado y botón avanzar.
 */
const ProyectoTimeline = ({ proyecto, onCompletar }) => {
    const [loading, setLoading] = useState(false);

    const diasRestantes = proyecto.diasRestantes;
    const esGarantia = proyecto.tipo_proyecto?.toUpperCase() === 'GTIA';
    const esMTO = proyecto.tipo_proyecto?.toUpperCase() === 'MTO';
    const usaTimelineSimplificado = esGarantia || (esMTO && !proyecto.es_extensivo);

    const estadoRetraso = proyecto.estadoRetraso || { enRetraso: false };
    const enRetraso = estadoRetraso.enRetraso;

    const urgenciaPorFecha = diasRestantes !== null && (esMTO ? diasRestantes < 0 : diasRestantes <= 3);
    const esUrgente = proyecto.prioridad === 1 || esGarantia || urgenciaPorFecha || enRetraso;

    const tieneProduccion = proyecto.tiene_manufactura || proyecto.tiene_herreria;

    // --- Porcentaje de avance ---
    let porcentaje;
    if (usaTimelineSimplificado) {
        porcentaje = proyecto.etapa_actual === 'completado' ? 100 : 50;
    } else if (tieneProduccion) {
        const etapaActualIndex = ETAPAS_ORDEN.indexOf(proyecto.etapa_actual);
        porcentaje = Math.round((etapaActualIndex / (ETAPAS_ORDEN.length - 1)) * 100);
    } else {
        const etapasSinProd = ['diseno', 'compras', 'instalacion', 'completado'];
        let idx = etapasSinProd.indexOf(proyecto.etapa_actual);
        if (idx === -1 && proyecto.etapa_actual === 'produccion') idx = 1;
        if (idx === -1) idx = 0;
        porcentaje = Math.round((idx / (etapasSinProd.length - 1)) * 100);
    }

    // --- Color según tipo ---
    const getColorPorTipo = (tipo) => {
        if (!tipo) return { bg: 'bg-white', border: '', label: '' };
        const tipoUpper = tipo.toUpperCase().trim();
        if (tipoUpper === 'MTO') return { bg: 'bg-yellow-50', border: 'border-l-4 border-yellow-400', label: 'MTO', labelBg: 'bg-yellow-400 text-yellow-900' };
        if (tipoUpper === 'GTIA') return { bg: 'bg-red-50', border: 'border-l-4 border-red-400', label: 'GTIA', labelBg: 'bg-red-500 text-white' };
        return { bg: 'bg-white', border: '', label: tipoUpper, labelBg: 'bg-gray-200 text-gray-700' };
    };

    const colorTipo = getColorPorTipo(proyecto.tipo_proyecto);
    const bgFinal = enRetraso ? 'bg-red-50' : colorTipo.bg;
    const borderFinal = enRetraso ? 'border-l-4 border-red-500' : colorTipo.border;

    // Helpers de escalado (funcionan con --escala de la TV; en el dashboard normal defaultean a 1)
    const s = (val) => `calc(${val}rem * var(--escala, 1))`;
    const px = (val) => `calc(${val}px * var(--escala, 1))`;

    // --- Avanzar etapa ---
    const handleCompletar = async () => {
        if (loading || proyecto.etapa_actual === 'completado' || !onCompletar) return;
        setLoading(true);
        try {
            await onCompletar(proyecto.id);
        } finally {
            setLoading(false);
        }
    };

    // ================================================================
    // RENDER
    // ================================================================
    return (
        <div
            className={`${bgFinal} ${borderFinal} overflow-hidden transition-all ${esUrgente ? 'ring-2 ring-red-400' : ''} rounded-lg shadow-sm`}
            style={{ marginBottom: px(4) }}
        >
            {/* ============ HEADER ============ */}
            <div
                className={`${colorTipo.bg === 'bg-white' ? 'bg-gradient-to-r from-gray-50 to-white' : ''} border-b border-gray-100 flex items-start justify-between`}
                style={{ padding: `${px(8)} ${px(12)}` }}
            >
                <div className="flex-1" style={{ minWidth: 0 }}>
                    {/* Badges */}
                    <div className="flex items-center mb-1" style={{ gap: px(4) }}>
                        {colorTipo.label && (
                            <span
                                className={`inline-flex items-center font-bold rounded-full ${colorTipo.labelBg}`}
                                style={{ fontSize: s(0.75), padding: `${px(2)} ${px(8)}` }}
                            >
                                {colorTipo.label}
                            </span>
                        )}
                        {enRetraso && (
                            <span
                                className="inline-flex items-center font-bold rounded-full bg-red-600 text-white animate-pulse"
                                style={{ fontSize: s(0.75), padding: `${px(2)} ${px(8)}`, gap: px(4) }}
                            >
                                ⚠️ +{estadoRetraso.diasRetraso}d
                            </span>
                        )}
                        {esUrgente && !enRetraso && (
                            <span
                                className="inline-flex items-center font-bold rounded-full bg-red-500 text-white animate-pulse"
                                style={{ fontSize: s(0.75), padding: `${px(2)} ${px(8)}`, gap: px(4) }}
                            >
                                !
                            </span>
                        )}
                        {/* Badge etapa actual */}
                        <span
                            className="inline-flex items-center font-semibold rounded-full"
                            style={{
                                backgroundColor: `${ETAPAS_CONFIG[proyecto.etapa_actual]?.color}15`,
                                color: ETAPAS_CONFIG[proyecto.etapa_actual]?.color,
                                fontSize: s(0.75),
                                padding: `${px(2)} ${px(8)}`,
                                border: `1px solid ${ETAPAS_CONFIG[proyecto.etapa_actual]?.color}30`
                            }}
                        >
                            {usaTimelineSimplificado && proyecto.etapa_actual !== 'completado'
                                ? 'INSTALACIÓN'
                                : ETAPAS_CONFIG[proyecto.etapa_actual]?.nombre}
                        </span>
                    </div>

                    {/* Nombre y cliente */}
                    <h3 className="font-bold text-gray-900 leading-tight truncate" style={{ fontSize: s(1.8) }}>
                        {proyecto.nombre}
                    </h3>
                    {proyecto.cliente && (
                        <p className="text-gray-500 flex items-center" style={{ marginTop: px(8), fontSize: s(1.5), gap: px(6) }}>
                            <User style={{ width: s(1.4), height: s(1.4) }} className="text-gray-400" />
                            {proyecto.cliente}
                        </p>
                    )}
                </div>

                {/* Círculo de progreso + días restantes */}
                <div className="flex flex-col items-center" style={{ marginLeft: px(12) }}>
                    {!usaTimelineSimplificado && (
                        <div className="relative" style={{ width: px(64), height: px(64) }}>
                            <svg className="transform -rotate-90" style={{ width: px(64), height: px(64) }}>
                                <circle cx="50%" cy="50%" r="45%" stroke="#E5E7EB" strokeWidth="10%" fill="none" />
                                <circle
                                    cx="50%" cy="50%" r="45%"
                                    stroke={porcentaje > 0 ? ETAPAS_CONFIG[proyecto.etapa_actual]?.color : 'transparent'}
                                    strokeWidth="10%" fill="none"
                                    strokeLinecap={porcentaje > 0 ? "round" : "butt"}
                                    strokeDasharray={`${porcentaje * 2.8} 280`}
                                    className="transition-all duration-500"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="font-bold text-gray-700" style={{ fontSize: s(1.1) }}>{porcentaje}%</span>
                            </div>
                        </div>
                    )}
                    {proyecto.fecha_limite && (
                        <div
                            className={`text-center font-medium ${diasRestantes !== null && diasRestantes <= 3 ? 'text-red-600' : 'text-gray-500'}`}
                            style={{ marginTop: px(4), fontSize: s(0.75) }}
                        >
                            <div className="flex items-center" style={{ gap: px(4) }}>
                                <Clock style={{ width: s(0.7), height: s(0.7) }} />
                                {diasRestantes !== null && diasRestantes < 0 ? 'Vencido' : diasRestantes === 0 ? 'Hoy' : `${diasRestantes}d`}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ============ STEPPER (líneas SVG + nodos) ============ */}
            <div className="bg-gray-50 relative overflow-visible" style={{ height: px(160), padding: px(12) }}>

                {/* Cuadro de fecha de entrega */}
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

                {/* --- LÍNEAS SVG --- */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {(() => {
                        // Timeline simplificado (MTO no extensivo / GTIA): una sola línea
                        if (usaTimelineSimplificado) {
                            const stroke = proyecto.etapa_actual === 'completado' ? '#10B981' : '#CBD5E1';
                            return <line x1="10" y1="40" x2="90" y2="40" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />;
                        }

                        const POS = { P1: 10, P2: 30, P3: 50, P4: 70, P5: 90 };
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

                        // Sin producción: 4 nodos en posiciones redistribuidas (10, 36, 64, 90)
                        if (!tieneProduccion) {
                            return (
                                <>
                                    <line x1="10" y1="40" x2="36" y2="40" stroke={getStrokeColor('diseno')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                    <line x1="36" y1="40" x2="64" y2="40" stroke={getStrokeColor('compras')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                    <line x1="64" y1="40" x2="90" y2="40" stroke={getStrokeColor('instalacion')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                </>
                            );
                        }

                        // Con producción: líneas con posible bifurcación manufactura/herrería
                        const splitStart = POS.P2;
                        const splitEnd = POS.P3;
                        const splitMid = (splitStart + splitEnd) / 2;

                        return (
                            <>
                                {/* Diseño → Compras */}
                                <line x1={POS.P1} y1="40" x2={POS.P2} y2="40" stroke={getStrokeColor('diseno')} strokeWidth="2" vectorEffect="non-scaling-stroke" />

                                {/* Bifurcación: ambas sub-etapas */}
                                {tieneAmbas && (
                                    <>
                                        <path d={`M ${splitStart} 40 L ${splitMid} 40 L ${splitMid} 20 L ${splitEnd} 20`} fill="none" stroke={getStrokeColor('compras')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                        <path d={`M ${splitEnd} 20 L ${POS.P4 - 5} 20 L ${POS.P4 - 5} 40 L ${POS.P4} 40`} fill="none" stroke={getSubStageStroke('manufactura')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                        <path d={`M ${splitStart} 40 L ${splitMid} 40 L ${splitMid} 60 L ${splitEnd} 60`} fill="none" stroke={getStrokeColor('compras')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                        <path d={`M ${splitEnd} 60 L ${POS.P4 - 5} 60 L ${POS.P4 - 5} 40 L ${POS.P4} 40`} fill="none" stroke={getSubStageStroke('herreria')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                    </>
                                )}

                                {/* Solo manufactura */}
                                {tieneManufacturaLocal && !tieneHerreriaLocal && (
                                    <>
                                        <line x1={POS.P2} y1="40" x2={POS.P3} y2="40" stroke={getStrokeColor('compras')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                        <line x1={POS.P3} y1="40" x2={POS.P4} y2="40" stroke={getSubStageStroke('manufactura')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                    </>
                                )}

                                {/* Solo herrería */}
                                {!tieneManufacturaLocal && tieneHerreriaLocal && (
                                    <>
                                        <line x1={POS.P2} y1="40" x2={POS.P3} y2="40" stroke={getStrokeColor('compras')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                        <line x1={POS.P3} y1="40" x2={POS.P4} y2="40" stroke={getSubStageStroke('herreria')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                    </>
                                )}

                                {/* Instalación → Completado */}
                                <line x1={POS.P4} y1="40" x2={POS.P5} y2="40" stroke={getStrokeColor('instalacion')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                            </>
                        );
                    })()}
                </svg>

                {/* --- NODOS --- */}
                {(() => {
                    // ── Simplificado (MTO no extensivo / GTIA) ──
                    if (usaTimelineSimplificado) {
                        const proyectoCompletado = proyecto.etapa_actual === 'completado';

                        const getNodeColorSimple = (stage) => {
                            if (stage === 'completado') return proyectoCompletado ? 'bg-green-500 text-white' : 'bg-white border-2 border-gray-200 text-gray-400';
                            if (stage === 'instalacion') {
                                if (proyectoCompletado) return 'bg-green-500 text-white';
                                if (esGarantia) return 'bg-red-500 text-white';
                                if (esMTO && diasRestantes !== null && diasRestantes < 0) return 'bg-red-500 text-white';
                                return 'bg-green-500 text-white';
                            }
                            return 'bg-white border-2 border-gray-200 text-gray-400';
                        };

                        const nodes = [
                            { stage: 'instalacion', icon: Truck, label: 'Instalación', pos: '10%' },
                            { stage: 'completado', icon: CheckCircle2, label: 'Fin', pos: '90%' }
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

                    // ── Timeline normal ──
                    const tieneManufacturaLocal = proyecto.tiene_manufactura !== false;
                    const tieneHerreriaLocal = proyecto.tiene_herreria !== false;

                    let nodes = [];

                    if (tieneProduccion) {
                        const POS5 = { P1: '10%', P2: '30%', P3: '50%', P4: '70%', P5: '90%' };

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
                        // 4 nodos sin producción — posiciones redistribuidas
                        const POS4 = { P1: '10%', P2: '36%', P3: '64%', P4: '90%' };
                        nodes = [
                            { stage: 'diseno', icon: Package, label: 'Diseño', pos: POS4.P1, idx: 1, topPercent: '40%' },
                            { stage: 'compras', icon: ShoppingCart, label: 'Compras', pos: POS4.P2, idx: 2, topPercent: '40%' },
                            { stage: 'instalacion', icon: Truck, label: 'Inst.', pos: POS4.P3, idx: 4, topPercent: '40%' },
                            { stage: 'completado', icon: CheckCircle2, label: 'Fin', pos: POS4.P4, idx: 5, topPercent: '40%' }
                        ];
                    }

                    // Color del nodo según estado
                    const getNodeColor = (node) => {
                        const etapaIndex = ETAPAS_ORDEN.indexOf(proyecto.etapa_actual);

                        // Sub-etapas (manufactura / herrería)
                        if (node.isSubStage) {
                            if (etapaIndex > 3) return 'bg-green-500 text-white';
                            if (proyecto.etapa_actual === 'produccion') {
                                return proyecto.estadoSubEtapas?.[node.stage]?.completado ? 'bg-green-500 text-white' : 'bg-amber-500 text-white';
                            }
                            return 'bg-white border-2 border-gray-200 text-gray-400';
                        }

                        if (node.stage === 'completado' && proyecto.etapa_actual === 'completado') return 'bg-green-500 text-white';
                        if (proyecto.etapa_actual === node.stage) {
                            if (esMTO && diasRestantes !== null && diasRestantes < 0) return 'bg-red-500 text-white';
                            return enRetraso ? 'bg-red-500 text-white' : 'bg-green-500 text-white';
                        }
                        if (etapaIndex > node.idx) return 'bg-green-500 text-white';
                        return 'bg-white border-2 border-gray-200 text-gray-400';
                    };

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
                })()}
            </div>

            {/* ============ EXTRAS: solo cuando se pasa onCompletar (dashboard principal) ============ */}

            {/* Detalle sub-etapas cuando está en producción */}
            {onCompletar && proyecto.etapa_actual === 'produccion' && proyecto.estadoSubEtapas && !proyecto.estadoSubEtapas.ambosCompletados && (
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

            {/* Mensaje: producción finalizada, listo para instalación */}
            {onCompletar && proyecto.estadoSubEtapas?.ambosCompletados && proyecto.etapa_actual === 'produccion' && (
                <div className="px-6 py-3 bg-green-50 border-t border-green-100 text-center">
                    <span className="text-base text-green-700 font-bold flex items-center justify-center gap-2">
                        <CheckCircle2 size={16} /> Producción Finalizada - Listo para enviar a Instalación
                    </span>
                </div>
            )}

            {/* Footer: proyecto completado */}
            {onCompletar && proyecto.etapa_actual === 'completado' && (
                <div className="px-6 py-4 bg-white border-t border-gray-100">
                    <div className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg">
                        <CheckCircle2 size={20} />
                        <span>Proyecto Completado</span>
                    </div>
                </div>
            )}

            {/* Botón avanzar etapa (no en completado, no en instalación, no en timeline simplificado) */}
            {onCompletar && proyecto.etapa_actual !== 'completado' && proyecto.etapa_actual !== 'instalacion' && !usaTimelineSimplificado && (
                <div className="px-6 py-4 bg-white border-t border-gray-100">
                    <button
                        onClick={handleCompletar}
                        disabled={loading}
                        className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <RefreshCw size={18} className="animate-spin" />
                        ) : (
                            <ChevronRight size={18} />
                        )}
                        Avanzar a {ETAPAS_CONFIG[ETAPAS_ORDEN[ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) + 1]]?.nombre}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProyectoTimeline;
