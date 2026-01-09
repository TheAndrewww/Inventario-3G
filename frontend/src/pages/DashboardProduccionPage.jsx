import React, { useState, useEffect, useCallback } from 'react';
import {
    Package,
    ShoppingCart,
    Factory,
    Truck,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Plus,
    RefreshCw,
    ChevronRight,
    X,
    Calendar,
    User,
    Circle,
    Download
} from 'lucide-react';
import produccionService from '../services/produccion.service';
import { Loader, Modal, Button } from '../components/common';
import toast from 'react-hot-toast';

// Configuración de etapas con colores e iconos
const ETAPAS_CONFIG = {
    pendiente: {
        nombre: 'Pendiente',
        color: '#9CA3AF',
        bgColor: 'bg-gray-400',
        icon: Circle,
        orden: 0
    },
    diseno: {
        nombre: 'Diseño',
        color: '#8B5CF6',
        bgColor: 'bg-violet-500',
        icon: Package,
        orden: 1
    },
    compras: {
        nombre: 'Compras',
        color: '#10B981',
        bgColor: 'bg-emerald-500',
        icon: ShoppingCart,
        orden: 2
    },
    produccion: {
        nombre: 'Producción',
        color: '#F59E0B',
        bgColor: 'bg-amber-500',
        icon: Factory,
        orden: 3
    },
    instalacion: {
        nombre: 'Instalación',
        color: '#3B82F6',
        bgColor: 'bg-blue-500',
        icon: Truck,
        orden: 4
    },
    completado: {
        nombre: 'Completado',
        color: '#22C55E',
        bgColor: 'bg-green-500',
        icon: CheckCircle2,
        orden: 5
    }
};

const ETAPAS_ORDEN = ['pendiente', 'diseno', 'compras', 'produccion', 'instalacion', 'completado'];

