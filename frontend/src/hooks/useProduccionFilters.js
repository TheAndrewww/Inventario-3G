import { useState, useMemo } from 'react';
import { sortProyectosPorUrgencia, esProyectoMTO, esUrgenteMTO } from '../utils/produccion';

/**
 * Opciones de filtro disponibles
 */
export const FILTRO_OPCIONES = [
    { value: 'todos', label: 'Todos' },
    { value: 'completados', label: '✅ Completados' },
    { value: 'urgentes', label: '🔴 Urgentes' },
    { value: '_separator', label: '|' },
    { value: 'diseno', label: '✏️ Diseño' },
    { value: 'compras', label: '🛒 Compras' },
    { value: 'produccion', label: '🏗️ Producción' },
    { value: 'manufactura', label: '🏭 Manufactura' },
    { value: 'herreria', label: '⚒️ Herrería' }
];

const esCancelado = (p) => p.tipo_proyecto?.toUpperCase().startsWith('CANCELADO');

// MTO/GTIA sin EXTENSIVO no pasan por diseño/producción: van directo a Completados
const entraAProduccion = (p) => {
    const tipo = p.tipo_proyecto?.toUpperCase();
    return !(tipo === 'MTO' || tipo === 'GTIA') || p.es_extensivo;
};

/**
 * Hook para gestionar filtros del dashboard de producción
 * 
 * @param {array} proyectos - Array de proyectos a filtrar
 * @param {string} filtroInicial - Filtro inicial (default: 'todos')
 */
const normalizarTexto = (s) =>
    (s ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const useProduccionFilters = (proyectos, filtroInicial = 'todos') => {
    const [filtro, setFiltro] = useState(filtroInicial);
    const [busqueda, setBusqueda] = useState('');

    // Memoizar proyectos filtrados y ordenados
    const proyectosFiltrados = useMemo(() => {
        const q = normalizarTexto(busqueda).trim();

        const filtrados = proyectos.filter(p => {
            // Búsqueda por nombre del proyecto (ignora acentos y mayúsculas)
            if (q && !normalizarTexto(p.nombre).includes(q)) {
                return false;
            }

            switch (filtro) {
                case 'completados':
                    // 'instalacion' es la etapa que la UI llama "Completado" (antes 📦 Preparados)
                    return p.etapa_actual === 'instalacion';
                case 'urgentes':
                    // MTO: solo por fecha del calendario ya vencida (no por prioridad ni ventana de 3 días)
                    if (esProyectoMTO(p)) return esUrgenteMTO(p);
                    return p.prioridad === 1 || (p.diasRestantes !== null && p.diasRestantes <= 3);
                case 'diseno':
                    // Por la casilla de diseño, no por etapa_actual: las etapas se
                    // marcan en cualquier orden y etapa_actual es la MÁS avanzada, así
                    // que marcar Compras sin Diseño lo sacaba de aquí.
                    return !p.diseno_completado_en
                        && p.etapa_actual !== 'instalacion'
                        && p.etapa_actual !== 'completado'
                        && !esCancelado(p) && entraAProduccion(p);
                case 'compras':
                    // Diseño ya marcado y compras todavía no: está juntando material.
                    // Por casillas (no etapa_actual) porque se marcan en cualquier orden.
                    return !!p.diseno_completado_en
                        && !p.compras_completado_en
                        && p.etapa_actual !== 'instalacion'
                        && p.etapa_actual !== 'completado'
                        && !esCancelado(p) && entraAProduccion(p);
                case 'produccion':
                    // Compras (o alguna área de producción) ya marcada y sin terminar
                    return p.etapa_actual === 'produccion' && !esCancelado(p) && entraAProduccion(p);
                case 'manufactura':
                    return p.tiene_manufactura
                        && p.etapa_actual !== 'completado'
                        && p.etapa_actual !== 'instalacion';
                case 'herreria':
                    return p.tiene_herreria
                        && p.etapa_actual !== 'completado'
                        && p.etapa_actual !== 'instalacion';
                default:
                    return true;
            }
        });

        return sortProyectosPorUrgencia(filtrados);
    }, [proyectos, filtro, busqueda]);

    return {
        filtro,
        setFiltro,
        busqueda,
        setBusqueda,
        proyectosFiltrados,
        opciones: FILTRO_OPCIONES
    };
};

export default useProduccionFilters;
