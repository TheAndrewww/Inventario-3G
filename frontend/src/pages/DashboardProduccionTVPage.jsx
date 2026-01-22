import React, { useState, useEffect, useCallback } from 'react';
import {
    Package,
    ShoppingCart,
    Factory,
    Truck,
    CheckCircle2,
    Clock,
    AlertTriangle,
    RefreshCw,
    Calendar,
    User,
    Circle,
    Download,
    ZoomIn,
    ZoomOut,
    RotateCw
} from 'lucide-react';
import produccionService from '../services/produccion.service';
import { Loader } from '../components/common';
import toast, { Toaster } from 'react-hot-toast';

// Configuración de etapas con colores e iconos
const ETAPAS_CONFIG = {
    pendiente: { nombre: 'Pendiente', color: '#9CA3AF', bgColor: 'bg-gray-400', icon: Circle, orden: 0 },
    diseno: { nombre: 'Diseño', color: '#8B5CF6', bgColor: 'bg-violet-500', icon: Package, orden: 1 },
    compras: { nombre: 'Compras', color: '#10B981', bgColor: 'bg-emerald-500', icon: ShoppingCart, orden: 2 },
    produccion: { nombre: 'Producción', color: '#F59E0B', bgColor: 'bg-amber-500', icon: Factory, orden: 3 },
    instalacion: { nombre: 'Instalación', color: '#3B82F6', bgColor: 'bg-blue-500', icon: Truck, orden: 4 },
    completado: { nombre: 'Completado', color: '#22C55E', bgColor: 'bg-green-500', icon: CheckCircle2, orden: 5 }
};

const ETAPAS_ORDEN = ['pendiente', 'diseno', 'compras', 'produccion', 'instalacion', 'completado'];

