import { useState, useMemo } from 'react';
import { sortProyectosPorUrgencia } from '../utils/produccion';

/**
 * Opciones de filtro disponibles
 */
export const FILTRO_OPCIONES = [
    { value: 'todos', label: 'Todos' },
    { value: 'activos', label: 'En Proceso' },
    { value: 'preparados', label: '📦 Preparados' },
    { value: 'urgentes', label: '🔴 Urgentes' },
    { value: '_separator', label: '|' },
    { value: 'produccion_diseno', label: '🏗️ Producción / Diseño' },
    { value: 'manufactura', label: '🏭 Manufactura' },
    { value: 'herreria', label: '⚒️ Herrería' }
];

/**
 * Hook para gestionar filtros del dashboard de producción
 * 
 * @param {array} proyectos - Array de proyectos a filtrar
 * @param {string} filtroInicial - Filtro inicial (default: 'activos')
 */
const normalizarTexto = (s) =>
    (s ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const useProduccionFilters = (proyectos, filtroInicial = 'activos') => {
    const [filtro, setFiltro] = useState(filtroInicial);
    const [busqueda, setBusqueda] = useState('');

    // Memoizar proyectos filtrados y ordenados
    const proyectosFiltrados = useMemo(() => {
        const q = normalizarTexto(busqueda).trim();

        const filtrados = proyectos.filter(p => {
            // Búsqueda libre sobre nombre, cliente y tipo_proyecto (ignora acentos y mayúsculas)
            if (q) {
                const coincide =
                    normalizarTexto(p.nombre).includes(q) ||
                    normalizarTexto(p.cliente).includes(q) ||
                    normalizarTexto(p.tipo_proyecto).includes(q);
                if (!coincide) return false;
            }

            switch (filtro) {
                case 'activos':
                    return p.etapa_actual !== 'completado' && p.etapa_actual !== 'pendiente' && p.etapa_actual !== 'instalacion';
                case 'preparados':
                    return p.etapa_actual === 'instalacion';
                case 'urgentes':
                    return p.prioridad === 1 || (p.diasRestantes !== null && p.diasRestantes <= 3);
                case 'produccion_diseno':
                    // Proyectos normales de producción/diseño (excluyendo los que son solo MTO/GTIA sin extensivo)
                    return p.etapa_actual !== 'completado' &&
                        !p.tipo_proyecto?.toUpperCase().startsWith('CANCELADO') &&
                        (
                            (p.tipo_proyecto !== 'MTO' && p.tipo_proyecto !== 'GTIA') ||
                            (p.tipo_proyecto === 'MTO' && p.es_extensivo)
                        );
                case 'manufactura':
                    return p.tiene_manufactura && p.etapa_actual !== 'completado';
                case 'herreria':
                    return p.tiene_herreria && p.etapa_actual !== 'completado';
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
