import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Package,
    ShoppingCart,
    Factory,
    Truck,
    CheckCircle2,
    Clock,
    AlertTriangle,
    LogOut,
    RefreshCw,
    Lock
} from 'lucide-react';
import produccionService from '../services/produccion.service';
import toast, { Toaster } from 'react-hot-toast';

// Configuración de áreas
const AREAS_CONFIG = {
    diseno: {
        nombre: 'Diseño',
        color: '#8B5CF6',
        bgGradient: 'from-violet-600 to-violet-800',
        icon: Package
    },
    compras: {
        nombre: 'Compras',
        color: '#10B981',
        bgGradient: 'from-emerald-600 to-emerald-800',
        icon: ShoppingCart
    },
    produccion: {
        nombre: 'Producción',
        color: '#F59E0B',
        bgGradient: 'from-amber-500 to-amber-700',
        icon: Factory
    },
    instalacion: {
        nombre: 'Instalación',
        color: '#3B82F6',
        bgGradient: 'from-blue-600 to-blue-800',
        icon: Truck
    }
};

// Pantalla de login con código de área
const LoginArea = ({ onLogin }) => {
    const [codigo, setCodigo] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!codigo.trim()) return;

        setLoading(true);
        try {
            const response = await produccionService.validarCodigoArea(codigo);
            if (response.success) {
                onLogin(response.data.area);
                toast.success(`Acceso a ${response.data.info.nombre}`);
            }
        } catch (error) {
            toast.error('Código inválido');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-8">
            <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-8">
                    <Lock size={48} className="text-gray-600" />
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Terminal de Producción
                </h1>
                <p className="text-gray-500 mb-8">
                    Ingresa el código de tu área
                </p>

                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                        className="w-full text-center text-3xl font-mono tracking-widest px-6 py-4 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-violet-200 focus:border-violet-500 mb-6"
                        placeholder="XXX-0000"
                        maxLength={8}
                        autoFocus
                    />

                    <button
                        type="submit"
                        disabled={loading || !codigo.trim()}
                        className="w-full py-4 bg-gradient-to-r from-violet-600 to-violet-700 text-white text-xl font-bold rounded-xl hover:from-violet-700 hover:to-violet-800 disabled:opacity-50 transition-all"
                    >
                        {loading ? 'Validando...' : 'Ingresar'}
                    </button>
                </form>

                <p className="text-sm text-gray-400 mt-8">
                    3G Velarias - Sistema de Producción
                </p>
            </div>
        </div>
    );
};

// Tarjeta de proyecto para terminal (grande y simple)
const ProyectoCardTerminal = ({ proyecto, onCompletar, areaConfig, loading: globalLoading }) => {
    const [loading, setLoading] = useState(false);
    const diasRestantes = proyecto.diasRestantes;
    const esUrgente = proyecto.prioridad === 1 || (diasRestantes !== null && diasRestantes <= 3);

    const handleCompletar = async () => {
        if (loading || globalLoading) return;
        setLoading(true);
        try {
            await onCompletar(proyecto.id);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`bg-white rounded-2xl shadow-xl p-6 border-4 ${esUrgente ? 'border-red-500 ring-4 ring-red-200' : 'border-white'
            }`}>
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div>
                    {esUrgente && (
                        <div className="flex items-center gap-2 text-red-600 mb-2">
                            <AlertTriangle size={24} />
                            <span className="font-bold text-lg">URGENTE</span>
                        </div>
                    )}
                    <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                        {proyecto.nombre}
                    </h2>
                    {proyecto.cliente && (
                        <p className="text-lg text-gray-600 mt-1">{proyecto.cliente}</p>
                    )}
                </div>
                <span className="text-sm text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                    #{proyecto.id}
                </span>
            </div>

            {/* Fecha límite */}
            {proyecto.fecha_limite && (
                <div className={`flex items-center gap-2 text-lg mb-6 ${diasRestantes !== null && diasRestantes <= 3
                        ? 'text-red-600 font-bold'
                        : 'text-gray-500'
                    }`}>
                    <Clock size={20} />
                    {diasRestantes !== null && diasRestantes < 0
                        ? `⚠️ Vencido hace ${Math.abs(diasRestantes)} días`
                        : diasRestantes === 0
                            ? '⏰ Vence HOY'
                            : diasRestantes !== null
                                ? `📅 ${diasRestantes} días restantes`
                                : new Date(proyecto.fecha_limite).toLocaleDateString('es-MX', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short'
                                })
                    }
                </div>
            )}

            {/* Botón completar - GRANDE */}
            <button
                onClick={handleCompletar}
                disabled={loading || globalLoading}
                className={`w-full py-6 px-8 rounded-xl text-white text-2xl font-bold flex items-center justify-center gap-4 transition-all transform hover:scale-[1.02] active:scale-[0.98] ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-lg'
                    }`}
                style={{
                    background: `linear-gradient(135deg, ${areaConfig.color}, ${areaConfig.color}dd)`
                }}
            >
                {loading ? (
                    <>
                        <RefreshCw size={32} className="animate-spin" />
                        Procesando...
                    </>
                ) : (
                    <>
                        <CheckCircle2 size={32} />
                        ✓ COMPLETADO
                    </>
                )}
            </button>
        </div>
    );
};

