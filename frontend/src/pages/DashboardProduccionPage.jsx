import React, { useState, useCallback, lazy, Suspense } from 'react';
import {
    Package,
    Monitor,
    ExternalLink,
    Cloud,
    Database,
    Plus
} from 'lucide-react';
import { Loader, Modal, Button } from '../components/common';
import toast from 'react-hot-toast';
import ProyectoTimeline from '../components/produccion/ProyectoTimeline';
import EstadisticasHeader from '../components/produccion/EstadisticasHeader';
import { useProduccionData } from '../hooks/useProduccionData';
import { useProduccionFilters } from '../hooks/useProduccionFilters';

// ============ Modal para nuevo proyecto ============
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
            const success = await onCrear(formData);
            if (success) {
                setFormData({ nombre: '', cliente: '', descripcion: '', prioridad: 3, fecha_limite: '' });
                onClose();
            }
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

// ============ Filtros ============
const FiltrosProyectos = ({ filtro, setFiltro, opciones }) => (
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

// ============ Página principal ============
const DashboardProduccionPage = () => {
    const [modalOpen, setModalOpen] = useState(false);

    // Hooks personalizados
    const {
        proyectos,
        estadisticas,
        loading,
        sincronizando,
        ultimaSync,
        sincronizarSheets,
        sincronizarDrive,
        completarEtapa,
        regresarEtapa,
        completarSubEtapa,
        crearProyecto,
        togglePausa,
        toggleEtapa
    } = useProduccionData({ autoSync: true, refreshInterval: 5 * 60 * 1000 });

    const { filtro, setFiltro, proyectosFiltrados, opciones } = useProduccionFilters(proyectos);

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

                        <button
                            onClick={sincronizarSheets}
                            disabled={sincronizando}
                            className="flex items-center gap-2 px-3 py-2 bg-white text-green-700 border border-green-200 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50 text-sm font-medium"
                            title="Actualizar nuevos proyectos desde Google Sheets"
                        >
                            <Database size={16} />
                            {sincronizando ? '...' : 'Sync Sheets'}
                        </button>

                        <button
                            onClick={sincronizarDrive}
                            disabled={sincronizando}
                            className="flex items-center gap-2 px-3 py-2 bg-white text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 text-sm font-medium"
                            title="Actualizar carpetas y archivos desde Google Drive"
                        >
                            <Cloud size={16} />
                            {sincronizando ? '...' : 'Sync Drive'}
                        </button>

                        <div className="h-8 w-px bg-gray-300 mx-1 hidden lg:block"></div>

                        <button
                            onClick={() => setModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium"
                        >
                            <Plus size={16} />
                            Nuevo Proyecto
                        </button>
                    </div>
                </div>
            </div>

            {/* Estadísticas */}
            <EstadisticasHeader estadisticas={estadisticas} />

            {/* Filtros */}
            <FiltrosProyectos filtro={filtro} setFiltro={setFiltro} opciones={opciones} />

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
                            onCompletar={completarEtapa}
                            onRegresar={regresarEtapa}
                            onCompletarSubEtapa={completarSubEtapa}
                            onTogglePausa={togglePausa}
                            onToggleEtapa={toggleEtapa}
                        />
                    ))
                )}
            </div>

            <ModalNuevoProyecto
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onCrear={crearProyecto}
            />
        </div>
    );
};

export default DashboardProduccionPage;
