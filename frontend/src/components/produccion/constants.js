import {
    Package,
    ShoppingCart,
    Factory,
    Truck,
    CheckCircle2,
    Circle
} from 'lucide-react';

/**
 * Configuración de etapas del flujo de producción
 */
export const ETAPAS_CONFIG = {
    pendiente: { nombre: 'Pendiente', color: '#9CA3AF', bgColor: 'bg-gray-400', icon: Circle, orden: 0 },
    diseno: { nombre: 'Diseño', color: '#8B5CF6', bgColor: 'bg-violet-500', icon: Package, orden: 1 },
    compras: { nombre: 'Compras', color: '#10B981', bgColor: 'bg-emerald-500', icon: ShoppingCart, orden: 2 },
    produccion: { nombre: 'Producción', color: '#F59E0B', bgColor: 'bg-amber-500', icon: Factory, orden: 3 },
    instalacion: { nombre: 'Instalación', color: '#3B82F6', bgColor: 'bg-blue-500', icon: Truck, orden: 4 },
    completado: { nombre: 'Completado', color: '#22C55E', bgColor: 'bg-green-500', icon: CheckCircle2, orden: 5 }
};

export const ETAPAS_ORDEN = ['pendiente', 'diseno', 'compras', 'produccion', 'instalacion', 'completado'];

/**
 * Días máximos por tipo de proyecto (acumulados)
 */
export const TIEMPOS_POR_TIPO = {
    'C': { diseno: 1, compras: 2, produccion: 5, instalacion: 6 },
    'B': { diseno: 2, compras: 5, produccion: 10, instalacion: 13 },
    'A': { diseno: 5, compras: 10, produccion: 20, instalacion: 25 }
};

/**
 * Obtiene colores y clases según tipo de proyecto
 */
export const getColorPorTipo = (tipo) => {
    if (!tipo) return { bg: 'bg-white', border: '', label: '', labelBg: '' };
    const tipoUpper = tipo.toUpperCase().trim();

    if (tipoUpper === 'MTO') {
        return { bg: 'bg-yellow-50', border: 'border-l-4 border-yellow-400', label: 'MTO', labelBg: 'bg-yellow-400 text-yellow-900' };
    }
    if (tipoUpper === 'GTIA') {
        return { bg: 'bg-red-50', border: 'border-l-4 border-red-400', label: 'GTIA', labelBg: 'bg-red-500 text-white' };
    }
    return { bg: 'bg-white', border: '', label: tipoUpper, labelBg: 'bg-gray-200 text-gray-700' };
};

/**
 * Calcula el porcentaje de avance del proyecto
 */
export const calcularPorcentaje = (proyecto) => {
    const esGarantia = proyecto.tipo_proyecto?.toUpperCase() === 'GTIA';
    const esMTO = proyecto.tipo_proyecto?.toUpperCase() === 'MTO';
    const usaTimelineSimplificado = esGarantia || (esMTO && !proyecto.es_extensivo);
    const tieneProduccion = proyecto.tiene_manufactura || proyecto.tiene_herreria;

    if (usaTimelineSimplificado) {
        return proyecto.etapa_actual === 'completado' ? 100 : 50;
    }

    if (tieneProduccion) {
        const etapaActualIndex = ETAPAS_ORDEN.indexOf(proyecto.etapa_actual);
        return Math.round((etapaActualIndex / (ETAPAS_ORDEN.length - 1)) * 100);
    }

    // Sin producción: 4 etapas
    const etapasSinProd = ['diseno', 'compras', 'instalacion', 'completado'];
    let idx = etapasSinProd.indexOf(proyecto.etapa_actual);
    if (idx === -1 && proyecto.etapa_actual === 'produccion') idx = 1;
    if (idx === -1) idx = 0;
    return Math.round((idx / (etapasSinProd.length - 1)) * 100);
};

/**
 * Determina si un proyecto usa timeline simplificado (MTO no extensivo / GTIA)
 */
export const usaTimelineSimplificado = (proyecto) => {
    const esGarantia = proyecto.tipo_proyecto?.toUpperCase() === 'GTIA';
    const esMTO = proyecto.tipo_proyecto?.toUpperCase() === 'MTO';
    return esGarantia || (esMTO && !proyecto.es_extensivo);
};
