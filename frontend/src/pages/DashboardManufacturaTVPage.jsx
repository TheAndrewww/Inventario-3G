import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Clock, AlertTriangle, Calendar } from 'lucide-react';
import { Loader } from '../components/common';
import { Toaster } from 'react-hot-toast';
import { useProduccionData } from '../hooks/useProduccionData';
import { sortProyectosPorUrgencia } from '../utils/produccion';
import { px } from '../utils/produccion';

/**
 * Tarjeta grande de proyecto para el TV de Manufactura
 */
const ProyectoCardManufactura = ({ proyecto }) => {
    const diasRestantes = proyecto.diasRestantes;
    const urgente = proyecto.prioridad === 1 || (diasRestantes !== null && diasRestantes <= 3);

    const formatFecha = (fecha) => {
        if (!fecha) return '—';
        return new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    };

    return (
        <div className={`rounded-2xl border-2 p-6 transition-all bg-amber-50 border-amber-300 ${urgente ? 'ring-2 ring-red-300' : ''}`}>
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    <Clock size={28} className="text-amber-500 animate-pulse shrink-0" />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-bold text-gray-900 text-2xl">{proyecto.nombre}</h3>
                            {urgente && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-bold shrink-0">
                                    <AlertTriangle size={16} /> URGENTE
                                </span>
                            )}
                            {proyecto.tipo_proyecto && (
                                <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm font-semibold shrink-0">
                                    {proyecto.tipo_proyecto}
                                </span>
                            )}
                        </div>
                        {proyecto.cliente && (
                            <p className="text-base text-gray-500 mt-1">{proyecto.cliente}</p>
                        )}
                    </div>
                </div>
                <div className="text-right shrink-0 space-y-2">
                    <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                            <Calendar size={16} className="text-gray-400" />
                            <span className="text-gray-500">Entrada:</span>
                            <span className="font-bold text-gray-700">{formatFecha(proyecto.fecha_entrada)}</span>
                        </div>
                        {proyecto.fecha_limite && (
                            <div className="flex items-center gap-1.5">
                                <Calendar size={16} className={diasRestantes !== null && diasRestantes <= 3 ? 'text-red-500' : 'text-gray-400'} />
                                <span className="text-gray-500">Límite:</span>
                                <span className={`font-bold ${diasRestantes !== null && diasRestantes <= 3 ? 'text-red-600' : 'text-gray-700'}`}>
                                    {formatFecha(proyecto.fecha_limite)}
                                </span>
                            </div>
                        )}
                    </div>
                    {diasRestantes !== null && diasRestantes >= 0 && (
                        <p className={`text-sm font-bold ${diasRestantes <= 3 ? 'text-red-600' : 'text-gray-500'}`}>
                            {diasRestantes} día{diasRestantes !== 1 ? 's' : ''} restante{diasRestantes !== 1 ? 's' : ''}
                        </p>
                    )}
                    {diasRestantes !== null && diasRestantes < 0 && (
                        <p className="text-sm font-bold text-red-600">
                            {Math.abs(diasRestantes)} día{Math.abs(diasRestantes) !== 1 ? 's' : ''} de atraso
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

    const [rotacion, setRotacion] = useState(() => {
        const saved = localStorage.getItem('manufacturaTVRotation');
        return saved ? parseInt(saved) : 0;
    });

    const [controlsVisible, setControlsVisible] = useState(false);
    const hideTimerRef = useRef(null);

    useEffect(() => { localStorage.setItem('manufacturaTVScale', zoomLevel.toString()); }, [zoomLevel]);
    useEffect(() => { localStorage.setItem('manufacturaTVRotation', rotacion.toString()); }, [rotacion]);

    const handleMouseMove = useCallback(() => {
        setControlsVisible(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, [handleMouseMove]);

    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 3));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.5));
    const rotar = () => setRotacion(prev => (prev + 90) % 360);

    const getRotationStyle = () => {
        const isVertical = rotacion === 90 || rotacion === 270;
        return {
            transform: rotacion === 0 ? 'none' : `rotate(${rotacion}deg)`,
            width: isVertical ? '100vh' : '100vw',
            height: isVertical ? '100vw' : '100vh',
            position: 'absolute',
            top: isVertical ? 'calc(50% - 50vw)' : 0,
            left: isVertical ? 'calc(50% - 50vh)' : 0,
        };
    };

    // Proyectos con manufactura desbloqueada (sin importar etapa), no completados, no pausados
    const enProduccion = useMemo(() =>
        sortProyectosPorUrgencia(
            proyectos.filter(p =>
                p.tiene_manufactura &&
                p.etapa_actual !== 'completado' &&
                !p.pausado &&
                !(p.estadoSubEtapas?.manufactura?.completado || p.manufactura_completado)
            )
        ),
        [proyectos]
    );

    if (loading && proyectos.length === 0) {
        return <div className="flex items-center justify-center h-screen"><Loader size="lg" /></div>;
    }

    return (
        <div className="fixed inset-0 overflow-hidden bg-gray-50" style={{ '--escala': zoomLevel }}>
            <Toaster position="top-right" />

            <div
                className="w-full h-full transition-all duration-300 origin-center"
                style={getRotationStyle()}
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
                                    <span className="font-semibold text-amber-600">{enProduccion.length}</span> proyecto{enProduccion.length !== 1 ? 's' : ''} en proceso
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Proyectos en proceso */}
                    <div className="pb-20 space-y-4">
                        {enProduccion.map(p => <ProyectoCardManufactura key={p.id} proyecto={p} />)}
                        {enProduccion.length === 0 && (
                            <div className="text-center text-gray-400 font-bold py-20 text-xl">
                                No hay proyectos en manufactura actualmente
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* En vivo indicator */}
            <div
                className={`fixed z-40 bg-amber-50 backdrop-blur-sm rounded-full font-medium text-amber-700 shadow-sm border border-amber-200 flex items-center bottom-4 left-4`}
                style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', gap: '0.5rem' }}
            >
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                <span>Manufactura · En vivo</span>
            </div>

            {/* Controls */}
            <div className={`fixed z-50 flex gap-2 transition-opacity duration-300 bottom-4 right-4 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex bg-gray-900 text-white rounded-lg shadow-xl overflow-hidden border border-gray-700">
                    <div className="px-3 py-1 text-xs font-medium flex items-center justify-center bg-gray-800">
                        {rotacion}°
                    </div>
                </div>
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
                    <button onClick={rotar} className="p-3 hover:bg-gray-800 active:bg-gray-700 transition-colors" title="Rotar 90°">
                        <RotateCw size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DashboardManufacturaTVPage;
