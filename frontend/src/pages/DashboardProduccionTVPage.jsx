import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useProduccionData } from '../hooks/useProduccionData';
import { sortProyectosPorUrgencia } from '../utils/produccion';
import VistaTvProduccion from '../rediseno2/piso/VistaTvProduccion';

const DashboardProduccionTVPage = () => {
    // Hook para datos (modo público, refresh cada 1 min)
    const { proyectos, estadisticas, loading } = useProduccionData({
        autoSync: false,
        refreshInterval: 60 * 1000,
        isPublic: true
    });

    // Zoom y Orientación (persistidos en localStorage)
    const [zoomLevel, setZoomLevel] = useState(() => {
        const savedZoom = localStorage.getItem('dashboardTVScale');
        return savedZoom ? parseFloat(savedZoom) : 1;
    });

    const [rotacion, setRotacion] = useState(() => {
        const saved = localStorage.getItem('dashboardTVRotation');
        return saved ? parseInt(saved) : 0;
    });

    const [controlsVisible, setControlsVisible] = useState(false);
    const hideTimerRef = useRef(null);

    useEffect(() => {
        localStorage.setItem('dashboardTVScale', zoomLevel.toString());
    }, [zoomLevel]);

    useEffect(() => {
        localStorage.setItem('dashboardTVRotation', rotacion.toString());
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

    // Proyectos EN PRODUCCIÓN (diseño, compras, produccion) excluyendo preparados, pausados y MTO/GTIA simplificados
    const proyectosActivos = useMemo(() =>
        sortProyectosPorUrgencia(
            proyectos.filter(p =>
                p.etapa_actual !== 'completado' &&
                p.etapa_actual !== 'pendiente' &&
                p.etapa_actual !== 'instalacion' &&
                !p.pausado &&
                !usaTimelineSimplificado(p)
            )
        ),
        [proyectos]
    );

    // Proyectos congelados (pausados)
    const proyectosCongelados = useMemo(() =>
        proyectos.filter(p => p.pausado),
        [proyectos]
    );

    return (
        <VistaTvProduccion
            proyectos={proyectos} activos={proyectosActivos} pausadas={proyectosCongelados} estadisticas={estadisticas}
            cargando={loading && proyectos.length === 0} zoom={zoomLevel} rotacion={rotacion} controlesVisibles={controlsVisible}
            alReducir={handleZoomOut} alAumentar={handleZoomIn} alRotar={rotar}
        />
    );
};

export default DashboardProduccionTVPage;
