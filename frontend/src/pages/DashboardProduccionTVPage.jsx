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
    const esUrgente = proyecto.prioridad === 1 || esGarantia || (diasRestantes !== null && diasRestantes <= 3);
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

    // Ajustes vertical styling hardcoded
    return (
        <div className={`${colorTipo.bg} ${colorTipo.border} overflow-hidden transition-all ${esUrgente ? 'ring-2 ring-red-400' : ''} rounded-lg shadow-sm mb-1`}>
            {/* Header */}
            <div className={`${colorTipo.bg === 'bg-white' ? 'bg-gradient-to-r from-gray-50 to-white' : ''} px-2 py-1 border-b border-gray-100`}>
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-1 mb-1">
                            {colorTipo.label && <span className={`inline-flex items-center text-xs px-2 py-0.5 font-bold rounded-full ${colorTipo.labelBg}`}>{colorTipo.label}</span>}
                            {esUrgente && <span className="inline-flex items-center gap-1 bg-red-500 text-white text-xs px-2 py-0.5 font-bold rounded-full">!</span>}
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 font-semibold rounded-full" style={{ backgroundColor: `${ETAPAS_CONFIG[proyecto.etapa_actual]?.color}15`, color: ETAPAS_CONFIG[proyecto.etapa_actual]?.color }}>
                                {ETAPAS_CONFIG[proyecto.etapa_actual]?.nombre}
                            </span>
                        </div>
                        <h3 className="font-bold text-3xl text-gray-900 leading-tight truncate">{proyecto.nombre}</h3>
                        {proyecto.cliente && (
                            <p className="text-2xl mt-2 text-gray-500 flex items-center gap-1.5">
                                <User size={22} className="text-gray-400" />
                                {proyecto.cliente}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="relative w-16 h-16">
                            <svg className="w-16 h-16 transform -rotate-90">
                                <circle cx="32" cy="32" r="28" stroke="#E5E7EB" strokeWidth="6" fill="none" />
                                <circle cx="32" cy="32" r="28" stroke={ETAPAS_CONFIG[proyecto.etapa_actual]?.color} strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={`${porcentaje * 1.76} 176`} className="transition-all duration-500" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-lg font-bold text-gray-700">{porcentaje}%</span>
                            </div>
                        </div>
                        {proyecto.fecha_limite && (
                            <div className={`text-center mt-1 text-xs font-medium ${diasRestantes <= 3 ? 'text-red-600' : 'text-gray-500'}`}>
                                <div className="flex items-center gap-1"><Clock size={11} />{diasRestantes < 0 ? 'Vencido' : diasRestantes === 0 ? 'Hoy' : `${diasRestantes}d`}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Stepper Vertical */}
            <div className="px-3 py-3 bg-gray-50 relative overflow-visible" style={{ height: '160px' }}>
                {proyecto.fecha_limite && (
                    <div className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-0.5 px-4 py-3 origin-right rounded-xl shadow-md ${diasRestantes < 0 ? 'bg-red-100 text-red-700 border border-red-200' : diasRestantes <= 3 ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-white text-gray-700 border border-gray-200'}`}>
                        <Calendar size={20} className="mb-1" />
                        <span className="text-2xl font-bold">{new Date(proyecto.fecha_limite).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
                        <span className={`text-lg font-semibold ${diasRestantes < 0 ? 'text-red-600' : diasRestantes <= 3 ? 'text-amber-600' : 'text-gray-500'}`}>{diasRestantes < 0 ? 'Venc' : diasRestantes === 0 ? 'Hoy' : `${diasRestantes}d`}</span>
                    </div>
                )}

                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* Simplified connection logic for vertical only */}
                    {(() => {
                        const POS = { P1: 8, P2: 24, P3: 40, P4: 56, P5: 72 };
                        const getStrokeColor = (baseStage) => ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > ETAPAS_ORDEN.indexOf(baseStage) ? '#10B981' : '#CBD5E1';
                        // Hardcoded simplified paths
                        return (
                            <>
                                <line x1={POS.P1} y1="40" x2={POS.P2} y2="40" stroke={getStrokeColor('diseno')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                <line x1={POS.P2} y1="40" x2={POS.P4} y2="40" stroke={getStrokeColor('compras')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                <line x1={POS.P4} y1="40" x2={POS.P5} y2="40" stroke={getStrokeColor('instalacion')} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                            </>
                        )
                    })()}
                </svg>

                {/* Nodes */}
                {(() => {
                    const POS = { P1: '8%', P2: '24%', P3: '40%', P4: '56%', P5: '72%' };
                    return (
                        <>
                            <div className="absolute top-[40%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: POS.P1 }}>
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-md ${ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 1 ? 'bg-green-500 text-white' : 'bg-white border-2 border-gray-200 text-gray-400'}`}>
                                    {ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 1 ? <CheckCircle2 size={28} /> : <Package size={26} />}
                                </div>
                                <span className="absolute top-16 text-3xl font-bold text-gray-600 bg-gray-50 px-1">Diseño</span>
                            </div>
                            <div className="absolute top-[40%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: POS.P2 }}>
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-md ${ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 2 ? 'bg-green-500 text-white' : 'bg-white border-2 border-gray-200 text-gray-400'}`}>
                                    {ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 2 ? <CheckCircle2 size={28} /> : <ShoppingCart size={26} />}
                                </div>
                                <span className="absolute top-16 text-3xl font-bold text-gray-600 bg-gray-50 px-1">Compras</span>
                            </div>
                            {/* Producción Node (generic or detailed, keeping simple for now based on prev file but omitting sub-stage complexity for speed if not critical, adding back simple version) */}
                            <div className="absolute top-[40%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: POS.P3 }}>
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-md ${ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 3 ? 'bg-green-500 text-white' : 'bg-white border-2 border-gray-200 text-gray-400'}`}>
                                    {ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 3 ? <CheckCircle2 size={28} /> : <Factory size={26} />}
                                </div>
                                <span className="absolute top-16 text-3xl font-bold text-gray-600 bg-gray-50 px-1">Producción</span>
                            </div>
                            <div className="absolute top-[40%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: POS.P4 }}>
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-md ${ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 4 ? 'bg-green-500 text-white' : 'bg-white border-2 border-gray-200 text-gray-400'}`}>
                                    {ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 4 ? <CheckCircle2 size={28} /> : <Truck size={26} />}
                                </div>
                                <span className="absolute top-16 text-3xl font-bold text-gray-600 bg-gray-50 px-1">Instalación</span>
                            </div>
                            <div className="absolute top-[40%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: POS.P5 }}>
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-md ${proyecto.etapa_actual === 'completado' ? 'bg-green-500 text-white' : 'bg-white border-2 border-gray-200 text-gray-400'}`}>
                                    <CheckCircle2 size={28} />
                                </div>
                                <span className="absolute top-16 text-3xl font-bold text-gray-600 bg-gray-50 px-1">Fin</span>
                            </div>
                        </>
                    )
                })()}
            </div>
            {proyecto.etapa_actual === 'produccion' && proyecto.estadoSubEtapas && !proyecto.estadoSubEtapas.ambosCompletados && (
                <div className="px-6 py-3 bg-amber-50 border-t border-amber-100 flex justify-center gap-8 text-xl">
                    <div className="flex items-center gap-2">
                        <div className={`w-3.5 h-3.5 rounded-full ${proyecto.estadoSubEtapas.manufactura?.completado ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className={proyecto.estadoSubEtapas.manufactura?.completado ? 'text-green-700 font-medium line-through' : 'text-gray-500'}>Manufactura</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-3.5 h-3.5 rounded-full ${proyecto.estadoSubEtapas.herreria?.completado ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className={proyecto.estadoSubEtapas.herreria?.completado ? 'text-green-700 font-medium line-through' : 'text-gray-500'}>Herrería</span>
                    </div>
                </div>
            )}
        </div>
    );
};

const EstadisticasHeaderTV = ({ estadisticas }) => {
    const items = [
        { label: 'En Diseño', value: estadisticas.diseno || 0, color: ETAPAS_CONFIG.diseno.color, icon: Package },
        { label: 'En Compras', value: estadisticas.compras || 0, color: ETAPAS_CONFIG.compras.color, icon: ShoppingCart },
        { label: 'En Producción', value: estadisticas.produccion || 0, color: ETAPAS_CONFIG.produccion.color, icon: Factory },
        { label: 'En Instalación', value: estadisticas.instalacion || 0, color: ETAPAS_CONFIG.instalacion.color, icon: Truck },
        { label: 'Completados', value: estadisticas.completado || 0, color: ETAPAS_CONFIG.completado.color, icon: CheckCircle2 },
    ];

    return (
        <div className="grid grid-cols-5 gap-2 mb-6">
            {items.map(item => {
                const Icon = item.icon;
                return (
                    <div key={item.label} className="bg-white rounded-xl shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center p-2 py-6 min-h-[220px]">
                        <div className="flex items-center justify-center mb-2">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${item.color}20` }}>
                                <Icon size={24} style={{ color: item.color }} />
                            </div>
                        </div>
                        <div className="text-4xl font-bold" style={{ color: item.color }}>{item.value}</div>
                        <div className="text-lg font-bold leading-tight text-gray-500">{item.label}</div>
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
        const savedZoom = localStorage.getItem('dashboardTVZoomLevel');
        return savedZoom ? parseInt(savedZoom, 10) : 100;
    });

    const [orientacion, setOrientacion] = useState(() => {
        return localStorage.getItem('dashboardTVOrientation') || 'horizontal';
    });

    useEffect(() => {
        localStorage.setItem('dashboardTVZoomLevel', zoomLevel.toString());
    }, [zoomLevel]);

    useEffect(() => {
        localStorage.setItem('dashboardTVOrientation', orientacion);
    }, [orientacion]);

    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 10, 200));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 10, 30));
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

    // Filtrar completados viejos o irrelevantes si es necesario, por ahora muestra activos
    const proyectosActivos = proyectos.filter(p => p.etapa_actual !== 'completado').sort((a, b) => (a.prioridad || 3) - (b.prioridad || 3));

    if (loading && proyectos.length === 0) {
        return <div className="flex items-center justify-center h-screen"><Loader size="lg" /></div>;
    }

    return (
        <div
            className="min-h-screen bg-gray-50 p-4 fixed inset-0 z-50 overflow-auto transition-all duration-300"
            style={orientacion === 'vertical' ? {
                transform: 'rotate(90deg)',
                transformOrigin: 'center center',
                width: '100vh',
                height: '100vw',
                position: 'fixed',
                top: '50%',
                left: '50%',
                marginTop: '-50vw',
                marginLeft: '-50vh',
                zoom: `${zoomLevel}%`
            } : { zoom: `${zoomLevel}%` }}
        >
            <Toaster position="top-right" />

            {/* Header / Info de Sync */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">🏭 Dashboard de Producción - Monitor TV</h1>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    {sincronizando && <RefreshCw size={16} className="animate-spin" />}
                    <span>{sincronizando ? 'Sincronizando...' : 'Actualizado en tiempo real'}</span>
                </div>
            </div>

            <EstadisticasHeaderTV estadisticas={estadisticas} />

            <div className="space-y-4">
                {proyectosActivos.map(proyecto => (
                    <ProyectoTimeline key={proyecto.id} proyecto={proyecto} />
                ))}
                {proyectosActivos.length === 0 && (
                    <div className="text-center py-20 text-gray-500 text-2xl font-bold">
                        No hay proyectos activos en producción
                    </div>
                )}
            </div>

            {/* Floating Zoom Controls */}
            <div className={`fixed z-50 flex gap-2 ${orientacion === 'vertical' ? 'bottom-4 left-4' : 'bottom-4 right-4'}`}>
                <div className="flex bg-gray-800 text-white rounded-lg shadow-lg overflow-hidden">
                    <button onClick={handleZoomOut} className="p-3 hover:bg-gray-700 transition-colors" title="Reducir Zoom (-)"><ZoomOut size={20} /></button>
                    <div className="px-3 py-1 text-sm font-bold flex items-center justify-center min-w-[50px] border-x border-gray-700">{zoomLevel}%</div>
                    <button onClick={handleZoomIn} className="p-3 hover:bg-gray-700 transition-colors" title="Aumentar Zoom (+)"><ZoomIn size={20} /></button>
                </div>

                <div className="flex bg-gray-800 text-white rounded-lg shadow-lg overflow-hidden">
                    <button
                        onClick={toggleOrientacion}
                        className="p-3 hover:bg-gray-700 transition-colors"
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
