import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useProduccionData } from '../hooks/useProduccionData';
import { sortProyectosPorUrgencia, calcularDiasPorEtapa, calcularDiasHabiles, getHoyStr } from '../utils/produccion';
import VistaTvArea from '../rediseno2/piso/VistaTvArea';

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

    return (
        <VistaTvArea
            area="manufactura" proyectos={proyectos} lista={enProduccion}
            cargando={loading && proyectos.length === 0} zoom={zoomLevel} rotacion={rotacion} controlesVisibles={controlsVisible}
            alReducir={handleZoomOut} alAumentar={handleZoomIn} alRotar={rotar}
        />
    );
};

export default DashboardManufacturaTVPage;
