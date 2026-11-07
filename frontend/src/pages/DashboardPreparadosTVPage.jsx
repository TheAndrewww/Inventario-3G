import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import EstadisticasHeader from '../components/produccion/EstadisticasHeader';
import { useProduccionData } from '../hooks/useProduccionData';
import { sortProyectosPorUrgencia } from '../utils/produccion';
import VistaTvPreparados from '../rediseno2/piso/VistaTvPreparados';

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

    // Helper: MTO o GTIA que NO son EXTENSIVO van directo a Preparados
    const usaTimelineSimplificado = (p) => {
        const tipo = p.tipo_proyecto?.toUpperCase();
        return (tipo === 'MTO' || tipo === 'GTIA') && !p.es_extensivo;
    };

    // Proyectos PREPARADOS / COMPLETADOS: etapa 'instalacion' o MTO/GTIA simplificados activos.
    // No incluye 'completado' porque ese estado es para los cerrados desde la casilla
    // E del Excel y el backend ya los excluye del dataset.
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

    return (
        <VistaTvPreparados
            proyectos={proyectos} preparados={proyectosPreparados} pausadas={proyectosCongelados}
            cargando={loading && proyectos.length === 0} zoom={zoomLevel} rotacion={rotacion} controlesVisibles={controlsVisible}
            alReducir={handleZoomOut} alAumentar={handleZoomIn} alRotar={rotar}
        />
    );
};

export default DashboardPreparadosTVPage;
