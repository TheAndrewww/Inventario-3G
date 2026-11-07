import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
    Circle,
    Factory,
    Scissors,
    Wrench,
    Hammer,
    Paintbrush,
    Package,
    ShoppingCart,
    Truck,
    Star,
    Filter,
} from 'lucide-react';
import VistaAvance from '../rediseno2/produccion/VistaAvance';
import produccionService from '../services/produccion.service';
import { flattenProyectos, sortProyectosPorUrgencia, esProyectoMTO, esUrgenteMTO } from '../utils/produccion';
import toast from 'react-hot-toast';

// ─── Configuración de etapas ───
// Herrería se subdivide en dos sub-pasos: Soldadura y Pintura. Cuando ambos están
// completos, la herrería queda como completada en el dashboard.
const ETAPAS_FLOW = [
    { key: 'manufactura', label: 'Mfra', icon: Scissors, color: '#F59E0B', bgClass: 'bg-amber-50', textClass: 'text-amber-700', borderClass: 'border-amber-200', isSubEtapa: true },
    { key: 'herreria_armado', label: 'Soldadura', icon: Hammer, color: '#EF4444', bgClass: 'bg-red-50', textClass: 'text-red-700', borderClass: 'border-red-200', isSubEtapa: true, parent: 'herreria' },
    { key: 'herreria_pintado', label: 'Pintura', icon: Paintbrush, color: '#B91C1C', bgClass: 'bg-red-50', textClass: 'text-red-700', borderClass: 'border-red-200', isSubEtapa: true, parent: 'herreria' },
];
// Diseño 3G: nombre completo en pantalla (sin abreviaturas)
const nombreEtapaG3 = (g3, etapa) => (g3 && etapa.key === 'manufactura' ? 'Manufactura' : etapa.label);

// Orden de etapas para determinar si están completadas
const ETAPAS_ORDEN = ['pendiente', 'diseno', 'compras', 'produccion', 'instalacion', 'completado'];

/**
 * Determina si una etapa está completada basándose en los timestamps del proyecto
 */
const isEtapaCompletada = (proyecto, etapaKey) => {
    switch (etapaKey) {
        case 'diseno':
            return !!proyecto.diseno_completado_en;
        case 'compras':
            return !!proyecto.compras_completado_en;
        case 'manufactura':
            return !!(proyecto.manufactura_completado || proyecto.manufactura_completado_en);
        case 'herreria':
            return !!(proyecto.herreria_completado || proyecto.herreria_completado_en);
        case 'herreria_armado':
            return !!proyecto.herreria_armado_completado || !!(proyecto.herreria_completado || proyecto.herreria_completado_en);
        case 'herreria_pintado':
            return !!proyecto.herreria_pintado_completado || !!(proyecto.herreria_completado || proyecto.herreria_completado_en);
        case 'instalacion':
            return !!proyecto.instalacion_completado_en || proyecto.etapa_actual === 'completado';
        default:
            return false;
    }
};

/**
 * Determina si una etapa es la siguiente que puede marcarse
 */
const isEtapaActiva = (proyecto, etapaKey) => {
    // Sub-etapas: manufactura / herrería
    if (etapaKey === 'manufactura' || etapaKey === 'herreria') {
        if (etapaKey === 'manufactura' && !proyecto.tiene_manufactura) return false;
        if (etapaKey === 'herreria' && !proyecto.tiene_herreria) return false;
        return !isEtapaCompletada(proyecto, etapaKey);
    }
    // Sub-sub-etapas de herrería (armado / pintado)
    if (etapaKey === 'herreria_armado' || etapaKey === 'herreria_pintado') {
        if (!proyecto.tiene_herreria) return false;
        return !isEtapaCompletada(proyecto, etapaKey);
    }

    // Instalación: requiere que ambas sub-etapas completadas
    if (etapaKey === 'instalacion') {
        const manOk = !proyecto.tiene_manufactura || isEtapaCompletada(proyecto, 'manufactura');
        const herOk = !proyecto.tiene_herreria || isEtapaCompletada(proyecto, 'herreria');
        const tieneProduccion = proyecto.tiene_manufactura || proyecto.tiene_herreria;
        if (tieneProduccion) {
            return manOk && herOk && !isEtapaCompletada(proyecto, 'instalacion');
        } else {
            return isEtapaCompletada(proyecto, 'compras') && !isEtapaCompletada(proyecto, 'instalacion');
        }
    }

    return false;
};

/**
 * Determina si una etapa es visible (aplicable) para el proyecto
 */
