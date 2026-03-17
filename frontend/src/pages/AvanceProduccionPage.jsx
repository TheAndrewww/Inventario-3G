import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
    Search,
    RefreshCw,
    CheckCircle2,
    Circle,
    ChevronRight,
    AlertTriangle,
    Clock,
    Factory,
    Scissors,
    Wrench,
    Package,
    ShoppingCart,
    Truck,
    Star,
    Filter,
    X
} from 'lucide-react';
import produccionService from '../services/produccion.service';
import { flattenProyectos, sortProyectosPorUrgencia } from '../utils/produccion';
import toast, { Toaster } from 'react-hot-toast';

// ─── Configuración de etapas ───
const ETAPAS_FLOW = [
    { key: 'manufactura', label: 'Mfra', icon: Factory, color: '#F59E0B', bgClass: 'bg-amber-50', textClass: 'text-amber-700', borderClass: 'border-amber-200', isSubEtapa: true },
    { key: 'herreria', label: 'Herr', icon: Scissors, color: '#EF4444', bgClass: 'bg-red-50', textClass: 'text-red-700', borderClass: 'border-red-200', isSubEtapa: true },
];

// Orden de etapas para determinar si están completadas
const ETAPAS_ORDEN = ['pendiente', 'diseno', 'compras', 'produccion', 'instalacion', 'completado'];

/**
 * Determina si una etapa está completada basándose en los timestamps del proyecto
 */
const isEtapaCompletada = (proyecto, etapaKey) => {
    switch (etapaKey) {
        case 'diseno':
            return !!proyecto.diseno_completado_en;
        case 'compras':
            return !!proyecto.compras_completado_en;
        case 'manufactura':
            return !!(proyecto.manufactura_completado || proyecto.manufactura_completado_en);
        case 'herreria':
            return !!(proyecto.herreria_completado || proyecto.herreria_completado_en);
        case 'instalacion':
            return !!proyecto.instalacion_completado_en || proyecto.etapa_actual === 'completado';
        default:
            return false;
    }
};

/**
 * Determina si una etapa es la siguiente que puede marcarse
 */
const isEtapaActiva = (proyecto, etapaKey) => {
    // Sub-etapas: manufactura / herrería
    if (etapaKey === 'manufactura' || etapaKey === 'herreria') {
        if (!proyecto.compras_completado_en) return false;
        if (etapaKey === 'manufactura' && !proyecto.tiene_manufactura) return false;
        if (etapaKey === 'herreria' && !proyecto.tiene_herreria) return false;
        return !isEtapaCompletada(proyecto, etapaKey);
    }

    // Instalación: requiere que ambas sub-etapas completadas
    if (etapaKey === 'instalacion') {
        const manOk = !proyecto.tiene_manufactura || isEtapaCompletada(proyecto, 'manufactura');
        const herOk = !proyecto.tiene_herreria || isEtapaCompletada(proyecto, 'herreria');
        const tieneProduccion = proyecto.tiene_manufactura || proyecto.tiene_herreria;
        if (tieneProduccion) {
            return manOk && herOk && !isEtapaCompletada(proyecto, 'instalacion');
        } else {
            return isEtapaCompletada(proyecto, 'compras') && !isEtapaCompletada(proyecto, 'instalacion');
        }
    }

    return false;
};

/**
 * Determina si una etapa es visible (aplicable) para el proyecto
 */
const isEtapaVisible = (proyecto, etapaKey) => {
    if (etapaKey === 'manufactura') return !!proyecto.tiene_manufactura;
    if (etapaKey === 'herreria') return !!proyecto.tiene_herreria;
    return true;
};