const ProyectoTimeline = ({ proyecto }) => {
    const diasRestantes = proyecto.diasRestantes;
    const esGarantia = proyecto.tipo_proyecto?.toUpperCase() === 'GTIA';
    const esMTO = proyecto.tipo_proyecto?.toUpperCase() === 'MTO';
    // GTIA siempre simplificado, MTO simplificado solo si NO es extensivo
    const usaTimelineSimplificado = esGarantia || (esMTO && !proyecto.es_extensivo);

    // Estado de retraso para proyectos A, B, C
    const estadoRetraso = proyecto.estadoRetraso || { enRetraso: false };
    const enRetraso = estadoRetraso.enRetraso;

    const esUrgente = proyecto.prioridad === 1 || esGarantia || (diasRestantes !== null && diasRestantes <= 3) || enRetraso;
    const etapaActualIndex = ETAPAS_ORDEN.indexOf(proyecto.etapa_actual);
    const porcentaje = Math.round((etapaActualIndex / (ETAPAS_ORDEN.length - 1)) * 100);

    const getColorPorTipo = (tipo) => {
        if (!tipo) return { bg: 'bg-white', border: '', label: '' };
        const tipoUpper = tipo.toUpperCase().trim();
        if (tipoUpper === 'MTO') return { bg: 'bg-yellow-50', border: 'border-l-4 border-yellow-400', label: 'MTO', labelBg: 'bg-yellow-400 text-yellow-900' };
        if (tipoUpper === 'GTIA') return { bg: 'bg-red-50', border: 'border-l-4 border-red-400', label: 'GTIA', labelBg: 'bg-red-500 text-white' };
        return { bg: 'bg-white', border: '', label: tipoUpper, labelBg: 'bg-gray-200 text-gray-700' };
    };

    const colorTipo = getColorPorTipo(proyecto.tipo_proyecto);

    // Si está en retraso, override de colores
    const bgFinal = enRetraso ? 'bg-red-50' : colorTipo.bg;
    const borderFinal = enRetraso ? 'border-l-4 border-red-500' : colorTipo.border;

    // Helper calculate style size
    const s = (val) => `calc(${val}rem * var(--escala, 1))`;
    const px = (val) => `calc(${val}px * var(--escala, 1))`;

    return (
        <div
            className={`${bgFinal} ${borderFinal} overflow-hidden transition-all ${esUrgente ? 'ring-2 ring-red-400' : ''} rounded-lg shadow-sm mb-1`}
            style={{ marginBottom: px(4) }}
        >
            {/* Header */}
            <div
                className={`${colorTipo.bg === 'bg-white' ? 'bg-gradient-to-r from-gray-50 to-white' : ''} border-b border-gray-100 flex items-start justify-between`}
                style={{ padding: `${px(8)} ${px(12)}` }}
            >
                <div className="flex-1" style={{ minWidth: 0 }}>
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
                        <span
                            className="inline-flex items-center font-semibold rounded-full"
                            style={{
                                backgroundColor: `${ETAPAS_CONFIG[proyecto.etapa_actual]?.color}15`,
                                color: ETAPAS_CONFIG[proyecto.etapa_actual]?.color,
                                fontSize: s(0.75),
                                padding: `${px(2)} ${px(8)}`,
                                gap: px(4)
                            }}
                        >
                            {ETAPAS_CONFIG[proyecto.etapa_actual]?.nombre}
                        </span>
                    </div>

                    <h3
                        className="font-bold text-gray-900 leading-tight truncate"
                        style={{ fontSize: s(1.8) }}
                    >
                        {proyecto.nombre}
                    </h3>

                    {proyecto.cliente && (
                        <p className="text-gray-500 flex items-center" style={{ marginTop: px(8), fontSize: s(1.5), gap: px(6) }}>
                            <User style={{ width: s(1.4), height: s(1.4) }} className="text-gray-400" />
                            {proyecto.cliente}
                        </p>
                    )}
                </div>

                <div className="flex flex-col items-center" style={{ marginLeft: px(12) }}>
                    <div className="relative" style={{ width: px(64), height: px(64) }}>
                        <svg className="transform -rotate-90" style={{ width: px(64), height: px(64) }}>
                            <circle cx="50%" cy="50%" r="45%" stroke="#E5E7EB" strokeWidth="10%" fill="none" />
                            <circle cx="50%" cy="50%" r="45%" stroke={ETAPAS_CONFIG[proyecto.etapa_actual]?.color} strokeWidth="10%" fill="none" strokeLinecap="round" strokeDasharray={`${porcentaje * 2.8} 280`} className="transition-all duration-500" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="font-bold text-gray-700" style={{ fontSize: s(1.1) }}>{porcentaje}%</span>
                        </div>
                    </div>
                    {proyecto.fecha_limite && (
                        <div
                            className={`text-center font-medium ${diasRestantes <= 3 ? 'text-red-600' : 'text-gray-500'}`}
                            style={{ marginTop: px(4), fontSize: s(0.75) }}
                        >
                            <div className="flex items-center" style={{ gap: px(4) }}>
                                <Clock style={{ width: s(0.7), height: s(0.7) }} />
                                {diasRestantes < 0 ? 'Vencido' : diasRestantes === 0 ? 'Hoy' : `${diasRestantes}d`}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Stepper Vertical */}
            <div className="bg-gray-50 relative overflow-visible" style={{ height: px(160), padding: px(12) }}>
                {proyecto.fecha_limite && (
                    <div
                        className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center origin-right rounded-xl shadow-md ${diasRestantes < 0 ? 'bg-red-100 text-red-700 border border-red-200' : diasRestantes <= 3 ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-white text-gray-700 border border-gray-200'}`}
                        style={{ padding: `${px(12)} ${px(16)}`, gap: px(2) }}
                    >
                        <span className="text-gray-500 uppercase tracking-wide" style={{ fontSize: s(0.65) }}>Límite</span>
                        <Calendar style={{ width: s(1.25), height: s(1.25), marginBottom: px(4) }} />
                        <span className="font-bold" style={{ fontSize: s(1.5) }}>{new Date(proyecto.fecha_limite + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
                        <span className={`font-semibold ${diasRestantes < 0 ? 'text-red-600' : diasRestantes <= 3 ? 'text-amber-600' : 'text-gray-500'}`} style={{ fontSize: s(1.125) }}>{diasRestantes < 0 ? 'Venc' : diasRestantes === 0 ? 'Hoy' : `${diasRestantes}d`}</span>
                    </div>
                )}

                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {(() => {
                        if (usaTimelineSimplificado) {
                            // GTIA y MTO (no extensivo): Solo una línea entre Instalación y Fin
                            const getStrokeColor = () => proyecto.etapa_actual === 'completado' ? '#10B981' : '#CBD5E1';
                            return (
                                <line x1="8" y1="40" x2="85" y2="40" stroke={getStrokeColor()} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                            );
                        } else {
                            // Normal: líneas completas
                            const POS = { P1: 8, P2: 27, P3: 46, P4: 65, P5: 85 };
                            const getStrokeColor = (baseStage) => ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > ETAPAS_ORDEN.indexOf(baseStage) ? '#10B981' : '#CBD5E1';
                            return (
                                <>
                                    <line x1={POS.P1} y1="40" x2={POS.P2} y2="40" stroke={getStrokeColor('diseno')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                    <line x1={POS.P2} y1="40" x2={POS.P4} y2="40" stroke={getStrokeColor('compras')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                    <line x1={POS.P4} y1="40" x2={POS.P5} y2="40" stroke={getStrokeColor('instalacion')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                </>
                            );
                        }
                    })()}
                </svg>

                {/* Nodes */}
                {(() => {
                    if (usaTimelineSimplificado) {
                        // GTIA y MTO (no extensivo): Solo Instalación y Fin, mismo largo que timeline completa
                        const nodes = [
                            { stage: 'instalacion', icon: Truck, label: 'Instalación', pos: '8%', idx: 4 },
                            { stage: 'completado', icon: CheckCircle2, label: 'Fin', pos: '85%', idx: 5 }
                        ];

                        // Función para determinar color del nodo (simplificado)
                        const getNodeColorSimple = (node) => {
                            const esCompletado = node.stage === 'completado' && proyecto.etapa_actual === 'completado';
                            const esInstalacionActiva = node.stage === 'instalacion' && proyecto.etapa_actual === 'instalacion';
                            const esInstalacionCompletada = node.stage === 'instalacion' && proyecto.etapa_actual === 'completado';

                            if (esCompletado || esInstalacionCompletada) {
                                return 'bg-green-500 text-white';
                            }
                            if (esInstalacionActiva) {
                                return 'bg-amber-500 text-white';
                            }
                            return 'bg-white border-2 border-gray-200 text-gray-400';
                        };

                        return (
                            <>
                                {nodes.map((node) => (
                                    <div key={node.stage} className="absolute top-[40%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: node.pos }}>
                                        <div
                                            className={`rounded-full flex items-center justify-center shadow-md ${getNodeColorSimple(node)}`}
                                            style={{ width: px(56), height: px(56) }}
                                        >
                                            <node.icon style={{ width: px(28), height: px(28) }} />
                                        </div>
                                        <span className="absolute font-bold text-gray-600 bg-gray-50 px-1" style={{ top: px(64), fontSize: s(1.5) }}>{node.label}</span>
                                    </div>
                                ))}
                            </>
                        );
                    } else {
                        // Normal: timeline completa
                        const POS = { P1: '8%', P2: '27%', P3: '46%', P4: '65%', P5: '85%' };
                        const nodes = [
                            { stage: 'diseno', icon: Package, label: 'Diseño', pos: POS.P1, idx: 1 },
                            { stage: 'compras', icon: ShoppingCart, label: 'Compras', pos: POS.P2, idx: 2 },
                            { stage: 'produccion', icon: Factory, label: 'Prod.', pos: POS.P3, idx: 3 },
                            { stage: 'instalacion', icon: Truck, label: 'Inst.', pos: POS.P4, idx: 4 },
                            { stage: 'completado', icon: CheckCircle2, label: 'Fin', pos: POS.P5, idx: 5 }
                        ];

                        // Función para determinar color del nodo
                        const getNodeColor = (node) => {
                            const etapaIndex = ETAPAS_ORDEN.indexOf(proyecto.etapa_actual);
                            const esEtapaCompletada = etapaIndex > node.idx;
                            const esEtapaActual = proyecto.etapa_actual === node.stage;
                            const esCompletado = node.stage === 'completado' && proyecto.etapa_actual === 'completado';

                            if (esCompletado) {
                                return 'bg-green-500 text-white';
                            }
                            if (esEtapaActual) {
                                // Etapa actual: rojo si en retraso, amarillo/naranja si está en progreso
                                return enRetraso ? 'bg-red-500 text-white' : 'bg-amber-500 text-white';
                            }
                            if (esEtapaCompletada) {
                                return 'bg-green-500 text-white';
                            }
                            return 'bg-white border-2 border-gray-200 text-gray-400';
                        };

                        return (
                            <>
                                {nodes.map((node) => (
                                    <div key={node.stage} className="absolute top-[40%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: node.pos }}>
                                        <div
                                            className={`rounded-full flex items-center justify-center shadow-md ${getNodeColor(node)}`}
                                            style={{ width: px(56), height: px(56) }}
                                        >
                                            <node.icon style={{ width: px(28), height: px(28) }} />
                                        </div>
                                        <span className="absolute font-bold text-gray-600 bg-gray-50 px-1" style={{ top: px(64), fontSize: s(1.5) }}>{node.label}</span>
                                    </div>
                                ))}
                            </>
                        );
                    }
                })()}
            </div>
            {
                proyecto.etapa_actual === 'produccion' && proyecto.estadoSubEtapas && !proyecto.estadoSubEtapas.ambosCompletados && (
                    <div
                        className="bg-amber-50 border-t border-amber-100 flex justify-center text-xl"
                        style={{ padding: `${px(12)} ${px(24)}`, gap: px(32) }}
                    >
                        <div className="flex items-center" style={{ gap: px(8) }}>
                            <div className={`rounded-full ${proyecto.estadoSubEtapas.manufactura?.completado ? 'bg-green-500' : 'bg-gray-300'}`} style={{ width: px(14), height: px(14) }} />
                            <span className={proyecto.estadoSubEtapas.manufactura?.completado ? 'text-green-700 font-medium line-through' : 'text-gray-500'} style={{ fontSize: s(1.25) }}>Manufactura</span>
                        </div>
                        <div className="flex items-center" style={{ gap: px(8) }}>
                            <div className={`rounded-full ${proyecto.estadoSubEtapas.herreria?.completado ? 'bg-green-500' : 'bg-gray-300'}`} style={{ width: px(14), height: px(14) }} />
                            <span className={proyecto.estadoSubEtapas.herreria?.completado ? 'text-green-700 font-medium line-through' : 'text-gray-500'} style={{ fontSize: s(1.25) }}>Herrería</span>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

const EstadisticasHeaderTV = ({ estadisticas }) => {
    const s = (val) => `calc(${val}rem * var(--escala, 1))`;
    const px = (val) => `calc(${val}px * var(--escala, 1))`;

    const items = [
        { label: 'En Diseño', value: estadisticas.diseno || 0, color: ETAPAS_CONFIG.diseno.color, icon: Package },
        { label: 'En Compras', value: estadisticas.compras || 0, color: ETAPAS_CONFIG.compras.color, icon: ShoppingCart },
        { label: 'En Producción', value: estadisticas.produccion || 0, color: ETAPAS_CONFIG.produccion.color, icon: Factory },
        { label: 'En Instalación', value: estadisticas.instalacion || 0, color: ETAPAS_CONFIG.instalacion.color, icon: Truck },
    ];

    return (
        <div className="grid grid-cols-4 mb-6" style={{ gap: px(8) }}>
            {items.map(item => {
                const Icon = item.icon;
                return (
                    <div
                        key={item.label}
                        className="bg-white rounded-xl shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center"
                        style={{ padding: `${px(24)} ${px(8)}`, minHeight: px(220) }}
                    >
                        <div className="flex items-center justify-center" style={{ marginBottom: px(8) }}>
                            <div className="rounded-full flex items-center justify-center" style={{ width: px(48), height: px(48), backgroundColor: `${item.color}20` }}>
                                <Icon style={{ width: px(24), height: px(24), color: item.color }} />
                            </div>
                        </div>
                        <div className="font-bold" style={{ fontSize: s(2.25), color: item.color }}>{item.value}</div>
                        <div className="font-bold leading-tight text-gray-500" style={{ fontSize: s(1.125) }}>{item.label}</div>
                    </div>
                );
            })}
        </div>
    );
};

const DashboardProduccionTVPage = () => {
    const [loading, setLoading] = useState(true);
    const [proyectos, setProyectos] = useState([]);
    const [estadisticas, setEstadisticas] = useState({});
    const [sincronizando, setSincronizando] = useState(false);

    // Zoom & Orientation State
    const [zoomLevel, setZoomLevel] = useState(() => {
        const savedZoom = localStorage.getItem('dashboardTVScale');
        return savedZoom ? parseFloat(savedZoom) : 1;
    });

    const [orientacion, setOrientacion] = useState(() => {
        return localStorage.getItem('dashboardTVOrientation') || 'horizontal';
    });

    useEffect(() => {
        localStorage.setItem('dashboardTVScale', zoomLevel.toString());
    }, [zoomLevel]);

    useEffect(() => {
        localStorage.setItem('dashboardTVOrientation', orientacion);
    }, [orientacion]);

    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 3));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.5));
    const toggleOrientacion = () => setOrientacion(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');

    const cargarDatos = useCallback(async () => {
        try {
            setLoading(true);
            const response = await produccionService.obtenerDashboardPublico();
            if (response.success) {
                const todosProyectos = [];
                Object.keys(response.data.resumen).forEach(etapa => {
                    const proyectosEtapa = response.data.resumen[etapa]?.proyectos || [];
                    todosProyectos.push(...proyectosEtapa);
                });
                setProyectos(todosProyectos);
                setEstadisticas(response.data.estadisticas);
            }
        } catch (error) {
            console.error('Error al cargar dashboard:', error);
            toast.error('Error al cargar el dashboard');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const sincronizarYCargar = async () => {
            try {
                setSincronizando(true);
                await produccionService.sincronizarConSheets();
            } catch (error) {
                console.error('Error en sincronización automática:', error);
            } finally {
                setSincronizando(false);
            }
            await cargarDatos();
        };

        sincronizarYCargar();
        // Refresh every 1 minute
        const interval = setInterval(sincronizarYCargar, 60 * 1000);
        return () => clearInterval(interval);
    }, [cargarDatos]);

    // Filtrar completados y ordenar: primero los en retraso, luego por prioridad
    const proyectosActivos = proyectos
        .filter(p => p.etapa_actual !== 'completado')
        .sort((a, b) => {
            // 1. Proyectos en retraso primero
            const aRetraso = a.estadoRetraso?.enRetraso ? 1 : 0;
            const bRetraso = b.estadoRetraso?.enRetraso ? 1 : 0;
            if (aRetraso !== bRetraso) return bRetraso - aRetraso;

            // 2. Si ambos en retraso, el que tiene más días de retraso primero
            if (aRetraso && bRetraso) {
                const aRetrasoDias = a.estadoRetraso?.diasRetraso || 0;
                const bRetrasoDias = b.estadoRetraso?.diasRetraso || 0;
                if (aRetrasoDias !== bRetrasoDias) return bRetrasoDias - aRetrasoDias;
            }

            // 3. Por prioridad
            return (a.prioridad || 3) - (b.prioridad || 3);
        });

    // Helpers for style
    const px = (val) => `calc(${val}px * var(--escala, 1))`;

    if (loading && proyectos.length === 0) {
        return <div className="flex items-center justify-center h-screen"><Loader size="lg" /></div>;
    }

    return (
        <div className="fixed inset-0 overflow-hidden bg-gray-50" style={{ '--escala': zoomLevel }}>
            <Toaster position="top-right" />

            {/* Main Content Container with Rotation */}
            <div
                className="w-full h-full transition-all duration-300 origin-center"
                style={{
                    transform: orientacion === 'vertical' ? 'rotate(90deg)' : 'none',
                    width: orientacion === 'vertical' ? '100vh' : '100vw',
                    height: orientacion === 'vertical' ? '100vw' : '100vh',
                    position: 'absolute',
                    top: orientacion === 'vertical' ? 'calc(50% - 50vw)' : 0,
                    left: orientacion === 'vertical' ? 'calc(50% - 50vh)' : 0,
                }}
            >
                {/* Scrollable Area */}
                <div className="h-full w-full overflow-auto" style={{ padding: px(16) }}>
                    <EstadisticasHeaderTV estadisticas={estadisticas} />

                    <div className="pb-20" style={{ gap: px(16), display: 'flex', flexDirection: 'column' }}>
                        {proyectosActivos.map(proyecto => (
                            <ProyectoTimeline key={proyecto.id} proyecto={proyecto} />
                        ))}
                        {proyectosActivos.length === 0 && (
                            <div className="text-center text-gray-500 font-bold" style={{ padding: px(80), fontSize: `calc(1.5rem * var(--escala, 1))` }}>
                                No hay proyectos activos en producción
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Sync Info Overlay (Bottom Left) */}
            <div
                className={`fixed z-40 bg-white/80 backdrop-blur-sm rounded-full font-medium text-gray-500 shadow-sm border border-gray-100 flex items-center ${orientacion === 'vertical' ? 'bottom-4 right-4' : 'bottom-4 left-4'}`}
                style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', gap: '0.5rem' }}
            >
                {sincronizando && <RefreshCw size={12} className="animate-spin" />}
                <span>{sincronizando ? 'Sincronizando...' : 'En vivo'}</span>
            </div>

            {/* Controls (Bottom Right) */}
            <div className={`fixed z-50 flex gap-2 ${orientacion === 'vertical' ? 'bottom-4 left-4' : 'bottom-4 right-4'}`}>
                {/* Scale Controls */}
                <div className="flex bg-gray-900 text-white rounded-lg shadow-xl overflow-hidden border border-gray-700">
                    <button
                        onClick={handleZoomOut}
                        className="p-3 hover:bg-gray-800 active:bg-gray-700 transition-colors"
                        title="Reducir Escala"
                    >
                        <ZoomOut size={20} />
                    </button>
                    <div className="px-3 py-1 text-sm font-bold flex items-center justify-center min-w-[50px] border-x border-gray-700 bg-gray-800">
                        {Math.round(zoomLevel * 100)}%
                    </div>
                    <button
                        onClick={handleZoomIn}
                        className="p-3 hover:bg-gray-800 active:bg-gray-700 transition-colors"
                        title="Aumentar Escala"
                    >
                        <ZoomIn size={20} />
                    </button>
                </div>

                {/* Rotation Toggle */}
                <div className="flex bg-gray-900 text-white rounded-lg shadow-xl overflow-hidden border border-gray-700">
                    <button
                        onClick={toggleOrientacion}
                        className="p-3 hover:bg-gray-800 active:bg-gray-700 transition-colors"
                        title={`Cambiar a modo ${orientacion === 'horizontal' ? 'vertical' : 'horizontal'}`}
                    >
                        <RotateCw size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DashboardProduccionTVPage;
