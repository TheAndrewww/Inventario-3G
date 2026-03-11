import React, { useState, useEffect, useMemo } from 'react';
import { ZoomIn, ZoomOut, RotateCw, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { Loader } from '../components/common';
import { Toaster } from 'react-hot-toast';
import { useProduccionData } from '../hooks/useProduccionData';
import { sortProyectosPorUrgencia } from '../utils/produccion';
import { px } from '../utils/produccion';
import { ETAPAS_CONFIG } from '../components/produccion/constants';

/**
 * Tarjeta simplificada de proyecto para el TV de Manufactura
 */
const ProyectoCardManufactura = ({ proyecto }) => {
    const manufacturaDone = proyecto.estadoSubEtapas?.manufactura?.completado || proyecto.manufactura_completado;
    const etapaActual = proyecto.etapa_actual;
    const enProduccion = etapaActual === 'produccion';
    const etapaConfig = ETAPAS_CONFIG[etapaActual] || ETAPAS_CONFIG.pendiente;

    // Determinar estado visual
    let statusColor, statusBg, statusIcon, statusText;
    if (manufacturaDone) {
        statusColor = 'text-green-700';
        statusBg = 'bg-green-50 border-green-200';
        statusIcon = <CheckCircle2 size={20} className="text-green-500" />;
        statusText = 'Completado';
    } else if (enProduccion) {
        statusColor = 'text-amber-700';
        statusBg = 'bg-amber-50 border-amber-300 ring-2 ring-amber-200';
        statusIcon = <Clock size={20} className="text-amber-500 animate-pulse" />;
        statusText = 'En proceso';
    } else {
        // Proyecto tiene manufactura pero aún no llega a producción
        statusColor = 'text-gray-500';
        statusBg = 'bg-gray-50 border-gray-200';
        statusIcon = <Clock size={20} className="text-gray-400" />;
        statusText = `En ${etapaConfig.nombre}`;
    }

    const diasRestantes = proyecto.diasRestantes;
    const urgente = proyecto.prioridad === 1 || (diasRestantes !== null && diasRestantes <= 3);

    return (
        <div className={`rounded-xl border-2 p-4 transition-all ${statusBg} ${urgente && !manufacturaDone ? 'ring-2 ring-red-300' : ''}`}>
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    {statusIcon}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-gray-900 text-lg truncate">{proyecto.nombre}</h3>
                            {urgente && !manufacturaDone && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold shrink-0">
                                    <AlertTriangle size={12} /> URGENTE
                                </span>
                            )}
                            {proyecto.tipo_proyecto && (
                                <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full text-xs font-medium shrink-0">
                                    {proyecto.tipo_proyecto}
                                </span>
                            )}
                        </div>
                        {proyecto.cliente && (
                            <p className="text-sm text-gray-500 truncate">{proyecto.cliente}</p>
                        )}
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-bold ${statusColor} ${manufacturaDone ? 'bg-green-100' : enProduccion ? 'bg-amber-100' : 'bg-gray-100'}`}>
                        {statusText}
                    </span>
                    {diasRestantes !== null && diasRestantes >= 0 && !manufacturaDone && (
                        <p className={`text-xs mt-1 ${diasRestantes <= 3 ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
                            {diasRestantes} día{diasRestantes !== 1 ? 's' : ''} restante{diasRestantes !== 1 ? 's' : ''}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

const DashboardManufacturaTVPage = () => {
    const { proyectos, loading } = useProduccionData({
        autoSync: false,
        refreshInterval: 60 * 1000,
        isPublic: true
    });

    const [zoomLevel, setZoomLevel] = useState(() => {
        const saved = localStorage.getItem('manufacturaTVScale');
        return saved ? parseFloat(saved) : 1;
    });

    const [orientacion, setOrientacion] = useState(() => {
        return localStorage.getItem('manufacturaTVOrientation') || 'horizontal';
    });

    useEffect(() => { localStorage.setItem('manufacturaTVScale', zoomLevel.toString()); }, [zoomLevel]);
    useEffect(() => { localStorage.setItem('manufacturaTVOrientation', orientacion); }, [orientacion]);

    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 3));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.5));
    const toggleOrientacion = () => setOrientacion(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');

    // Solo proyectos con manufactura, no completados, no pausados
    const proyectosManufactura = useMemo(() =>
        sortProyectosPorUrgencia(
            proyectos.filter(p =>
                p.tiene_manufactura &&
                p.etapa_actual !== 'completado' &&
                !p.pausado
            )
        ),
        [proyectos]
    );

    // Separar: en producción activamente vs pendientes de llegar
    const enProduccion = proyectosManufactura.filter(p => p.etapa_actual === 'produccion' && !(p.estadoSubEtapas?.manufactura?.completado || p.manufactura_completado));
    const completados = proyectosManufactura.filter(p => p.estadoSubEtapas?.manufactura?.completado || p.manufactura_completado);
    const pendientes = proyectosManufactura.filter(p => p.etapa_actual !== 'produccion' && !(p.estadoSubEtapas?.manufactura?.completado || p.manufactura_completado));

    if (loading && proyectos.length === 0) {
        return <div className="flex items-center justify-center h-screen"><Loader size="lg" /></div>;
    }

    return (
        <div className="fixed inset-0 overflow-hidden bg-gray-50" style={{ '--escala': zoomLevel }}>
            <Toaster position="top-right" />

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
                <div className="h-full w-full overflow-auto" style={{ padding: px(16) }}>
                    {/* Header */}
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-amber-500 text-white rounded-xl p-3 shadow-lg">
                                <span className="text-3xl">🏭</span>
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Manufactura</h1>
                                <p className="text-gray-500">
                                    <span className="font-semibold text-amber-600">{enProduccion.length}</span> en proceso
                                    {completados.length > 0 && <> · <span className="text-green-600 font-semibold">{completados.length}</span> completados</>}
                                    {pendientes.length > 0 && <> · <span className="text-gray-400">{pendientes.length}</span> por llegar</>}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* En proceso ahora */}
                    {enProduccion.length > 0 && (
                        <div className="mb-6">
                            <h2 className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                                En Proceso ({enProduccion.length})
                            </h2>
                            <div className="space-y-3">
                                {enProduccion.map(p => <ProyectoCardManufactura key={p.id} proyecto={p} />)}
                            </div>
                        </div>
                    )}

                    {/* Por llegar */}
                    {pendientes.length > 0 && (
                        <div className="mb-6">
                            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                                Por llegar a manufactura ({pendientes.length})
                            </h2>
                            <div className="space-y-2">
                                {pendientes.map(p => <ProyectoCardManufactura key={p.id} proyecto={p} />)}
                            </div>
                        </div>
                    )}

                    {/* Completados en manufactura (siguen en producción general) */}
                    {completados.length > 0 && (
                        <div className="mb-6 pb-20">
                            <h2 className="text-sm font-bold text-green-600 uppercase tracking-wider mb-3">
                                ✅ Manufactura completada ({completados.length})
                            </h2>
                            <div className="space-y-2 opacity-70">
                                {completados.map(p => <ProyectoCardManufactura key={p.id} proyecto={p} />)}
                            </div>
                        </div>
                    )}

                    {proyectosManufactura.length === 0 && (
                        <div className="text-center text-gray-400 font-bold py-20 text-xl">
                            No hay proyectos con manufactura activa
                        </div>
                    )}
                </div>
            </div>

            {/* En vivo indicator */}
            <div
                className={`fixed z-40 bg-amber-50 backdrop-blur-sm rounded-full font-medium text-amber-700 shadow-sm border border-amber-200 flex items-center ${orientacion === 'vertical' ? 'bottom-4 right-4' : 'bottom-4 left-4'}`}
                style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', gap: '0.5rem' }}
            >
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                <span>Manufactura · En vivo</span>
            </div>

            {/* Controls */}
            <div className={`fixed z-50 flex gap-2 transition-opacity duration-300 opacity-0 hover:opacity-100 ${orientacion === 'vertical' ? 'bottom-4 left-4' : 'bottom-4 right-4'}`}>
                <div className="flex bg-gray-900 text-white rounded-lg shadow-xl overflow-hidden border border-gray-700">
                    <button onClick={handleZoomOut} className="p-3 hover:bg-gray-800 active:bg-gray-700 transition-colors" title="Reducir Escala">
                        <ZoomOut size={20} />
                    </button>
                    <div className="px-3 py-1 text-sm font-bold flex items-center justify-center min-w-[50px] border-x border-gray-700 bg-gray-800">
                        {Math.round(zoomLevel * 100)}%
                    </div>
                    <button onClick={handleZoomIn} className="p-3 hover:bg-gray-800 active:bg-gray-700 transition-colors" title="Aumentar Escala">
                        <ZoomIn size={20} />
                    </button>
                </div>
                <div className="flex bg-gray-900 text-white rounded-lg shadow-xl overflow-hidden border border-gray-700">
                    <button onClick={toggleOrientacion} className="p-3 hover:bg-gray-800 active:bg-gray-700 transition-colors" title={`Cambiar a modo ${orientacion === 'horizontal' ? 'vertical' : 'horizontal'}`}>
                        <RotateCw size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DashboardManufacturaTVPage;
