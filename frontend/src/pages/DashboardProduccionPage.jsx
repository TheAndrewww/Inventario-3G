import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
    User
} from 'lucide-react';
import produccionService from '../services/produccion.service';
import { Loader, Modal, Button } from '../components/common';
import toast from 'react-hot-toast';

// Configuración de etapas con colores e iconos
const ETAPAS_CONFIG = {
    diseno: {
        nombre: 'Diseño',
        color: '#8B5CF6',
        bgColor: 'bg-violet-500',
        bgLight: 'bg-violet-50',
        borderColor: 'border-violet-300',
        icon: Package
    },
    compras: {
        nombre: 'Compras',
        color: '#10B981',
        bgColor: 'bg-emerald-500',
        bgLight: 'bg-emerald-50',
        borderColor: 'border-emerald-300',
        icon: ShoppingCart
    },
    produccion: {
        nombre: 'Producción',
        color: '#F59E0B',
        bgColor: 'bg-amber-500',
        bgLight: 'bg-amber-50',
        borderColor: 'border-amber-300',
        icon: Factory
    },
    instalacion: {
        nombre: 'Instalación',
        color: '#3B82F6',
        bgColor: 'bg-blue-500',
        bgLight: 'bg-blue-50',
        borderColor: 'border-blue-300',
        icon: Truck
    },
    completado: {
        nombre: 'Completado',
        color: '#22C55E',
        bgColor: 'bg-green-500',
        bgLight: 'bg-green-50',
        borderColor: 'border-green-300',
        icon: CheckCircle2
    }
};

// Componente de tarjeta de proyecto
const ProyectoCard = ({ proyecto, onCompletar, etapa }) => {
    const [loading, setLoading] = useState(false);
    const diasRestantes = proyecto.diasRestantes;
    const esUrgente = proyecto.prioridad === 1 || (diasRestantes !== null && diasRestantes <= 3);

    const handleCompletar = async () => {
        if (loading) return;
        setLoading(true);
        try {
            await onCompletar(proyecto.id);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`bg-white rounded-xl shadow-sm border-2 p-4 mb-3 transition-all hover:shadow-md ${esUrgente ? 'border-red-300 bg-red-50' : 'border-gray-200'
            }`}>
            {/* Header con prioridad */}
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                    {proyecto.prioridad === 1 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                            URGENTE
                        </span>
                    )}
                    {proyecto.prioridad <= 2 && proyecto.prioridad !== 1 && (
                        <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                            ALTA
                        </span>
                    )}
                </div>
                <span className="text-xs text-gray-400">#{proyecto.id}</span>
            </div>

            {/* Nombre del proyecto */}
            <h3 className="font-semibold text-gray-900 text-lg mb-1 line-clamp-2">
                {proyecto.nombre}
            </h3>

            {/* Cliente */}
            {proyecto.cliente && (
                <p className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                    <User size={14} />
                    {proyecto.cliente}
                </p>
            )}

            {/* Fecha límite */}
            {proyecto.fecha_limite && (
                <div className={`flex items-center gap-1 text-sm mb-3 ${diasRestantes !== null && diasRestantes <= 3
                        ? 'text-red-600 font-medium'
                        : 'text-gray-500'
                    }`}>
                    <Clock size={14} />
                    {diasRestantes !== null && diasRestantes < 0
                        ? `Vencido hace ${Math.abs(diasRestantes)} días`
                        : diasRestantes === 0
                            ? 'Vence hoy'
                            : diasRestantes !== null
                                ? `${diasRestantes} días restantes`
                                : new Date(proyecto.fecha_limite).toLocaleDateString('es-MX')
                    }
                </div>
            )}

            {/* Barra de progreso */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                <div
                    className="h-2 rounded-full transition-all"
                    style={{
                        width: `${proyecto.porcentaje}%`,
                        backgroundColor: ETAPAS_CONFIG[etapa]?.color || '#6B7280'
                    }}
                />
            </div>

            {/* Botón completar */}
            {etapa !== 'completado' && (
                <button
                    onClick={handleCompletar}
                    disabled={loading}
                    className={`w-full py-2 px-4 rounded-lg text-white font-medium flex items-center justify-center gap-2 transition-all ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
                        }`}
                    style={{ backgroundColor: ETAPAS_CONFIG[etapa]?.color }}
                >
                    {loading ? (
                        <RefreshCw size={16} className="animate-spin" />
                    ) : (
                        <>
                            <CheckCircle2 size={16} />
                            Completar {ETAPAS_CONFIG[etapa]?.nombre}
                        </>
                    )}
                </button>
            )}
        </div>
    );
};