// Pantalla principal del terminal
const TerminalView = ({ area, onLogout }) => {
    const areaConfig = AREAS_CONFIG[area];
    const Icon = areaConfig?.icon || Package;

    const [proyectos, setProyectos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actualizando, setActualizando] = useState(false);

    const cargarProyectos = useCallback(async (showLoader = true) => {
        try {
            if (showLoader) setLoading(true);
            else setActualizando(true);

            const response = await produccionService.obtenerProyectosArea(area);
            if (response.success) {
                setProyectos(response.data.proyectos);
            }
        } catch (error) {
            console.error('Error al cargar proyectos:', error);
            toast.error('Error al cargar proyectos');
        } finally {
            setLoading(false);
            setActualizando(false);
        }
    }, [area]);

    useEffect(() => {
        cargarProyectos();

        // Auto-refresh cada 15 segundos
        const interval = setInterval(() => cargarProyectos(false), 15000);
        return () => clearInterval(interval);
    }, [cargarProyectos]);

    const handleCompletar = async (proyectoId) => {
        try {
            const response = await produccionService.completarEtapaTerminal(proyectoId);
            if (response.success) {
                toast.success(
                    <div className="text-center">
                        <div className="text-2xl mb-1">✅</div>
                        <div className="font-bold">{response.message}</div>
                    </div>,
                    { duration: 3000 }
                );
                cargarProyectos(false);
            }
        } catch (error) {
            console.error('Error al completar:', error);
            toast.error('Error al completar etapa');
        }
    };

    if (loading) {
        return (
            <div className={`min-h-screen bg-gradient-to-br ${areaConfig?.bgGradient || 'from-gray-600 to-gray-800'} flex items-center justify-center`}>
                <div className="text-center text-white">
                    <RefreshCw size={64} className="animate-spin mx-auto mb-4" />
                    <p className="text-2xl">Cargando proyectos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen bg-gradient-to-br ${areaConfig?.bgGradient || 'from-gray-600 to-gray-800'} p-6`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4 text-white">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                        <Icon size={36} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">{areaConfig?.nombre}</h1>
                        <p className="text-white/70">
                            {proyectos.length} proyecto(s) pendiente(s)
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => cargarProyectos(false)}
                        disabled={actualizando}
                        className="p-4 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
                    >
                        <RefreshCw size={28} className={actualizando ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={onLogout}
                        className="p-4 bg-white/10 hover:bg-red-500/50 rounded-xl text-white transition-colors"
                    >
                        <LogOut size={28} />
                    </button>
                </div>
            </div>

            {/* Lista de proyectos */}
            {proyectos.length === 0 ? (
                <div className="text-center text-white py-20">
                    <CheckCircle2 size={80} className="mx-auto mb-6 opacity-50" />
                    <h2 className="text-3xl font-bold mb-2">¡Todo completado!</h2>
                    <p className="text-xl text-white/70">
                        No hay proyectos pendientes en esta área
                    </p>
                </div>
            ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                    {proyectos.map(proyecto => (
                        <ProyectoCardTerminal
                            key={proyecto.id}
                            proyecto={proyecto}
                            onCompletar={handleCompletar}
                            areaConfig={areaConfig}
                            loading={actualizando}
                        />
                    ))}
                </div>
            )}

            {/* Footer */}
            <div className="fixed bottom-4 left-0 right-0 text-center text-white/50 text-sm">
                3G Velarias - Terminal {areaConfig?.nombre}
                {actualizando && ' • Actualizando...'}
            </div>
        </div>
    );
};

// Componente principal
const TerminalAreaPage = () => {
    const { area: areaParam } = useParams();
    const navigate = useNavigate();
    const [area, setArea] = useState(areaParam || null);

    // Si llega con área en la URL, usarla directamente
    useEffect(() => {
        if (areaParam && AREAS_CONFIG[areaParam]) {
            setArea(areaParam);
        }
    }, [areaParam]);

    const handleLogin = (areaValidada) => {
        setArea(areaValidada);
        navigate(`/terminal/${areaValidada}`, { replace: true });
    };

    const handleLogout = () => {
        setArea(null);
        navigate('/terminal', { replace: true });
    };

    return (
        <>
            <Toaster
                position="top-center"
                toastOptions={{
                    duration: 3000,
                    style: {
                        fontSize: '1.25rem',
                        padding: '1rem 1.5rem',
                        borderRadius: '1rem',
                    },
                }}
            />

            {area && AREAS_CONFIG[area] ? (
                <TerminalView area={area} onLogout={handleLogout} />
            ) : (
                <LoginArea onLogin={handleLogin} />
            )}
        </>
    );
};

export default TerminalAreaPage;
