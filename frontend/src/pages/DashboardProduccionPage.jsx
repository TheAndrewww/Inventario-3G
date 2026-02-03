import React, { useState, useEffect, useCallback } from 'react';
import {
    Package,
    Monitor,
    ExternalLink,
    Cloud,
    Database
} from 'lucide-react';
import produccionService from '../services/produccion.service';
import { Loader, Modal, Button } from '../components/common';
import toast from 'react-hot-toast';
import ProyectoTimeline from '../components/produccion/ProyectoTimeline';
import EstadisticasHeader from '../components/produccion/EstadisticasHeader';

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

        // Auto-refresh: 5 minutos normal
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
                const mesesInfo = response.data.meses?.length > 1 ? ` (${response.data.meses.length} meses)` : '';
                toast.success(
                    `Sincronizado${mesesInfo}: ${response.data.creados} nuevos, ${response.data.actualizados} actualizados`
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

    const handleSincronizarDrive = async () => {
        try {
            setSincronizando(true);
            toast.loading('Sincronizando con Drive (esto puede tardar unos segundos)...', { id: 'sync-drive' });

            const response = await produccionService.sincronizarTodosDrive();

            if (response.success) {
                toast.success(
                    `Drive actualizado: ${response.data.exitosos} proyectos procesados`,
                    { id: 'sync-drive' }
                );
                cargarDatos();
            } else {
                toast.error('Error al sincronizar con Drive', { id: 'sync-drive' });
            }
        } catch (error) {
            console.error('Error al sincronizar Drive:', error);
            toast.error('Error de conexión con Drive', { id: 'sync-drive' });
        } finally {
            setSincronizando(false);
        }
    };

    // Filtros
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
        // 1. En retraso primero (tipos A/B/C que superaron tiempo por etapa)
        const aRetraso = a.estadoRetraso?.enRetraso ? 1 : 0;
        const bRetraso = b.estadoRetraso?.enRetraso ? 1 : 0;
        if (aRetraso !== bRetraso) return bRetraso - aRetraso;

        // 2. Si ambos en retraso, el que tiene más días de retraso primero
        if (aRetraso && bRetraso) {
            const aRetrasoDias = a.estadoRetraso?.diasRetraso || 0;
            const bRetrasoDias = b.estadoRetraso?.diasRetraso || 0;
            if (aRetrasoDias !== bRetrasoDias) return bRetrasoDias - aRetrasoDias;
        }

        // 3. Vencidos (fecha límite superada)
        const aVencido = a.diasRestantes !== null && a.diasRestantes < 0;
        const bVencido = b.diasRestantes !== null && b.diasRestantes < 0;
        if (aVencido !== bVencido) return aVencido ? -1 : 1;

        // 4. Por prioridad
        const aPrioridad = a.prioridad || 3;
        const bPrioridad = b.prioridad || 3;
        if (aPrioridad !== bPrioridad) return aPrioridad - bPrioridad;

        // 5. Tiebreaker: diasRestantesEtapa (menor = más urgente)
        const aDiasEtapa = a.estadoRetraso?.diasRestantesEtapa ?? a.diasRestantes ?? 999;
        const bDiasEtapa = b.estadoRetraso?.diasRestantesEtapa ?? b.diasRestantes ?? 999;
        return aDiasEtapa - bDiasEtapa;
    });

    // Nuevo Proyecto Modal
    const [modalOpen, setModalOpen] = useState(false);
    const handleCrearProyecto = async (data) => {
        try {
            const response = await produccionService.crearProyecto(data);
            if (response.success) {
                toast.success('Proyecto creado exitosamente');
                cargarDatos();
            }
        } catch (error) {
            console.error('Error al crear proyecto:', error);
            toast.error('Error al crear proyecto');
        }
    };

    if (loading && proyectos.length === 0) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader size="lg" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 lg:p-6 transition-all duration-300">
            {/* Header */}
            <div>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            🏭 Dashboard de Producción
                        </h1>
                        <p className="text-gray-600 mt-1">
                            Seguimiento visual de proyectos por etapas
                        </p>
                    </div>

                    <div className="flex gap-2 items-center">
                        {ultimaSync && (
                            <span className="text-xs text-gray-400">
                                Actualizado: {ultimaSync.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}

                        <a
                            href="/produccion-tv"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
                            title="Abrir vista para TV Vertical"
                        >
                            <Monitor size={18} />
                            <span>Vista TV</span>
                            <ExternalLink size={14} className="opacity-50" />
                        </a>

                        <div className="h-8 w-px bg-gray-300 mx-2 hidden lg:block"></div>

                        {/* Botones de Sincronización Manual */}
                        <button
                            onClick={handleSincronizar}
                            disabled={sincronizando}
                            className="flex items-center gap-2 px-3 py-2 bg-white text-green-700 border border-green-200 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50 text-sm font-medium"
                            title="Actualizar nuevos proyectos desde Google Sheets"
                        >
                            <Database size={16} />
                            {sincronizando ? '...' : 'Sync Sheets'}
                        </button>

                        <button
                            onClick={handleSincronizarDrive}
                            disabled={sincronizando}
                            className="flex items-center gap-2 px-3 py-2 bg-white text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 text-sm font-medium"
                            title="Actualizar carpetas y archivos desde Google Drive"
                        >
                            <Cloud size={16} />
                            {sincronizando ? '...' : 'Sync Drive'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Estadísticas */}
            <EstadisticasHeader estadisticas={estadisticas} />

            {/* Filtros */}
            <FiltrosProyectos filtro={filtro} setFiltro={setFiltro} />

            {/* Lista de Proyectos */}
            <div className="space-y-6">
                {proyectosFiltrados.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
                        <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Package size={32} className="text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">No hay proyectos</h3>
                        <p className="text-gray-500">No se encontraron proyectos con el filtro actual</p>
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

            <ModalNuevoProyecto
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onCrear={handleCrearProyecto}
            />
        </div>
    );
};

export default DashboardProduccionPage;