// Componente de columna de etapa
const EtapaColumna = ({ etapa, proyectos, onCompletar }) => {
    const config = ETAPAS_CONFIG[etapa];
    const Icon = config?.icon || Package;

    return (
        <div className={`flex-1 min-w-[280px] max-w-[320px] ${config?.bgLight} rounded-xl p-4 border-2 ${config?.borderColor}`}>
            {/* Header de columna */}
            <div className={`flex items-center gap-2 mb-4 ${config?.bgColor} text-white p-3 rounded-lg`}>
                <Icon size={24} />
                <h2 className="font-bold text-lg flex-1">{config?.nombre}</h2>
                <span className="bg-white/20 px-2 py-1 rounded-full text-sm font-bold">
                    {proyectos.length}
                </span>
            </div>

            {/* Lista de proyectos */}
            <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
                {proyectos.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <Package size={48} className="mx-auto mb-2 opacity-30" />
                        <p>Sin proyectos</p>
                    </div>
                ) : (
                    proyectos.map(proyecto => (
                        <ProyectoCard
                            key={proyecto.id}
                            proyecto={proyecto}
                            onCompletar={onCompletar}
                            etapa={etapa}
                        />
                    ))
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

// Página principal del Dashboard
const DashboardProduccionPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [resumen, setResumen] = useState({});
    const [estadisticas, setEstadisticas] = useState({});
    const [modalNuevo, setModalNuevo] = useState(false);

    const cargarDatos = useCallback(async () => {
        try {
            setLoading(true);
            const response = await produccionService.obtenerDashboard();
            if (response.success) {
                setResumen(response.data.resumen);
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
        cargarDatos();

        // Auto-refresh cada 30 segundos
        const interval = setInterval(cargarDatos, 30000);
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

    const handleCrearProyecto = async (datos) => {
        try {
            const response = await produccionService.crearProyecto(datos);
            if (response.success) {
                toast.success('Proyecto creado exitosamente');
                cargarDatos();
            }
        } catch (error) {
            console.error('Error al crear proyecto:', error);
            toast.error('Error al crear proyecto');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader size="lg" />
            </div>
        );
    }

    const etapasActivas = ['diseno', 'compras', 'produccion', 'instalacion'];

    return (
        <div className="min-h-screen bg-gray-100 p-4 lg:p-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">🏭 Dashboard de Producción</h1>
                    <p className="text-gray-600 mt-1">
                        Seguimiento de proyectos en todas las etapas
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={cargarDatos}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <RefreshCw size={18} />
                        Actualizar
                    </button>
                    <button
                        onClick={() => setModalNuevo(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                    >
                        <Plus size={18} />
                        Nuevo Proyecto
                    </button>
                </div>
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                {etapasActivas.map(etapa => {
                    const config = ETAPAS_CONFIG[etapa];
                    const count = resumen[etapa]?.proyectos?.length || 0;
                    const Icon = config.icon;

                    return (
                        <div
                            key={etapa}
                            className={`${config.bgLight} border-2 ${config.borderColor} rounded-xl p-4 text-center`}
                        >
                            <Icon size={32} className="mx-auto mb-2" style={{ color: config.color }} />
                            <div className="text-3xl font-bold" style={{ color: config.color }}>{count}</div>
                            <div className="text-sm text-gray-600">{config.nombre}</div>
                        </div>
                    );
                })}
                <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 text-center">
                    <CheckCircle2 size={32} className="mx-auto mb-2 text-green-500" />
                    <div className="text-3xl font-bold text-green-600">
                        {resumen.completado?.proyectos?.length || 0}
                    </div>
                    <div className="text-sm text-gray-600">Completados</div>
                </div>
            </div>

            {/* Alerta de urgentes */}
            {estadisticas.urgentes > 0 && (
                <div className="bg-red-100 border-2 border-red-300 rounded-xl p-4 mb-6 flex items-center gap-3">
                    <AlertTriangle size={24} className="text-red-600" />
                    <span className="font-medium text-red-800">
                        {estadisticas.urgentes} proyecto(s) urgente(s) o próximos a vencer
                    </span>
                </div>
            )}

            {/* Kanban Board */}
            <div className="flex gap-4 overflow-x-auto pb-4">
                {etapasActivas.map(etapa => (
                    <EtapaColumna
                        key={etapa}
                        etapa={etapa}
                        proyectos={resumen[etapa]?.proyectos || []}
                        onCompletar={handleCompletar}
                    />
                ))}
            </div>

            {/* Modal nuevo proyecto */}
            <ModalNuevoProyecto
                isOpen={modalNuevo}
                onClose={() => setModalNuevo(false)}
                onCrear={handleCrearProyecto}
            />
        </div>
    );
};

export default DashboardProduccionPage;
