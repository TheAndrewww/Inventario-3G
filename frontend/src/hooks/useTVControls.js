import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook compartido para controles de las vistas TV.
 * - Zoom con persistencia en localStorage
 * - Rotación completa: 0° → 90° → 180° → 270°
 * - Controles visibles al mover el mouse (auto-hide tras 3s)
 */
export const useTVControls = (storagePrefix) => {
    const [zoomLevel, setZoomLevel] = useState(() => {
        const saved = localStorage.getItem(`${storagePrefix}Scale`);
        return saved ? parseFloat(saved) : 1;
    });

    const [rotacion, setRotacion] = useState(() => {
        const saved = localStorage.getItem(`${storagePrefix}Rotation`);
        return saved ? parseInt(saved) : 0;
    });

    const [controlsVisible, setControlsVisible] = useState(false);
    const hideTimerRef = useRef(null);

    // Persistir zoom
    useEffect(() => {
        localStorage.setItem(`${storagePrefix}Scale`, zoomLevel.toString());
    }, [zoomLevel, storagePrefix]);

    // Persistir rotación
    useEffect(() => {
        localStorage.setItem(`${storagePrefix}Rotation`, rotacion.toString());
    }, [rotacion, storagePrefix]);

    // Mouse movement → mostrar controles
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

    // Calcular estilos de rotación
    const getRotationStyle = () => {
        if (rotacion === 0) {
            return {
                transform: 'none',
                width: '100vw',
                height: '100vh',
                position: 'absolute',
                top: 0,
                left: 0,
            };
        }
        if (rotacion === 90) {
            return {
                transform: 'rotate(90deg)',
                width: '100vh',
                height: '100vw',
                position: 'absolute',
                top: 'calc(50% - 50vw)',
                left: 'calc(50% - 50vh)',
            };
        }
        if (rotacion === 180) {
            return {
                transform: 'rotate(180deg)',
                width: '100vw',
                height: '100vh',
                position: 'absolute',
                top: 0,
                left: 0,
            };
        }
        // 270
        return {
            transform: 'rotate(270deg)',
            width: '100vh',
            height: '100vw',
            position: 'absolute',
            top: 'calc(50% - 50vw)',
            left: 'calc(50% - 50vh)',
        };
    };

    return {
        zoomLevel,
        rotacion,
        controlsVisible,
        handleZoomIn,
        handleZoomOut,
        rotar,
        rotationStyle: getRotationStyle(),
    };
};

export default useTVControls;
