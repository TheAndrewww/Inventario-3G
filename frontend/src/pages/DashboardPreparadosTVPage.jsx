import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Snowflake, Package } from 'lucide-react';
import { Loader } from '../components/common';
import { Toaster } from 'react-hot-toast';
import ProyectoTimeline from '../components/produccion/ProyectoTimeline';
import EstadisticasHeader from '../components/produccion/EstadisticasHeader';
import { useProduccionData } from '../hooks/useProduccionData';
import { sortProyectosPorUrgencia } from '../utils/produccion';
import { px } from '../utils/produccion';

const DashboardPreparadosTVPage = () => {
    // Hook para datos (modo público, refresh cada 1 min)
    const { proyectos, estadisticas, loading } = useProduccionData({
        autoSync: false,
        refreshInterval: 60 * 1000,
        isPublic: true
    });

    // Zoom y Orientación (persistidos en localStorage con key diferente)
    const [zoomLevel, setZoomLevel] = useState(() => {
        const savedZoom = localStorage.getItem('dashboardPreparadosTVScale');
        return savedZoom ? parseFloat(savedZoom) : 1;
    });

    const [rotacion, setRotacion] = useState(() => {
        const saved = localStorage.getItem('dashboardPreparadosTVRotation');
        return saved ? parseInt(saved) : 0;
    });

    const [controlsVisible, setControlsVisible] = useState(false);
    const hideTimerRef = useRef(null);

    useEffect(() => {
        localStorage.setItem('dashboardPreparadosTVScale', zoomLevel.toString());
    }, [zoomLevel]);

    useEffect(() => {
        localStorage.setItem('dashboardPreparadosTVRotation', rotacion.toString());
    }, [rotacion]);

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

    // Helper: detectar proyectos MTO/GTIA con timeline simplificado
    const usaTimelineSimplificado = (p) => {
        const tipo = p.tipo_proyecto?.toUpperCase();
        return tipo === 'GTIA' || (tipo === 'MTO' && !p.es_extensivo);
    };

    // Proyectos PREPARADOS: etapa 'instalacion' O proyectos MTO/GTIA simplificados activos
    const proyectosPreparados = useMemo(() =>
        sortProyectosPorUrgencia(
            proyectos.filter(p =>
                !p.pausado && (
                    p.etapa_actual === 'instalacion' ||
                    (usaTimelineSimplificado(p) && p.etapa_actual !== 'completado' && p.etapa_actual !== 'pendiente')
                )
            )
        ),
        [proyectos]
    );

    // Proyectos congelados (pausados) que estén en preparado o sean MTO/GTIA
    const proyectosCongelados = useMemo(() =>
        proyectos.filter(p =>
            p.pausado && (
                p.etapa_actual === 'instalacion' ||
                (usaTimelineSimplificado(p) && p.etapa_actual !== 'completado' && p.etapa_actual !== 'pendiente')
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

            {/* Main Content Container with Rotation */}
            <div
                className="w-full h-full transition-all duration-300 origin-center"
                style={getRotationStyle()}
            >
                {/* Scrollable Area */}
                <div className="h-full w-full overflow-auto" style={{ padding: px(16) }}>
                    {/* Header con título */}
                    <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center gap-3">
                            <img
                                src="https://res.cloudinary.com/dd93jrilg/image/upload/v1762289946/logo-page_qhpoey.png"
                                alt="3G"
                                className="h-14 w-14 object-contain rounded-xl"
                            />
                            <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-green-500 rounded-xl flex items-center justify-center text-white">
                                <Package size={28} />
                            </div>
                            <div>
                                <h1 className="text-5xl font-bold text-gray-900">Proyectos Completados</h1>
                                <p className="text-gray-500 text-lg">Listos para entrega o completar</p>
                            </div>
                            <div className="ml-auto">
                                <div className="px-6 py-3 bg-blue-100 text-blue-700 rounded-full text-lg font-bold">
                                    {proyectosPreparados.length} {proyectosPreparados.length === 1 ? 'Proyecto' : 'Proyectos'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {proyectosCongelados.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm mb-6">
                            <div className="flex items-center gap-2 mb-2 text-blue-700 font-bold border-b border-blue-100 pb-2">
                                <Snowflake size={20} />
                                <span>Proyectos Completados Pausados ({proyectosCongelados.length})</span>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-2 space-y-1" style={{ maxHeight: px(220) }}>
                                {proyectosCongelados.map(p => (
                                    <div key={p.id} className="text-sm text-blue-800 bg-white/50 px-2 py-1 rounded border border-blue-100 truncate">
                                        {p.nombre}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="pb-20" style={{ gap: px(16), display: 'flex', flexDirection: 'column' }}>
                        {proyectosPreparados.map(proyecto => (
                            <ProyectoTimeline key={proyecto.id} proyecto={proyecto} />
                        ))}
                        {proyectosPreparados.length === 0 && (
                            <div className="text-center text-gray-500 font-bold" style={{ padding: px(80), fontSize: `calc(1.5rem * var(--escala, 1))` }}>
                                No hay proyectos completados
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* En vivo indicator */}
            <div
                className={`fixed z-40 bg-blue-500 text-white backdrop-blur-sm rounded-full font-medium shadow-sm border border-blue-600 flex items-center bottom-4 left-4`}
                style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', gap: '0.5rem' }}
            >
                <span>📦 Completados - En vivo</span>
            </div>

            {/* Controls */}
            <div className={`fixed z-50 flex gap-2 transition-opacity duration-300 bottom-4 right-4 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
                {/* Rotation indicator */}
                <div className="flex bg-gray-900 text-white rounded-lg shadow-xl overflow-hidden border border-gray-700">
                    <div className="px-3 py-1 text-xs font-medium flex items-center justify-center bg-gray-800">
                        {rotacion}°
                    </div>
                </div>
                {/* Scale Controls */}
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

                {/* Rotation */}
                <div className="flex bg-gray-900 text-white rounded-lg shadow-xl overflow-hidden border border-gray-700">
                    <button onClick={rotar} className="p-3 hover:bg-gray-800 active:bg-gray-700 transition-colors" title="Rotar 90°">
                        <RotateCw size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DashboardPreparadosTVPage;