const isEtapaVisible = (proyecto, etapaKey) => {
    if (etapaKey === 'manufactura') return !!proyecto.tiene_manufactura;
    if (etapaKey === 'herreria') return !!proyecto.tiene_herreria;
    if (etapaKey === 'herreria_armado' || etapaKey === 'herreria_pintado') return !!proyecto.tiene_herreria;
    return true;
};

// ─── Filtros rápidos ───

// ─── Página principal ───
const AvanceProduccionPage = () => {
    const [proyectos, setProyectos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const [confirmModal, setConfirmModal] = useState({ open: false, proyecto: null, etapa: null });
    const [procesando, setProcesando] = useState(false);
    const mountedRef = useRef(true);    
    // Rediseño 2: el error de la última carga, para que la vista nueva diga qué pasó y ofrezca «Reintentar»
    // (la petición y el aviso flotante de siempre no cambian; apagado no se pinta)
    const [errorCarga, setErrorCarga] = useState(null);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // Cargar proyectos
    const cargarProyectos = useCallback(async (showLoader = true) => {
        try {
            if (showLoader) setLoading(true);
            else setRefreshing(true);

            const response = await produccionService.obtenerDashboard();
            if (response.success && mountedRef.current) {
                const proys = flattenProyectos(response.data.resumen);
                setProyectos(proys);
                setErrorCarga(null);
            }
        } catch (error) {
            console.error('Error loading projects:', error);
            toast.error('Error al cargar proyectos');
            if (mountedRef.current) setErrorCarga(error.response?.data?.message || error.message || 'Error al cargar proyectos');
        } finally {
            if (mountedRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, []);

    useEffect(() => {
        cargarProyectos();
        const interval = setInterval(() => cargarProyectos(false), 30000);
        return () => clearInterval(interval);
    }, [cargarProyectos]);

    // Filtrar proyectos
    const proyectosFiltrados = useMemo(() => {
        // Mostrar proyectos con manufactura o herrería pendiente
        let filtered = proyectos.filter(p => {
            if (p.pausado || p.etapa_actual === 'completado') return false;
            const mfraPendiente = p.tiene_manufactura && !p.manufactura_completado && !p.manufactura_completado_en;
            const herrPendiente = p.tiene_herreria && !p.herreria_completado && !p.herreria_completado_en;
            return mfraPendiente || herrPendiente;
        });

        // Búsqueda
        if (busqueda.trim()) {
            const q = busqueda.toLowerCase();
            filtered = filtered.filter(p =>
                p.nombre?.toLowerCase().includes(q) ||
                p.cliente?.toLowerCase().includes(q)
            );
        }

        return sortProyectosPorUrgencia(filtered);
    }, [proyectos, busqueda]);

    // Abrir modal
    const handleMarcarEtapa = (proyecto, etapa) => {
        setConfirmModal({ open: true, proyecto, etapa });
    };

    // Confirmar marcación
    const handleConfirm = async () => {
        const { proyecto, etapa } = confirmModal;
        if (!proyecto || !etapa) return;

        setProcesando(true);
        try {
            if (etapa.isSubEtapa) {
                // Sub-etapas: manufactura / herrería
                await produccionService.completarSubEtapa(proyecto.id, etapa.key);
            } else {
                // Etapas normales: toggle solo para completar (nunca desmarcar)
                await produccionService.toggleEtapa(proyecto.id, etapa.key, true);
            }

            toast.success(
                <div className="text-center">
                    <span className="font-bold">{nombreEtapaG3(true, etapa)}</span> completado
                </div>,
                { duration: 2000 }
            );

            setConfirmModal({ open: false, proyecto: null, etapa: null });
            await cargarProyectos(false);
        } catch (error) {
            console.error('Error marking stage:', error);
            toast.error(error.response?.data?.message || 'Error al marcar etapa');
        } finally {
            setProcesando(false);
        }
    };

    return (
        <VistaAvance
            proyectosFiltrados={proyectosFiltrados} loading={loading} refreshing={refreshing} errorCarga={errorCarga}
            busqueda={busqueda} setBusqueda={setBusqueda} cargarProyectos={cargarProyectos}
            confirmModal={confirmModal} setConfirmModal={setConfirmModal} procesando={procesando}
            handleMarcarEtapa={handleMarcarEtapa} handleConfirm={handleConfirm}
            ETAPAS_FLOW={ETAPAS_FLOW} isEtapaCompletada={isEtapaCompletada} isEtapaActiva={isEtapaActiva}
            isEtapaVisible={isEtapaVisible} nombreEtapaG3={nombreEtapaG3}
            esProyectoMTO={esProyectoMTO} esUrgenteMTO={esUrgenteMTO}
        />
    );
};

export default AvanceProduccionPage;