// ─── Modal de confirmación ───
const ConfirmModal = ({ isOpen, etapa, proyecto, onConfirm, onCancel, loading }) => {
    if (!isOpen || !etapa) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCancel}>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
            <div
                className="relative bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden animate-slide-up"
                onClick={e => e.stopPropagation()}
            >
                {/* Handle bar para móvil */}
                <div className="sm:hidden flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>

                <div className="p-6 text-center">
                    <div
                        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                        style={{ backgroundColor: `${etapa.color}15` }}
                    >
                        <etapa.icon size={32} style={{ color: etapa.color }} />
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                        ¿Marcar como completado?
                    </h3>
                    <p className="text-gray-500 text-sm mb-1">
                        <span className="font-semibold text-gray-700">{etapa.label}</span> — {proyecto?.nombre}
                    </p>
                    <p className="text-xs text-amber-600 font-medium mb-6">
                        ⚠️ Esta acción no se puede deshacer
                    </p>

                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            disabled={loading}
                            className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-base hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={loading}
                            className="flex-1 py-3 px-4 rounded-xl text-white font-semibold text-base transition-all active:scale-95"
                            style={{ backgroundColor: etapa.color }}
                        >
                            {loading ? (
                                <RefreshCw size={20} className="animate-spin mx-auto" />
                            ) : (
                                '✓ Completar'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Botón de etapa ───
const EtapaButton = ({ etapa, completada, activa, onClick }) => {
    const Icon = etapa.icon;

    if (completada) {
        return (
            <button
                disabled
                className="flex flex-col items-center gap-1 opacity-80"
            >
                <div className="w-11 h-11 rounded-full bg-green-100 border-2 border-green-300 flex items-center justify-center shadow-sm">
                    <CheckCircle2 size={22} className="text-green-600" />
                </div>
                <span className="text-[10px] font-semibold text-green-600 leading-tight">{etapa.label}</span>
            </button>
        );
    }

    if (activa) {
        return (
            <button
                onClick={onClick}
                className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
            >
                <div
                    className="w-11 h-11 rounded-full border-2 flex items-center justify-center shadow-md animate-pulse-subtle"
                    style={{ backgroundColor: `${etapa.color}15`, borderColor: etapa.color }}
                >
                    <Icon size={20} style={{ color: etapa.color }} />
                </div>
                <span className="text-[10px] font-bold leading-tight" style={{ color: etapa.color }}>{etapa.label}</span>
            </button>
        );
    }

    // Futura (deshabilitada)
    return (
        <button disabled className="flex flex-col items-center gap-1 opacity-30">
            <div className="w-11 h-11 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
                <Icon size={20} className="text-gray-400" />
            </div>
            <span className="text-[10px] font-medium text-gray-400 leading-tight">{etapa.label}</span>
        </button>
    );
};

// ─── Tarjeta de proyecto ───
const ProyectoCard = ({ proyecto, onMarcarEtapa }) => {
    const diasRestantes = proyecto.diasRestantes;
    const esUrgente = proyecto.prioridad === 1 || (diasRestantes !== null && diasRestantes < 0);
    const esAdvertencia = diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 3;

    // Etapas visibles para este proyecto
    const etapasVisibles = ETAPAS_FLOW.filter(e => isEtapaVisible(proyecto, e.key));

    // Determinar la etapa actual para mostrar
    const etapaActualConfig = ETAPAS_FLOW.find(e => {
        if (e.key === 'manufactura' || e.key === 'herreria') return false;
        if (e.key === 'instalacion' && proyecto.etapa_actual === 'instalacion') return true;
        if (e.key === 'compras' && proyecto.etapa_actual === 'compras') return true;
        if (e.key === 'compras' && proyecto.etapa_actual === 'produccion') return false;
        if (e.key === 'diseno' && proyecto.etapa_actual === 'diseno') return true;
        return false;
    });

    // Badge de etapa actual
    const etapaActualLabel = (() => {
        const ea = proyecto.etapa_actual;
        if (ea === 'produccion') return 'Producción';
        if (ea === 'instalacion') return 'Instalación';
        if (ea === 'compras') return 'Compras';
        if (ea === 'diseno') return 'Diseño';
        if (ea === 'completado') return 'Completado';
        if (ea === 'pendiente') return 'Pendiente';
        return ea;
    })();

    return (
        <div className={`bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition-all ${
            esUrgente ? 'border-red-300 shadow-red-100' :
            esAdvertencia ? 'border-amber-200 shadow-amber-50' :
            'border-gray-100'
        }`}>
            {/* Header */}
            <div className="px-4 pt-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">
                            {proyecto.nombre}
                        </h3>
                        {proyecto.cliente && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{proyecto.cliente}</p>
                        )}
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        esUrgente ? 'bg-red-100 text-red-700' :
                        esAdvertencia ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                    }`}>
                        {etapaActualLabel}
                    </span>
                </div>

                {/* Info row */}
                <div className="flex items-center gap-3 mt-2 text-xs">
                    {proyecto.tipo_proyecto && (
                        <span className="font-semibold text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                            Tipo {proyecto.tipo_proyecto}
                        </span>
                    )}
                    {diasRestantes !== null && (
                        <span className={`flex items-center gap-1 font-semibold ${
                            diasRestantes < 0 ? 'text-red-600' :
                            diasRestantes <= 3 ? 'text-amber-600' :
                            'text-gray-500'
                        }`}>
                            <Clock size={12} />
                            {diasRestantes < 0
                                ? `${Math.abs(diasRestantes)}d atraso`
                                : diasRestantes === 0
                                    ? 'Hoy'
                                    : `${diasRestantes}d`
                            }
                        </span>
                    )}
                    {esUrgente && (
                        <span className="flex items-center gap-0.5 text-red-600 font-bold">
                            <AlertTriangle size={12} />
                            Urgente
                        </span>
                    )}
                </div>
            </div>

            {/* Etapas row */}
            <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100">
                <div className="flex items-center justify-between gap-1">
                    {etapasVisibles.map((etapa, i) => (
                        <React.Fragment key={etapa.key}>
                            {i > 0 && (
                                <ChevronRight size={12} className="text-gray-300 shrink-0 -mx-0.5" />
                            )}
                            <EtapaButton
                                etapa={etapa}
                                completada={isEtapaCompletada(proyecto, etapa.key)}
                                activa={isEtapaActiva(proyecto, etapa.key)}
                                onClick={() => onMarcarEtapa(proyecto, etapa)}
                            />
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ─── Filtros rápidos ───

// ─── Página principal ───
const AvanceProduccionPage = () => {
    const [proyectos, setProyectos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const [confirmModal, setConfirmModal] = useState({ open: false, proyecto: null, etapa: null });
    const [procesando, setProcesando] = useState(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // Cargar proyectos
    const cargarProyectos = useCallback(async (showLoader = true) => {
        try {
            if (showLoader) setLoading(true);
            else setRefreshing(true);

            const response = await produccionService.obtenerDashboard();
            if (response.success && mountedRef.current) {
                const proys = flattenProyectos(response.data.resumen);
                setProyectos(proys);
            }
        } catch (error) {
            console.error('Error loading projects:', error);
            toast.error('Error al cargar proyectos');
        } finally {
            if (mountedRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, []);

    useEffect(() => {
        cargarProyectos();
        const interval = setInterval(() => cargarProyectos(false), 30000);
        return () => clearInterval(interval);
    }, [cargarProyectos]);

    // Filtrar proyectos
    const proyectosFiltrados = useMemo(() => {
        // Solo mostrar proyectos con manufactura o herrería desbloqueadas
        let filtered = proyectos.filter(p =>
            !p.pausado &&
            p.etapa_actual === 'produccion' &&
            !!p.compras_completado_en &&
            (
                (p.tiene_manufactura && !p.manufactura_completado && !p.manufactura_completado_en) ||
                (p.tiene_herreria && !p.herreria_completado && !p.herreria_completado_en)
            )
        );

        // Búsqueda
        if (busqueda.trim()) {
            const q = busqueda.toLowerCase();
            filtered = filtered.filter(p =>
                p.nombre?.toLowerCase().includes(q) ||
                p.cliente?.toLowerCase().includes(q)
            );
        }


        return sortProyectosPorUrgencia(filtered);
    }, [proyectos, busqueda]);

    // Abrir modal
    const handleMarcarEtapa = (proyecto, etapa) => {
        setConfirmModal({ open: true, proyecto, etapa });
    };

    // Confirmar marcación
    const handleConfirm = async () => {
        const { proyecto, etapa } = confirmModal;
        if (!proyecto || !etapa) return;

        setProcesando(true);
        try {
            if (etapa.isSubEtapa) {
                // Sub-etapas: manufactura / herrería
                await produccionService.completarSubEtapa(proyecto.id, etapa.key);
            } else {
                // Etapas normales: toggle solo para completar (nunca desmarcar)
                await produccionService.toggleEtapa(proyecto.id, etapa.key, true);
            }

            toast.success(
                <div className="text-center">
                    <span className="font-bold">{etapa.label}</span> completado ✅
                </div>,
                { duration: 2000 }
            );

            setConfirmModal({ open: false, proyecto: null, etapa: null });
            await cargarProyectos(false);
        } catch (error) {
            console.error('Error marking stage:', error);
            toast.error(error.response?.data?.message || 'Error al marcar etapa');
        } finally {
            setProcesando(false);
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw size={40} className="animate-spin text-blue-500 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">Cargando proyectos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Toaster position="top-center" toastOptions={{ duration: 2000, style: { borderRadius: '12px' } }} />

            {/* ─── Header fijo ─── */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
                <div className="px-4 pt-4 pb-3">
                    {/* Título y refresh */}
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Avance Producción</h1>
                            <p className="text-xs text-gray-500">
                                {proyectosFiltrados.length} proyecto{proyectosFiltrados.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                        <button
                            onClick={() => cargarProyectos(false)}
                            disabled={refreshing}
                            className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                        >
                            <RefreshCw size={20} className={`text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {/* Barra de búsqueda */}
                    <div className="relative mb-3">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar proyecto..."
                            className="w-full pl-10 pr-10 py-2.5 bg-gray-100 rounded-xl text-sm border-0 focus:ring-2 focus:ring-blue-200 focus:bg-white transition-all"
                        />
                        {busqueda && (
                            <button
                                onClick={() => setBusqueda('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2"
                            >
                                <X size={16} className="text-gray-400" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Lista de proyectos ─── */}
            <div className="px-4 py-4 space-y-3 pb-20">
                {proyectosFiltrados.length === 0 ? (
                    <div className="text-center py-16">
                        <CheckCircle2 size={48} className="text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">
                            {busqueda ? 'Sin resultados' : 'No hay proyectos pendientes'}
                        </p>
                        {busqueda && (
                            <button
                                onClick={() => setBusqueda('')}
                                className="text-blue-600 text-sm mt-2 font-medium"
                            >
                                Limpiar búsqueda
                            </button>
                        )}
                    </div>
                ) : (
                    proyectosFiltrados.map(proyecto => (
                        <ProyectoCard
                            key={proyecto.id}
                            proyecto={proyecto}
                            onMarcarEtapa={handleMarcarEtapa}
                        />
                    ))
                )}
            </div>

            {/* ─── Modal de confirmación ─── */}
            <ConfirmModal
                isOpen={confirmModal.open}
                etapa={confirmModal.etapa}
                proyecto={confirmModal.proyecto}
                onConfirm={handleConfirm}
                onCancel={() => setConfirmModal({ open: false, proyecto: null, etapa: null })}
                loading={procesando}
            />

            {/* CSS animations */}
            <style>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up {
                    animation: slide-up 0.25s ease-out;
                }
                @keyframes pulse-subtle {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.3); }
                    50% { box-shadow: 0 0 0 6px rgba(59, 130, 246, 0); }
                }
                .animate-pulse-subtle {
                    animation: pulse-subtle 2s ease-in-out infinite;
                }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

export default AvanceProduccionPage;