// Componente de línea de tiempo para un proyecto - Diseño Stepper Profesional
const ProyectoTimeline = ({ proyecto, onCompletar }) => {
    const [loading, setLoading] = useState(false);
    const diasRestantes = proyecto.diasRestantes;
    const esUrgente = proyecto.prioridad === 1 || (diasRestantes !== null && diasRestantes <= 3);
    const etapaActualIndex = ETAPAS_ORDEN.indexOf(proyecto.etapa_actual);
    const porcentaje = Math.round((etapaActualIndex / (ETAPAS_ORDEN.length - 1)) * 100);

    // Obtener color de fondo según tipo de proyecto
    const getColorPorTipo = (tipo) => {
        if (!tipo) return { bg: 'bg-white', border: '', label: '' };
        const tipoUpper = tipo.toUpperCase().trim();

        if (tipoUpper === 'MTO') {
            return {
                bg: 'bg-yellow-50',
                border: 'border-l-4 border-yellow-400',
                label: 'MTO',
                labelBg: 'bg-yellow-400 text-yellow-900'
            };
        }
        if (tipoUpper === 'GTIA') {
            return {
                bg: 'bg-red-50',
                border: 'border-l-4 border-red-400',
                label: 'GTIA',
                labelBg: 'bg-red-500 text-white'
            };
        }
        // A, B, C o cualquier otro = blanco
        return {
            bg: 'bg-white',
            border: '',
            label: tipoUpper,
            labelBg: 'bg-gray-200 text-gray-700'
        };
    };

    const colorTipo = getColorPorTipo(proyecto.tipo_proyecto);

    const handleCompletar = async () => {
        if (loading || proyecto.etapa_actual === 'completado') return;
        setLoading(true);
        try {
            await onCompletar(proyecto.id);
        } finally {
            setLoading(false);
        }
    };

    // Solo mostrar etapas principales (sin pendiente)
    const etapasVisibles = ETAPAS_ORDEN.filter(e => e !== 'pendiente');

    return (
        <div
            className={`${colorTipo.bg} ${colorTipo.border} rounded-2xl shadow-lg overflow-hidden mb-5 transition-all hover:shadow-xl ${esUrgente ? 'ring-2 ring-red-400' : ''}`}
        >
            {/* Header con gradiente sutil */}
            <div className={`${colorTipo.bg === 'bg-white' ? 'bg-gradient-to-r from-gray-50 to-white' : ''} px-6 py-4 border-b border-gray-100`}>
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            {/* Badge de tipo de proyecto */}
                            {colorTipo.label && (
                                <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${colorTipo.labelBg}`}>
                                    {colorTipo.label}
                                </span>
                            )}
                            {esUrgente && (
                                <span className="inline-flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full animate-pulse shadow-sm">
                                    <AlertTriangle size={12} />
                                    URGENTE
                                </span>
                            )}
                            {proyecto.prioridad === 2 && !esUrgente && (
                                <span className="inline-flex items-center gap-1 bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                    ALTA
                                </span>
                            )}
                            <span
                                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                                style={{
                                    backgroundColor: `${ETAPAS_CONFIG[proyecto.etapa_actual]?.color}15`,
                                    color: ETAPAS_CONFIG[proyecto.etapa_actual]?.color
                                }}
                            >
                                {ETAPAS_CONFIG[proyecto.etapa_actual]?.nombre}
                            </span>
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 leading-tight">{proyecto.nombre}</h3>
                        {proyecto.cliente && (
                            <p className="text-gray-500 text-sm flex items-center gap-1.5 mt-1">
                                <User size={14} className="text-gray-400" />
                                {proyecto.cliente}
                            </p>
                        )}
                    </div>

                    {/* Indicador de progreso circular */}
                    <div className="flex flex-col items-center">
                        <div className="relative w-16 h-16">
                            {/* Círculo de fondo */}
                            <svg className="w-16 h-16 transform -rotate-90">
                                <circle
                                    cx="32" cy="32" r="28"
                                    stroke="#E5E7EB"
                                    strokeWidth="6"
                                    fill="none"
                                />
                                <circle
                                    cx="32" cy="32" r="28"
                                    stroke={ETAPAS_CONFIG[proyecto.etapa_actual]?.color}
                                    strokeWidth="6"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeDasharray={`${porcentaje * 1.76} 176`}
                                    className="transition-all duration-500"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-lg font-bold text-gray-700">{porcentaje}%</span>
                            </div>
                        </div>
                        {proyecto.fecha_limite && (
                            <div className={`text-center mt-1 ${diasRestantes !== null && diasRestantes <= 3 ? 'text-red-600' : 'text-gray-500'
                                }`}>
                                <div className="flex items-center gap-1 text-xs font-medium">
                                    <Clock size={11} />
                                    {diasRestantes !== null && diasRestantes < 0
                                        ? `Vencido`
                                        : diasRestantes === 0
                                            ? 'Hoy'
                                            : `${diasRestantes}d`
                                    }
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Stepper horizontal mejorado */}
            <div className="px-6 py-5 bg-gray-50">
                <div className="relative">
                    {/* Línea de conexión */}
                    <div className="absolute top-6 left-0 right-0 h-0.5 bg-gray-200" />
                    <div
                        className="absolute top-6 left-0 h-0.5 transition-all duration-700 ease-out"
                        style={{
                            width: `${(etapasVisibles.indexOf(proyecto.etapa_actual) / (etapasVisibles.length - 1)) * 100}%`,
                            backgroundColor: ETAPAS_CONFIG[proyecto.etapa_actual]?.color
                        }}
                    />

                    {/* Etapas */}
                    <div className="relative flex justify-between">
                        {etapasVisibles.map((etapa, index) => {
                            const config = ETAPAS_CONFIG[etapa];
                            const Icon = config.icon;
                            const etapaIndex = ETAPAS_ORDEN.indexOf(etapa);
                            const isCompleted = etapaIndex < etapaActualIndex;
                            const isCurrent = etapa === proyecto.etapa_actual;

                            return (
                                <div key={etapa} className="flex flex-col items-center" style={{ width: '20%' }}>
                                    {/* Círculo de la etapa */}
                                    <div
                                        className={`
                                            w-12 h-12 rounded-full flex items-center justify-center 
                                            transition-all duration-300 shadow-sm
                                            ${isCompleted
                                                ? 'bg-green-500 text-white shadow-green-200'
                                                : isCurrent
                                                    ? 'bg-white text-gray-700 ring-4 shadow-lg'
                                                    : 'bg-white text-gray-400 border-2 border-gray-200'
                                            }
                                        `}
                                        style={isCurrent ? {
                                            ringColor: `${config.color}40`,
                                            boxShadow: `0 0 0 4px ${config.color}25, 0 4px 6px -1px rgba(0, 0, 0, 0.1)`
                                        } : {}}
                                    >
                                        {isCompleted ? (
                                            <CheckCircle2 size={24} />
                                        ) : (
                                            <Icon size={20} style={isCurrent ? { color: config.color } : {}} />
                                        )}
                                    </div>

                                    {/* Nombre de la etapa */}
                                    <span className={`
                                        text-xs font-semibold mt-2 text-center
                                        ${isCompleted ? 'text-green-600' : isCurrent ? 'text-gray-900' : 'text-gray-400'}
                                    `}>
                                        {config.nombre}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Footer con acción */}
            <div className="px-6 py-4 bg-white border-t border-gray-100">
                {proyecto.etapa_actual !== 'completado' ? (
                    <button
                        onClick={handleCompletar}
                        disabled={loading}
                        className={`
                            w-full py-3.5 px-6 rounded-xl text-white font-semibold 
                            flex items-center justify-center gap-2 
                            transition-all duration-200 
                            ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]'}
                        `}
                        style={{
                            backgroundColor: ETAPAS_CONFIG[proyecto.etapa_actual]?.color,
                            boxShadow: `0 4px 14px ${ETAPAS_CONFIG[proyecto.etapa_actual]?.color}40`
                        }}
                    >
                        {loading ? (
                            <RefreshCw size={20} className="animate-spin" />
                        ) : (
                            <>
                                <CheckCircle2 size={20} />
                                <span>Completar {ETAPAS_CONFIG[proyecto.etapa_actual]?.nombre}</span>
                                <ChevronRight size={20} />
                            </>
                        )}
                    </button>
                ) : (
                    <div className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg">
                        <CheckCircle2 size={20} />
                        <span>Proyecto Completado</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// Modal para nuevo proyecto
const ModalNuevoProyecto = ({ isOpen, onClose, onCrear }) => {
    const [formData, setFormData] = useState({
        nombre: '',
        cliente: '',
        descripcion: '',
        prioridad: 3,
        fecha_limite: ''
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.nombre.trim()) {
            toast.error('El nombre es requerido');
            return;
        }

        setLoading(true);
        try {
            await onCrear(formData);
            setFormData({ nombre: '', cliente: '', descripcion: '', prioridad: 3, fecha_limite: '' });
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Nuevo Proyecto de Producción">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre del proyecto *
                    </label>
                    <input
                        type="text"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                        placeholder="Ej: Velaria Residencial García"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cliente
                    </label>
                    <input
                        type="text"
                        value={formData.cliente}
                        onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                        placeholder="Nombre del cliente"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Prioridad
                        </label>
                        <select
                            value={formData.prioridad}
                            onChange={(e) => setFormData({ ...formData, prioridad: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                        >
                            <option value={1}>🔴 Urgente</option>
                            <option value={2}>🟠 Alta</option>
                            <option value={3}>🟡 Normal</option>
                            <option value={4}>🟢 Baja</option>
                            <option value={5}>⚪ Muy baja</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Fecha límite
                        </label>
                        <input
                            type="date"
                            value={formData.fecha_limite}
                            onChange={(e) => setFormData({ ...formData, fecha_limite: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descripción / Notas
                    </label>
                    <textarea
                        value={formData.descripcion}
                        onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                        rows={3}
                        placeholder="Notas adicionales..."
                    />
                </div>

                <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={loading} className="flex-1 bg-violet-600 hover:bg-violet-700">
                        {loading ? 'Creando...' : 'Crear Proyecto'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

// Componente de estadísticas en la parte superior
const EstadisticasHeader = ({ estadisticas }) => {
    const items = [
        { label: 'En Diseño', value: estadisticas.diseno || 0, color: ETAPAS_CONFIG.diseno.color, icon: Package },
        { label: 'En Compras', value: estadisticas.compras || 0, color: ETAPAS_CONFIG.compras.color, icon: ShoppingCart },
        { label: 'En Producción', value: estadisticas.produccion || 0, color: ETAPAS_CONFIG.produccion.color, icon: Factory },
        { label: 'En Instalación', value: estadisticas.instalacion || 0, color: ETAPAS_CONFIG.instalacion.color, icon: Truck },
        { label: 'Completados', value: estadisticas.completado || 0, color: ETAPAS_CONFIG.completado.color, icon: CheckCircle2 },
    ];

    return (
        <div className="grid grid-cols-5 gap-4 mb-6">
            {items.map(item => {
                const Icon = item.icon;
                return (
                    <div
                        key={item.label}
                        className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center"
                    >
                        <div className="flex items-center justify-center mb-2">
                            <div
                                className="w-10 h-10 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: `${item.color}20` }}
                            >
                                <Icon size={20} style={{ color: item.color }} />
                            </div>
                        </div>
                        <div className="text-3xl font-bold" style={{ color: item.color }}>
                            {item.value}
                        </div>
                        <div className="text-sm text-gray-500">{item.label}</div>
                    </div>
                );
            })}
        </div>
    );
};

// Filtros
const FiltrosProyectos = ({ filtro, setFiltro }) => {
    const opciones = [
        { value: 'todos', label: 'Todos' },
        { value: 'activos', label: 'En Proceso' },
        { value: 'urgentes', label: '🔴 Urgentes' },
        { value: 'completados', label: '✅ Completados' }
    ];

    return (
        <div className="flex gap-2 mb-4">
            {opciones.map(op => (
                <button
                    key={op.value}
                    onClick={() => setFiltro(op.value)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${filtro === op.value
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    {op.label}
                </button>
            ))}
        </div>
    );
};

// Página principal del Dashboard
const DashboardProduccionPage = () => {
    const [loading, setLoading] = useState(true);
    const [proyectos, setProyectos] = useState([]);
    const [estadisticas, setEstadisticas] = useState({});
    const [filtro, setFiltro] = useState('activos');
    const [sincronizando, setSincronizando] = useState(false);
    const [ultimaSync, setUltimaSync] = useState(null);

    const cargarDatos = useCallback(async () => {
        try {
            setLoading(true);
            const response = await produccionService.obtenerDashboard();
            if (response.success) {
                // Combinar todos los proyectos de todas las etapas
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
        // Sincronizar automáticamente al cargar
        const sincronizarYCargar = async () => {
            try {
                setSincronizando(true);
                await produccionService.sincronizarConSheets();
                setUltimaSync(new Date());
            } catch (error) {
                console.error('Error en sincronización automática:', error);
            } finally {
                setSincronizando(false);
            }
            await cargarDatos();
        };

        sincronizarYCargar();

        // Auto-refresh cada 5 minutos (sincroniza y recarga)
        const interval = setInterval(sincronizarYCargar, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [cargarDatos]);

    const handleCompletar = async (proyectoId) => {
        try {
            const response = await produccionService.completarEtapa(proyectoId);
            if (response.success) {
                toast.success(response.message);
                cargarDatos();
            }
        } catch (error) {
            console.error('Error al completar etapa:', error);
            toast.error('Error al completar etapa');
        }
    };

    const handleSincronizar = async () => {
        try {
            setSincronizando(true);
            const response = await produccionService.sincronizarConSheets();
            if (response.success) {
                toast.success(
                    `Sincronizado: ${response.data.creados} nuevos, ${response.data.actualizados} actualizados`,
                    { duration: 5000 }
                );
                setUltimaSync(new Date());
                cargarDatos();
            }
        } catch (error) {
            console.error('Error al sincronizar:', error);
            toast.error('Error al sincronizar con Google Sheets');
        } finally {
            setSincronizando(false);
        }
    };

    // Filtrar proyectos
    const proyectosFiltrados = proyectos.filter(p => {
        switch (filtro) {
            case 'activos':
                return p.etapa_actual !== 'completado' && p.etapa_actual !== 'pendiente';
            case 'urgentes':
                return p.prioridad === 1 || (p.diasRestantes !== null && p.diasRestantes <= 3);
            case 'completados':
                return p.etapa_actual === 'completado';
            default:
                return true;
        }
    }).sort((a, b) => {
        // Ordenar por prioridad primero, luego por días restantes
        if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad;
        if (a.diasRestantes === null) return 1;
        if (b.diasRestantes === null) return -1;
        return a.diasRestantes - b.diasRestantes;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader size="lg" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">🏭 Dashboard de Producción</h1>
                    <p className="text-gray-600 mt-1">
                        Seguimiento visual de proyectos por etapas
                    </p>
                </div>

                <div className="flex gap-3 items-center">
                    {ultimaSync && (
                        <span className="text-xs text-gray-400">
                            Actualizado: {ultimaSync.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    <button
                        onClick={handleSincronizar}
                        disabled={sincronizando}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        title="Sincronizar con Google Sheets"
                    >
                        {sincronizando ? (
                            <RefreshCw size={18} className="animate-spin" />
                        ) : (
                            <Download size={18} />
                        )}
                        {sincronizando ? 'Sincronizando...' : 'Sincronizar'}
                    </button>
                </div>
            </div>

            {/* Estadísticas */}
            <EstadisticasHeader estadisticas={estadisticas} />

            {/* Alerta de urgentes */}
            {estadisticas.urgentes > 0 && (
                <div className="bg-red-100 border-2 border-red-300 rounded-xl p-4 mb-6 flex items-center gap-3">
                    <AlertTriangle size={24} className="text-red-600" />
                    <span className="font-medium text-red-800">
                        {estadisticas.urgentes} proyecto(s) urgente(s) o próximos a vencer
                    </span>
                </div>
            )}

            {/* Filtros */}
            <FiltrosProyectos filtro={filtro} setFiltro={setFiltro} />

            {/* Lista de proyectos como timeline */}
            <div className="space-y-4">
                {proyectosFiltrados.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-xl">
                        <Package size={64} className="mx-auto mb-4 text-gray-300" />
                        <h2 className="text-xl font-semibold text-gray-500">No hay proyectos</h2>
                        <p className="text-gray-400 mt-1">
                            {filtro === 'todos'
                                ? 'Crea tu primer proyecto de producción'
                                : 'No hay proyectos con este filtro'}
                        </p>
                    </div>
                ) : (
                    proyectosFiltrados.map(proyecto => (
                        <ProyectoTimeline
                            key={proyecto.id}
                            proyecto={proyecto}
                            onCompletar={handleCompletar}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default DashboardProduccionPage;
