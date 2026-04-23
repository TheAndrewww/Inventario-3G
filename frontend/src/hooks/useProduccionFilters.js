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
            // Búsqueda por nombre del proyecto (ignora acentos y mayúsculas)
            if (q && !normalizarTexto(p.nombre).includes(q)) {
                return false;
            }

            switch (filtro) {
                case 'activos':
                    return p.etapa_actual !== 'completado' && p.etapa_actual !== 'pendiente' && p.etapa_actual !== 'instalacion';
                case 'preparados':
                    return p.etapa_actual === 'instalacion';
                case 'urgentes':
                    return p.prioridad === 1 || (p.diasRestantes !== null && p.diasRestantes <= 3);
                case 'produccion_diseno': {
                    // Proyectos que entran a producción: A/B/C, o MTO/GTIA con EXTENSIVO.
                    // Se excluyen completados y cancelados.
                    if (p.etapa_actual === 'completado') return false;
                    if (p.tipo_proyecto?.toUpperCase().startsWith('CANCELADO')) return false;
                    const tipo = p.tipo_proyecto?.toUpperCase();
                    const esMTOoGTIA = tipo === 'MTO' || tipo === 'GTIA';
                    return !esMTOoGTIA || p.es_extensivo;
                }
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
