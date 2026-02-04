import React, { useState, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import produccionService from '../services/produccion.service';
import { Loader } from '../components/common';
import toast, { Toaster } from 'react-hot-toast';
import ProyectoTimeline from '../components/produccion/ProyectoTimeline';
import EstadisticasHeader from '../components/produccion/EstadisticasHeader';
import { sortProyectosPorUrgencia, flattenProyectos, px, s } from '../utils/produccion';

const DashboardProduccionTVPage = () => {
    const [loading, setLoading] = useState(true);
    const [proyectos, setProyectos] = useState([]);
    const [estadisticas, setEstadisticas] = useState({});

    // Zoom & Orientation State
    const [zoomLevel, setZoomLevel] = useState(() => {
        const savedZoom = localStorage.getItem('dashboardTVScale');
        return savedZoom ? parseFloat(savedZoom) : 1;
    });

    const [orientacion, setOrientacion] = useState(() => {
        return localStorage.getItem('dashboardTVOrientation') || 'horizontal';
    });

    useEffect(() => {
        localStorage.setItem('dashboardTVScale', zoomLevel.toString());
    }, [zoomLevel]);

    useEffect(() => {
        localStorage.setItem('dashboardTVOrientation', orientacion);
    }, [orientacion]);

    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 3));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.5));
    const toggleOrientacion = () => setOrientacion(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');

    const cargarDatos = useCallback(async () => {
        try {
            setLoading(true);
            const response = await produccionService.obtenerDashboardPublico();
            if (response.success) {
                setProyectos(flattenProyectos(response.data.resumen));
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
        // Refresh every 1 minute
        const interval = setInterval(cargarDatos, 60 * 1000);
        return () => clearInterval(interval);
    }, [cargarDatos]);

    const proyectosActivos = sortProyectosPorUrgencia(
        proyectos.filter(p => p.etapa_actual !== 'completado' && p.etapa_actual !== 'pendiente')
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
                style={{
                    transform: orientacion === 'vertical' ? 'rotate(90deg)' : 'none',
                    width: orientacion === 'vertical' ? '100vh' : '100vw',
                    height: orientacion === 'vertical' ? '100vw' : '100vh',
                    position: 'absolute',
                    top: orientacion === 'vertical' ? 'calc(50% - 50vw)' : 0,
                    left: orientacion === 'vertical' ? 'calc(50% - 50vh)' : 0,
                }}
            >
                {/* Scrollable Area */}
                <div className="h-full w-full overflow-auto" style={{ padding: px(16) }}>
                    <EstadisticasHeader estadisticas={estadisticas} />

                    <div className="pb-20" style={{ gap: px(16), display: 'flex', flexDirection: 'column' }}>
                        {proyectosActivos.map(proyecto => (
                            <ProyectoTimeline key={proyecto.id} proyecto={proyecto} />
                        ))}
                        {proyectosActivos.length === 0 && (
                            <div className="text-center text-gray-500 font-bold" style={{ padding: px(80), fontSize: s(1.5) }}>
                                No hay proyectos activos en producción
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* En vivo indicator (Bottom Left) */}
            <div
                className={`fixed z-40 bg-white/80 backdrop-blur-sm rounded-full font-medium text-gray-500 shadow-sm border border-gray-100 flex items-center ${orientacion === 'vertical' ? 'bottom-4 right-4' : 'bottom-4 left-4'}`}
                style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', gap: '0.5rem' }}
            >
                <span>En vivo</span>
            </div>

            {/* Controls (Bottom Right) - Hidden until hover */}
            <div className={`fixed z-50 flex gap-2 transition-opacity duration-300 opacity-0 hover:opacity-100 ${orientacion === 'vertical' ? 'bottom-4 left-4' : 'bottom-4 right-4'}`}>
                {/* Scale Controls */}
                <div className="flex bg-gray-900 text-white rounded-lg shadow-xl overflow-hidden border border-gray-700">
                    <button
                        onClick={handleZoomOut}
                        className="p-3 hover:bg-gray-800 active:bg-gray-700 transition-colors"
                        title="Reducir Escala"
                    >
                        <ZoomOut size={20} />
                    </button>
                    <div className="px-3 py-1 text-sm font-bold flex items-center justify-center min-w-[50px] border-x border-gray-700 bg-gray-800">
                        {Math.round(zoomLevel * 100)}%
                    </div>
                    <button
                        onClick={handleZoomIn}
                        className="p-3 hover:bg-gray-800 active:bg-gray-700 transition-colors"
                        title="Aumentar Escala"
                    >
                        <ZoomIn size={20} />
                    </button>
                </div>

                {/* Rotation Toggle */}
                <div className="flex bg-gray-900 text-white rounded-lg shadow-xl overflow-hidden border border-gray-700">
                    <button
                        onClick={toggleOrientacion}
                        className="p-3 hover:bg-gray-800 active:bg-gray-700 transition-colors"
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
