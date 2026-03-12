import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Clock, AlertTriangle, Calendar } from 'lucide-react';
import { Loader } from '../components/common';
import { Toaster } from 'react-hot-toast';
import { useProduccionData } from '../hooks/useProduccionData';
import { sortProyectosPorUrgencia, calcularDiasPorEtapa, calcularDiasHabiles, getHoyStr } from '../utils/produccion';
import { px } from '../utils/produccion';

/**
 * Tarjeta grande de proyecto para el TV de Manufactura
 */
const ProyectoCardManufactura = ({ proyecto }) => {
    // Calcular fecha límite del ÁREA (producción) usando la misma lógica del dashboard
    const diasPorEtapa = calcularDiasPorEtapa(proyecto);

    const dateToStr = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    let fechaLimiteArea = proyecto.fecha_limite;
    let diasRestantesArea = proyecto.diasRestantes;

    if (diasPorEtapa?.produccion) {
        fechaLimiteArea = dateToStr(diasPorEtapa.produccion.fechaLimite);
        diasRestantesArea = diasPorEtapa.produccion.dias;
    }

    // Dos niveles: advertencia (≤2 días, borde rojo) y crítico (≤1 día, fondo rojo + parpadeo)
    const critico = proyecto.prioridad === 1 || (diasRestantesArea !== null && diasRestantesArea <= 1);
    const advertencia = !critico && (diasRestantesArea !== null && diasRestantesArea <= 2);

    const formatFecha = (fecha) => {
        if (!fecha) return '—';
        if (fecha === fechaLimiteArea) {
            if (diasRestantesArea === 0) return 'HOY';
            if (diasRestantesArea === 1) return 'MAÑANA';
        }
        return new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    };

    return (
        <div
            className={`rounded-2xl border-2 p-10 transition-all ${critico ? 'border-red-500' : advertencia ? 'border-red-400 bg-amber-50' : 'bg-amber-50 border-amber-300'}`}
            style={critico ? { animation: 'pulseRed 2.5s ease-in-out infinite', background: '#fecaca' } : {}}
        >
            <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-5 min-w-0 flex-1">
                    <Clock size={44} className={`${(critico || advertencia) ? 'text-red-600' : 'text-amber-500 animate-pulse'} shrink-0`} />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-4 flex-wrap">
                            <h3 className="font-bold text-gray-900 text-5xl">{proyecto.nombre}</h3>
                            {critico && (
                                <span className="inline-flex items-center gap-2 px-5 py-2 bg-red-100 text-red-700 rounded-full text-lg font-bold shrink-0">
                                    <AlertTriangle size={24} /> URGENTE
                                </span>
                            )}
                            {proyecto.tipo_proyecto && (
                                <span className="px-5 py-2 bg-gray-200 text-gray-700 rounded-full text-lg font-semibold shrink-0">
                                    {proyecto.tipo_proyecto}
                                </span>
                            )}
                        </div>
                        {proyecto.cliente && (
                            <p className="text-2xl text-gray-500 mt-2">{proyecto.cliente}</p>
                        )}
                    </div>
                </div>
                <div className="text-right shrink-0 space-y-3">
                    {fechaLimiteArea && (
                        <>
                            <span className="text-4xl font-bold text-gray-600 block mb-2">Fecha de entrega</span>
                            <div className={`flex items-center gap-3 px-6 py-4 rounded-xl ${diasRestantesArea !== null && diasRestantesArea <= 2 ? 'bg-red-200/60 border border-red-300' : 'bg-white/60 border border-gray-200'}`}>
                                <Calendar size={32} className={diasRestantesArea !== null && diasRestantesArea <= 2 ? 'text-red-500' : 'text-gray-400'} />
                                <span className={`font-bold text-5xl ${diasRestantesArea !== null && diasRestantesArea <= 2 ? 'text-red-700' : 'text-gray-800'}`}>
                                    {formatFecha(fechaLimiteArea)}
                                </span>
                            </div>
                        </>
                    )}
                    {diasRestantesArea !== null && diasRestantesArea >= 0 && (
                        <p className={`text-xl font-bold ${diasRestantesArea <= 2 ? 'text-red-600' : 'text-gray-500'}`}>
                            {diasRestantesArea} día{diasRestantesArea !== 1 ? 's' : ''} restante{diasRestantesArea !== 1 ? 's' : ''}
                        </p>
                    )}
                    {diasRestantesArea !== null && diasRestantesArea < 0 && (
                        <p className="text-xl font-bold text-red-600">
                            {Math.abs(diasRestantesArea)} día{Math.abs(diasRestantesArea) !== 1 ? 's' : ''} de atraso
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
    const enProduccion = useMemo(() => {
        const filtered = proyectos.filter(p =>
            p.tiene_manufactura &&
            p.etapa_actual !== 'completado' &&
            !p.pausado &&
            !(p.estadoSubEtapas?.manufactura?.completado || p.manufactura_completado)
        );

        // Helper: calcular diasRestantes del ÁREA usando la misma lógica del dashboard
        const getDiasArea = (p) => {
            const diasPorEtapa = calcularDiasPorEtapa(p);
            if (diasPorEtapa?.produccion) {
                return diasPorEtapa.produccion.dias;
            }
            return p.diasRestantes ?? 999;
        };

        // Ordenar por: vencidos primero (más atraso arriba), luego menos días restantes
        return [...filtered].sort((a, b) => {
            const aDias = getDiasArea(a);
            const bDias = getDiasArea(b);
            return aDias - bDias;
        });
    }, [proyectos]);

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
                                <h1 className="text-3xl font-bold text-gray-900">Producción de Manufactura</h1>
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
