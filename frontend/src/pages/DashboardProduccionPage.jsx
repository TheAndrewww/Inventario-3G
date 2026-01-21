import React, { useState, useEffect, useCallback } from 'react';
import {
    Package,
    ShoppingCart,
    Factory,
    Truck,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Plus,
    RefreshCw,
    ChevronRight,
    X,
    Calendar,
    User,
    Circle,
    Download,
    Maximize2,
    Minimize2,
    RotateCw,
    ZoomIn
} from 'lucide-react';
import produccionService from '../services/produccion.service';
import { Loader, Modal, Button } from '../components/common';
import toast from 'react-hot-toast';

// Configuración de etapas con colores e iconos
const ETAPAS_CONFIG = {
    pendiente: {
        nombre: 'Pendiente',
        color: '#9CA3AF',
        bgColor: 'bg-gray-400',
        icon: Circle,
        orden: 0
    },
    diseno: {
        nombre: 'Diseño',
        color: '#8B5CF6',
        bgColor: 'bg-violet-500',
        icon: Package,
        orden: 1
    },
    compras: {
        nombre: 'Compras',
        color: '#10B981',
        bgColor: 'bg-emerald-500',
        icon: ShoppingCart,
        orden: 2
    },
    produccion: {
        nombre: 'Producción',
        color: '#F59E0B',
        bgColor: 'bg-amber-500',
        icon: Factory,
        orden: 3
    },
    instalacion: {
        nombre: 'Instalación',
        color: '#3B82F6',
        bgColor: 'bg-blue-500',
        icon: Truck,
        orden: 4
    },
    completado: {
        nombre: 'Completado',
        color: '#22C55E',
        bgColor: 'bg-green-500',
        icon: CheckCircle2,
        orden: 5
    }
};

const ETAPAS_ORDEN = ['pendiente', 'diseno', 'compras', 'produccion', 'instalacion', 'completado'];

// Componente de línea de tiempo para un proyecto - Diseño Stepper Profesional
const ProyectoTimeline = ({ proyecto, onCompletar, isFullscreen = false, orientacion = 'horizontal', tamano = 'mediano' }) => {
    const [loading, setLoading] = useState(false);
    const diasRestantes = proyecto.diasRestantes;
    const esGarantia = proyecto.tipo_proyecto?.toUpperCase() === 'GTIA';
    const esUrgente = proyecto.prioridad === 1 || esGarantia || (diasRestantes !== null && diasRestantes <= 3);
    const etapaActualIndex = ETAPAS_ORDEN.indexOf(proyecto.etapa_actual);
    const porcentaje = Math.round((etapaActualIndex / (ETAPAS_ORDEN.length - 1)) * 100);

    // Obtener color de fondo según tipo de proyecto
    const getColorPorTipo = (tipo) => {
        if (!tipo) return { bg: 'bg-white', border: '', label: '' };
        const tipoUpper = tipo.toUpperCase().trim();

        if (tipoUpper === 'MTO') {
            return {
                bg: 'bg-yellow-50',
                border: 'border-l-4 border-yellow-400',
                label: 'MTO',
                labelBg: 'bg-yellow-400 text-yellow-900'
            };
        }
        if (tipoUpper === 'GTIA') {
            return {
                bg: 'bg-red-50',
                border: 'border-l-4 border-red-400',
                label: 'GTIA',
                labelBg: 'bg-red-500 text-white'
            };
        }
        // A, B, C o cualquier otro = blanco
        return {
            bg: 'bg-white',
            border: '',
            label: tipoUpper,
            labelBg: 'bg-gray-200 text-gray-700'
        };
    };

    const colorTipo = getColorPorTipo(proyecto.tipo_proyecto);

    const handleCompletar = async () => {
        if (loading || proyecto.etapa_actual === 'completado') return;
        setLoading(true);
        try {
            await onCompletar(proyecto.id);
        } finally {
            setLoading(false);
        }
    };

    // Solo mostrar etapas principales (sin pendiente)
    const etapasVisibles = ETAPAS_ORDEN.filter(e => e !== 'pendiente');

    // Clases según tamaño y orientación
    const getCardClasses = () => {
        // Modo normal (no fullscreen)
        if (!isFullscreen) {
            return `${colorTipo.bg} ${colorTipo.border} rounded-2xl shadow-lg overflow-hidden mb-5 transition-all hover:shadow-xl ${esUrgente ? 'ring-2 ring-red-400' : ''}`;
        }

        const baseClasses = `${colorTipo.bg} ${colorTipo.border} overflow-hidden transition-all ${esUrgente ? 'ring-2 ring-red-400' : ''}`;

        // Modo vertical: cards ultra-compactas para caber 6 en pantalla
        if (orientacion === 'vertical') {
            return `${baseClasses} rounded-lg shadow-sm mb-1`;
        }

        // Modo horizontal según tamaño
        if (tamano === 'pequeno') {
            return `${baseClasses} rounded-lg shadow-sm hover:shadow-md`;
        } else if (tamano === 'grande') {
            return `${baseClasses} rounded-2xl shadow-lg hover:shadow-xl`;
        }
        return `${baseClasses} rounded-xl shadow-md hover:shadow-lg`;
    };

    // Padding según tamaño y orientación
    const getPadding = () => {
        if (!isFullscreen) return 'px-6 py-4';

        // Modo vertical: padding muy reducido
        if (orientacion === 'vertical') return 'px-2 py-1';

        if (tamano === 'pequeno') return 'px-3 py-2';
        if (tamano === 'grande') return 'px-8 py-5';
        return 'px-5 py-3';
    };

    // Tamaño de texto según tamaño y orientación
    const getTitleSize = () => {
        if (!isFullscreen) return 'text-lg';

        // Modo vertical: texto pequeño
        if (orientacion === 'vertical') return 'text-xs';

        if (tamano === 'pequeno') return 'text-sm';
        if (tamano === 'grande') return 'text-xl';
        return 'text-base';
    };

    // ¿Es modo compacto? (vertical o pequeño)
    const esCompacto = isFullscreen && (orientacion === 'vertical' || tamano === 'pequeno');

    return (
        <div className={getCardClasses()}>
            {/* Modo vertical ultra-compacto: todo en una línea */}
            {isFullscreen && orientacion === 'vertical' ? (
                <div className={`flex items-center gap-2 ${getPadding()}`}>
                    {/* Badge tipo + urgente */}
                    <div className="flex gap-1 flex-shrink-0">
                        {colorTipo.label && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colorTipo.labelBg}`}>
                                {colorTipo.label}
                            </span>
                        )}
                        {esUrgente && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500 text-white">
                                !
                            </span>
                        )}
                    </div>

                    {/* Nombre (truncado) */}
                    <span className={`${getTitleSize()} font-semibold text-gray-900 truncate flex-1`}>
                        {proyecto.nombre}
                    </span>

                    {/* Etapa */}
                    <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                            backgroundColor: `${ETAPAS_CONFIG[proyecto.etapa_actual]?.color}20`,
                            color: ETAPAS_CONFIG[proyecto.etapa_actual]?.color
                        }}
                    >
                        {ETAPAS_CONFIG[proyecto.etapa_actual]?.nombre}
                    </span>

                    {/* Porcentaje */}
                    <span className="text-xs font-bold text-gray-600 flex-shrink-0 w-8 text-right">
                        {porcentaje}%
                    </span>

                    {/* Días restantes */}
                    {proyecto.fecha_limite && (
                        <span className={`text-[10px] font-medium flex-shrink-0 ${diasRestantes !== null && diasRestantes <= 3 ? 'text-red-600' : 'text-gray-400'
                            }`}>
                            {diasRestantes !== null && diasRestantes < 0
                                ? 'Venc'
                                : diasRestantes === 0
                                    ? 'Hoy'
                                    : `${diasRestantes}d`
                            }
                        </span>
                    )}
                </div>
            ) : (
                /* Modo normal: cards completas */
                <>
                    {/* Header con gradiente sutil */}
                    <div className={`${colorTipo.bg === 'bg-white' ? 'bg-gradient-to-r from-gray-50 to-white' : ''} ${getPadding()} border-b border-gray-100`}>
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className={`flex items-center gap-${esCompacto ? '1' : '3'} mb-${esCompacto ? '1' : '2'}`}>
                                    {/* Badge de tipo de proyecto */}
                                    {colorTipo.label && (
                                        <span className={`inline-flex items-center ${esCompacto ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1'} font-bold rounded-full ${colorTipo.labelBg}`}>
                                            {colorTipo.label}
                                        </span>
                                    )}
                                    {esUrgente && (
                                        <span className={`inline-flex items-center gap-1 bg-red-500 text-white ${esCompacto ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1'} font-bold rounded-full ${esCompacto ? '' : 'animate-pulse shadow-sm'}`}>
                                            {!esCompacto && <AlertTriangle size={12} />}
                                            {esCompacto ? '!' : 'URGENTE'}
                                        </span>
                                    )}
                                    {proyecto.prioridad === 2 && !esUrgente && !esCompacto && (
                                        <span className="inline-flex items-center gap-1 bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                            ALTA
                                        </span>
                                    )}
                                    <span
                                        className={`inline-flex items-center gap-1 ${esCompacto ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1'} font-semibold rounded-full`}
                                        style={{
                                            backgroundColor: `${ETAPAS_CONFIG[proyecto.etapa_actual]?.color}15`,
                                            color: ETAPAS_CONFIG[proyecto.etapa_actual]?.color
                                        }}
                                    >
                                        {ETAPAS_CONFIG[proyecto.etapa_actual]?.nombre}
                                    </span>
                                </div>
                                <h3 className={`font-bold ${getTitleSize()} text-gray-900 leading-tight ${esCompacto ? 'truncate' : ''}`}>{proyecto.nombre}</h3>
                                {proyecto.cliente && !esCompacto && (
                                    <p className="text-gray-500 text-sm flex items-center gap-1.5 mt-1">
                                        <User size={14} className="text-gray-400" />
                                        {proyecto.cliente}
                                    </p>
                                )}
                            </div>

                            {/* Indicador de progreso circular */}
                            <div className="flex flex-col items-center">
                                <div className="relative w-16 h-16">
                                    {/* Círculo de fondo */}
                                    <svg className="w-16 h-16 transform -rotate-90">
                                        <circle
                                            cx="32" cy="32" r="28"
                                            stroke="#E5E7EB"
                                            strokeWidth="6"
                                            fill="none"
                                        />
                                        <circle
                                            cx="32" cy="32" r="28"
                                            stroke={ETAPAS_CONFIG[proyecto.etapa_actual]?.color}
                                            strokeWidth="6"
                                            fill="none"
                                            strokeLinecap="round"
                                            strokeDasharray={`${porcentaje * 1.76} 176`}
                                            className="transition-all duration-500"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-lg font-bold text-gray-700">{porcentaje}%</span>
                                    </div>
                                </div>
                                {proyecto.fecha_limite && (
                                    <div className={`text-center mt-1 ${diasRestantes !== null && diasRestantes <= 3 ? 'text-red-600' : 'text-gray-500'
                                        }`}>
                                        <div className="flex items-center gap-1 text-xs font-medium">
                                            <Clock size={11} />
                                            {diasRestantes !== null && diasRestantes < 0
                                                ? `Vencido`
                                                : diasRestantes === 0
                                                    ? 'Hoy'
                                                    : `${diasRestantes}d`
                                            }
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Stepper Profesional con Conexiones SVG */}
                    <div className="px-6 py-8 bg-gray-50 relative overflow-visible" style={{ height: '220px' }}>

                        {/* Cuadro de fecha de entrega - Pegado a la derecha */}
                        {proyecto.fecha_limite && (
                            <div className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1.5 px-5 py-4 rounded-xl shadow-md ${diasRestantes !== null && diasRestantes < 0
                                ? 'bg-red-100 text-red-700 border border-red-200'
                                : diasRestantes !== null && diasRestantes <= 3
                                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                    : 'bg-white text-gray-700 border border-gray-200'
                                }`}>
                                <Calendar size={24} className="mb-1" />
                                <span className="text-sm font-medium text-gray-500">Entrega</span>
                                <span className="text-lg font-bold">
                                    {new Date(proyecto.fecha_limite).toLocaleDateString('es-MX', {
                                        day: 'numeric',
                                        month: 'short'
                                    })}
                                </span>
                                {diasRestantes !== null && (
                                    <span className={`text-sm font-semibold ${diasRestantes < 0 ? 'text-red-600' : diasRestantes <= 3 ? 'text-amber-600' : 'text-gray-500'
                                        }`}>
                                        {diasRestantes < 0 ? 'Vencido' : diasRestantes === 0 ? 'Hoy' : `${diasRestantes} días`}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Capa de Conexiones (SVG) */}
                        <svg
                            className="absolute inset-0 w-full h-full pointer-events-none z-0"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                        >
                            <defs>
                                <linearGradient id="gradGreen" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#10B981" />
                                    <stop offset="100%" stopColor="#10B981" />
                                </linearGradient>
                            </defs>

                            {/* Lógica de colores para líneas */}
                            {(() => {
                                // Detectar qué ramas tiene el proyecto (desde Drive)
                                const tieneManufactura = proyecto.tiene_manufactura !== false; // true por defecto si no está definido
                                const tieneHerreria = proyecto.tiene_herreria !== false;
                                const tieneAmbas = tieneManufactura && tieneHerreria;
                                const tieneSoloUna = (tieneManufactura && !tieneHerreria) || (!tieneManufactura && tieneHerreria);

                                // Función helper para determinar color de línea base
                                const getStrokeColor = (baseStage) => {
                                    const etapas = ['pendiente', 'diseno', 'compras', 'produccion', 'instalacion', 'completado'];
                                    const currentIndex = etapas.indexOf(proyecto.etapa_actual);
                                    const baseIndex = etapas.indexOf(baseStage);
                                    return currentIndex > baseIndex ? '#10B981' : '#CBD5E1';
                                };

                                // Función helper para sub-etapas
                                const getSubStageStroke = (subStage) => {
                                    const etapas = ['pendiente', 'diseno', 'compras', 'produccion', 'instalacion', 'completado'];
                                    const currentIndex = etapas.indexOf(proyecto.etapa_actual);
                                    const prodIndex = etapas.indexOf('produccion');

                                    // Si ya pasó producción (está en instalación o completado), es verde
                                    if (currentIndex > prodIndex) return '#10B981';

                                    // Si está EN producción, depende del booleano específico
                                    if (currentIndex === prodIndex) {
                                        return proyecto.estadoSubEtapas?.[subStage]?.completado ? '#10B981' : '#CBD5E1';
                                    }

                                    // Si está antes de producción, gris
                                    return '#CBD5E1';
                                };

                                return (
                                    <>
                                        {/* Diseño -> Compras */}
                                        <line x1="10" y1="40" x2="30" y2="40" stroke={getStrokeColor('diseno')} strokeWidth="4" vectorEffect="non-scaling-stroke" />

                                        {/* Stepper Bifurcado (tiene ambas ramas) */}
                                        {tieneAmbas && (
                                            <>
                                                {/* Compras -> Manufactura (Recto/Ortogonal) */}
                                                <path d="M 30 40 L 40 40 L 40 20 L 50 20" fill="none" stroke={getStrokeColor('compras')} strokeWidth="4" vectorEffect="non-scaling-stroke" />

                                                {/* Compras -> Herrería (Recto/Ortogonal) */}
                                                <path d="M 30 40 L 40 40 L 40 60 L 50 60" fill="none" stroke={getStrokeColor('compras')} strokeWidth="4" vectorEffect="non-scaling-stroke" />

                                                {/* Manufactura -> Instalación (Recto/Ortogonal) */}
                                                <path d="M 50 20 L 60 20 L 60 40 L 70 40" fill="none" stroke={getSubStageStroke('manufactura')} strokeWidth="4" vectorEffect="non-scaling-stroke" />

                                                {/* Herrería -> Instalación (Recto/Ortogonal) */}
                                                <path d="M 50 60 L 60 60 L 60 40 L 70 40" fill="none" stroke={getSubStageStroke('herreria')} strokeWidth="4" vectorEffect="non-scaling-stroke" />
                                            </>
                                        )}

                                        {/* Stepper con solo Manufactura (línea por arriba, herrería desactivada) */}
                                        {tieneManufactura && !tieneHerreria && (
                                            <>
                                                {/* Compras -> Manufactura (Recto/Ortogonal) */}
                                                <path d="M 30 40 L 40 40 L 40 20 L 50 20" fill="none" stroke={getStrokeColor('compras')} strokeWidth="4" vectorEffect="non-scaling-stroke" />

                                                {/* Manufactura -> Instalación (Recto/Ortogonal) */}
                                                <path d="M 50 20 L 60 20 L 60 40 L 70 40" fill="none" stroke={getSubStageStroke('manufactura')} strokeWidth="4" vectorEffect="non-scaling-stroke" />
                                            </>
                                        )}

                                        {/* Stepper con solo Herrería (línea por abajo, manufactura desactivada) */}
                                        {!tieneManufactura && tieneHerreria && (
                                            <>
                                                {/* Compras -> Herrería (Recto/Ortogonal) */}
                                                <path d="M 30 40 L 40 40 L 40 60 L 50 60" fill="none" stroke={getStrokeColor('compras')} strokeWidth="4" vectorEffect="non-scaling-stroke" />

                                                {/* Herrería -> Instalación (Recto/Ortogonal) */}
                                                <path d="M 50 60 L 60 60 L 60 40 L 70 40" fill="none" stroke={getSubStageStroke('herreria')} strokeWidth="4" vectorEffect="non-scaling-stroke" />
                                            </>
                                        )}

                                        {/* Si no tiene ninguna (fallback: línea directa) */}
                                        {!tieneManufactura && !tieneHerreria && (
                                            <line x1="30" y1="40" x2="70" y2="40" stroke={getStrokeColor('compras')} strokeWidth="4" vectorEffect="non-scaling-stroke" />
                                        )}

                                        {/* Instalación -> Completado */}
                                        <line x1="70" y1="40" x2="90" y2="40" stroke={getStrokeColor('instalacion')} strokeWidth="4" vectorEffect="non-scaling-stroke" />
                                    </>
                                );
                            })()}
                        </svg>

                        {/* --- NODOS DEL STEPPER --- */}

                        {/* 1. DISEÑO (10%, 50%) */}
                        <div className="absolute top-[40%] left-[10%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-colors duration-300 ${ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 1 ? 'bg-green-500 text-white' :
                                proyecto.etapa_actual === 'diseno' ? 'bg-white ring-4 ring-violet-200 text-violet-600' : 'bg-white border-2 border-gray-200 text-gray-400'
                                }`}>
                                {ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 1 ? <CheckCircle2 size={24} /> : <Package size={20} />}
                            </div>
                            <span className="absolute top-14 text-xs font-bold text-gray-600 bg-gray-50 px-1">Diseño</span>
                        </div>

                        {/* 2. COMPRAS (30%, 50%) */}
                        <div className="absolute top-[40%] left-[30%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-colors duration-300 ${ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 2 ? 'bg-green-500 text-white' :
                                proyecto.etapa_actual === 'compras' ? 'bg-white ring-4 ring-emerald-200 text-emerald-600' : 'bg-white border-2 border-gray-200 text-gray-400'
                                }`}>
                                {ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 2 ? <CheckCircle2 size={24} /> : <ShoppingCart size={20} />}
                            </div>
                            <span className="absolute top-14 text-xs font-bold text-gray-600 bg-gray-50 px-1">Compras</span>
                        </div>

                        {/* 3A. MANUFACTURA (50%, 25%) - Solo si tiene archivos de manufactura */}
                        {proyecto.tiene_manufactura !== false && (
                            <div className="absolute top-[20%] left-[50%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-colors duration-300 ${(proyecto.estadoSubEtapas?.manufactura?.completado || ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 3) ? 'bg-green-500 text-white' :
                                    proyecto.etapa_actual === 'produccion' ? 'bg-white ring-4 ring-amber-200 text-amber-500' : 'bg-white border-2 border-gray-200 text-gray-400'
                                    }`}>
                                    {(proyecto.estadoSubEtapas?.manufactura?.completado || ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 3) ? <CheckCircle2 size={24} /> : <Factory size={20} />}
                                </div>
                                <span className="absolute top-14 text-xs font-bold text-gray-600 bg-gray-50 px-1">Manufactura</span>
                            </div>
                        )}

                        {/* 3B. HERRERÍA (50%, 75%) - Solo si tiene archivos de herrería */}
                        {proyecto.tiene_herreria !== false && (
                            <div className="absolute top-[60%] left-[50%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-colors duration-300 ${(proyecto.estadoSubEtapas?.herreria?.completado || ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 3) ? 'bg-green-500 text-white' :
                                    proyecto.etapa_actual === 'produccion' ? 'bg-white ring-4 ring-red-200 text-red-500' : 'bg-white border-2 border-gray-200 text-gray-400'
                                    }`}>
                                    {(proyecto.estadoSubEtapas?.herreria?.completado || ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 3) ? <CheckCircle2 size={24} /> : <Factory size={20} />}
                                </div>
                                <span className="absolute top-14 text-xs font-bold text-gray-600 bg-gray-50 px-1">Herrería</span>
                            </div>
                        )}

                        {/* 4. INSTALACIÓN (70%, 50%) */}
                        <div className="absolute top-[40%] left-[70%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-colors duration-300 ${ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 4 ? 'bg-green-500 text-white' :
                                proyecto.etapa_actual === 'instalacion' ? 'bg-white ring-4 ring-blue-200 text-blue-500' : 'bg-white border-2 border-gray-200 text-gray-400'
                                }`}>
                                {ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 4 ? <CheckCircle2 size={24} /> : <Truck size={20} />}
                            </div>
                            <span className="absolute top-14 text-xs font-bold text-gray-600 bg-gray-50 px-1">Instalación</span>
                        </div>

                        {/* 5. COMPLETADO (90%, 50%) */}
                        <div className="absolute top-[40%] left-[90%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-colors duration-300 ${proyecto.etapa_actual === 'completado' ? 'bg-green-500 text-white' : 'bg-white border-2 border-gray-200 text-gray-400'
                                }`}>
                                <CheckCircle2 size={24} />
                            </div>
                            <span className="absolute top-14 text-xs font-bold text-gray-600 bg-gray-50 px-1">Fin</span>
                        </div>
                    </div>

                    {/* Sub-etapas Detalle (solo si está en producción) */}
                    {proyecto.etapa_actual === 'produccion' && proyecto.estadoSubEtapas && !proyecto.estadoSubEtapas.ambosCompletados && (
                        <div className="px-6 py-3 bg-amber-50 border-t border-amber-100 flex justify-center gap-8 text-sm">
                            <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${proyecto.estadoSubEtapas.manufactura?.completado ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <span className={proyecto.estadoSubEtapas.manufactura?.completado ? 'text-green-700 font-medium line-through' : 'text-gray-500'}>
                                    Manufactura
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${proyecto.estadoSubEtapas.herreria?.completado ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <span className={proyecto.estadoSubEtapas.herreria?.completado ? 'text-green-700 font-medium line-through' : 'text-gray-500'}>
                                    Herrería
                                </span>
                            </div>
                        </div>
                    )}

                    {proyecto.estadoSubEtapas?.ambosCompletados && proyecto.etapa_actual === 'produccion' && (
                        <div className="px-6 py-3 bg-green-50 border-t border-green-100 text-center">
                            <span className="text-green-700 font-bold flex items-center justify-center gap-2">
                                <CheckCircle2 size={16} /> Producción Finalizada - Listo para enviar a Instalación
                            </span>
                        </div>
                    )}

                    {/* Footer - Solo muestra estado si está completado */}
                    {proyecto.etapa_actual === 'completado' && (
                        <div className="px-6 py-4 bg-white border-t border-gray-100">
                            <div className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg">
                                <CheckCircle2 size={20} />
                                <span>Proyecto Completado</span>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

// Modal para nuevo proyecto
const ModalNuevoProyecto = ({ isOpen, onClose, onCrear }) => {
    const [formData, setFormData] = useState({
        nombre: '',
        cliente: '',
        descripcion: '',
        prioridad: 3,
        fecha_limite: ''
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.nombre.trim()) {
            toast.error('El nombre es requerido');
            return;
        }

        setLoading(true);
        try {
            await onCrear(formData);
            setFormData({ nombre: '', cliente: '', descripcion: '', prioridad: 3, fecha_limite: '' });
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Nuevo Proyecto de Producción">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre del proyecto *
                    </label>
                    <input
                        type="text"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                        placeholder="Ej: Velaria Residencial García"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cliente
                    </label>
                    <input
                        type="text"
                        value={formData.cliente}
                        onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                        placeholder="Nombre del cliente"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Prioridad
                        </label>
                        <select
                            value={formData.prioridad}
                            onChange={(e) => setFormData({ ...formData, prioridad: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                        >
                            <option value={1}>🔴 Urgente</option>
                            <option value={2}>🟠 Alta</option>
                            <option value={3}>🟡 Normal</option>
                            <option value={4}>🟢 Baja</option>
                            <option value={5}>⚪ Muy baja</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Fecha límite
                        </label>
                        <input
                            type="date"
                            value={formData.fecha_limite}
                            onChange={(e) => setFormData({ ...formData, fecha_limite: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descripción / Notas
                    </label>
                    <textarea
                        value={formData.descripcion}
                        onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                        rows={3}
                        placeholder="Notas adicionales..."
                    />
                </div>

                <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={loading} className="flex-1 bg-violet-600 hover:bg-violet-700">
                        {loading ? 'Creando...' : 'Crear Proyecto'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

// Componente de estadísticas en la parte superior
const EstadisticasHeader = ({ estadisticas }) => {
    const items = [
        { label: 'En Diseño', value: estadisticas.diseno || 0, color: ETAPAS_CONFIG.diseno.color, icon: Package },
        { label: 'En Compras', value: estadisticas.compras || 0, color: ETAPAS_CONFIG.compras.color, icon: ShoppingCart },
        { label: 'En Producción', value: estadisticas.produccion || 0, color: ETAPAS_CONFIG.produccion.color, icon: Factory },
        { label: 'En Instalación', value: estadisticas.instalacion || 0, color: ETAPAS_CONFIG.instalacion.color, icon: Truck },
        { label: 'Completados', value: estadisticas.completado || 0, color: ETAPAS_CONFIG.completado.color, icon: CheckCircle2 },
    ];

    return (
        <div className="grid grid-cols-5 gap-4 mb-6">
            {items.map(item => {
                const Icon = item.icon;
                return (
                    <div
                        key={item.label}
                        className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center"
                    >
                        <div className="flex items-center justify-center mb-2">
                            <div
                                className="w-10 h-10 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: `${item.color}20` }}
                            >
                                <Icon size={20} style={{ color: item.color }} />
                            </div>
                        </div>
                        <div className="text-3xl font-bold" style={{ color: item.color }}>
                            {item.value}
                        </div>
                        <div className="text-sm text-gray-500">{item.label}</div>
                    </div>
                );
            })}
        </div>
    );
};

// Filtros
const FiltrosProyectos = ({ filtro, setFiltro }) => {
    const opciones = [
        { value: 'todos', label: 'Todos' },
        { value: 'activos', label: 'En Proceso' },
        { value: 'urgentes', label: '🔴 Urgentes' },
        { value: 'completados', label: '✅ Completados' }
    ];

    return (
        <div className="flex gap-2 mb-4">
            {opciones.map(op => (
                <button
                    key={op.value}
                    onClick={() => setFiltro(op.value)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${filtro === op.value
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    {op.label}
                </button>
            ))}
        </div>
    );
};

// Página principal del Dashboard
const DashboardProduccionPage = () => {
    const [loading, setLoading] = useState(true);
    const [proyectos, setProyectos] = useState([]);
    const [estadisticas, setEstadisticas] = useState({});
    const [filtro, setFiltro] = useState('activos');
    const [sincronizando, setSincronizando] = useState(false);
    const [ultimaSync, setUltimaSync] = useState(null);

    // Estados para modo fullscreen
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [orientacion, setOrientacion] = useState('horizontal'); // 'horizontal' | 'vertical'
    const [tamano, setTamano] = useState('mediano'); // 'pequeno' | 'mediano' | 'grande'

    const cargarDatos = useCallback(async () => {
        try {
            setLoading(true);
            const response = await produccionService.obtenerDashboard();
            if (response.success) {
                // Combinar todos los proyectos de todas las etapas
                const todosProyectos = [];
                Object.keys(response.data.resumen).forEach(etapa => {
                    const proyectosEtapa = response.data.resumen[etapa]?.proyectos || [];
                    todosProyectos.push(...proyectosEtapa);
                });
                setProyectos(todosProyectos);
                setEstadisticas(response.data.estadisticas);
            }
        } catch (error) {
            console.error('Error al cargar dashboard:', error);
            toast.error('Error al cargar el dashboard');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Sincronizar automáticamente al cargar
        const sincronizarYCargar = async () => {
            try {
                setSincronizando(true);
                await produccionService.sincronizarConSheets();
                setUltimaSync(new Date());
            } catch (error) {
                console.error('Error en sincronización automática:', error);
            } finally {
                setSincronizando(false);
            }
            await cargarDatos();
        };

        sincronizarYCargar();

        // Auto-refresh: 1 minuto en fullscreen, 5 minutos normal
        const intervalo = isFullscreen ? 60 * 1000 : 5 * 60 * 1000;
        const interval = setInterval(sincronizarYCargar, intervalo);
        return () => clearInterval(interval);
    }, [cargarDatos, isFullscreen]);

    // Efecto para tecla ESC (salir de fullscreen)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isFullscreen) {
                setIsFullscreen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFullscreen]);

    // Función para toggle fullscreen
    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    // Función para rotar orientación
    const toggleOrientacion = () => {
        setOrientacion(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');
    };

    // Función para cambiar tamaño
    const toggleTamano = () => {
        setTamano(prev => {
            if (prev === 'pequeno') return 'mediano';
            if (prev === 'mediano') return 'grande';
            return 'pequeno';
        });
    };

    const handleCompletar = async (proyectoId) => {
        try {
            const response = await produccionService.completarEtapa(proyectoId);
            if (response.success) {
                toast.success(response.message);
                cargarDatos();
            }
        } catch (error) {
            console.error('Error al completar etapa:', error);
            toast.error('Error al completar etapa');
        }
    };

    const handleSincronizar = async () => {
        try {
            setSincronizando(true);
            const response = await produccionService.sincronizarConSheets();
            if (response.success) {
                toast.success(
                    `Sincronizado: ${response.data.creados} nuevos, ${response.data.actualizados} actualizados`,
                    { duration: 5000 }
                );
                setUltimaSync(new Date());
                cargarDatos();
            }
        } catch (error) {
            console.error('Error al sincronizar:', error);
            toast.error('Error al sincronizar con Google Sheets');
        } finally {
            setSincronizando(false);
        }
    };

    // Filtrar proyectos
    const proyectosFiltrados = proyectos.filter(p => {
        switch (filtro) {
            case 'activos':
                return p.etapa_actual !== 'completado' && p.etapa_actual !== 'pendiente';
            case 'urgentes':
                return p.prioridad === 1 || (p.diasRestantes !== null && p.diasRestantes <= 3);
            case 'completados':
                return p.etapa_actual === 'completado';
            default:
                return true;
        }
    }).sort((a, b) => {
        // 1. Proyectos VENCIDOS primero (diasRestantes < 0)
        const aVencido = a.diasRestantes !== null && a.diasRestantes < 0;
        const bVencido = b.diasRestantes !== null && b.diasRestantes < 0;
        if (aVencido && !bVencido) return -1;
        if (!aVencido && bVencido) return 1;

        // 2. Si ambos vencidos, ordenar por cuánto tiempo llevan vencidos (más vencido primero)
        if (aVencido && bVencido) {
            return a.diasRestantes - b.diasRestantes;
        }

        // 3. Proyectos URGENTES (prioridad 1 o <= 3 días)
        const aUrgente = a.prioridad === 1 || (a.diasRestantes !== null && a.diasRestantes <= 3);
        const bUrgente = b.prioridad === 1 || (b.diasRestantes !== null && b.diasRestantes <= 3);
        if (aUrgente && !bUrgente) return -1;
        if (!aUrgente && bUrgente) return 1;

        // 4. Entre urgentes, ordenar por días restantes (más próximo primero)
        if (aUrgente && bUrgente) {
            if (a.diasRestantes === null) return 1;
            if (b.diasRestantes === null) return -1;
            if (a.diasRestantes !== b.diasRestantes) return a.diasRestantes - b.diasRestantes;
        }

        // 5. Por prioridad (1 = más urgente)
        if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad;

        // 6. Por días restantes (más próximo primero)
        if (a.diasRestantes === null) return 1;
        if (b.diasRestantes === null) return -1;
        return a.diasRestantes - b.diasRestantes;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader size="lg" />
            </div>
        );
    }

    return (
        <div
            className={`min-h-screen bg-gray-50 transition-all duration-300 ${isFullscreen
                ? 'fixed inset-0 z-50 overflow-auto p-4'
                : 'p-4 lg:p-6'
                }`}
            style={isFullscreen && orientacion === 'vertical' ? {
                transform: 'rotate(90deg)',
                transformOrigin: 'center center',
                width: '100vh',
                height: '100vw',
                position: 'fixed',
                top: '50%',
                left: '50%',
                marginTop: '-50vw',
                marginLeft: '-50vh'
            } : {}}
        >
            {/* Header - oculto en fullscreen */}
            {!isFullscreen && (
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            🏭 Dashboard de Producción
                        </h1>
                        <p className="text-gray-600 mt-1">
                            Seguimiento visual de proyectos por etapas
                        </p>
                    </div>

                    <div className="flex gap-2 items-center">
                        {ultimaSync && (
                            <span className="text-xs text-gray-400">
                                Actualizado: {ultimaSync.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}

                        {/* Botón de fullscreen */}
                        <button
                            onClick={toggleFullscreen}
                            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                            title="Pantalla completa"
                        >
                            <Maximize2 size={18} />
                            Fullscreen
                        </button>

                        {/* Botón de sincronizar */}
                        <button
                            onClick={handleSincronizar}
                            disabled={sincronizando}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            title="Sincronizar con Google Sheets"
                        >
                            {sincronizando ? (
                                <RefreshCw size={18} className="animate-spin" />
                            ) : (
                                <Download size={18} />
                            )}
                            {sincronizando ? 'Sincronizando...' : 'Sincronizar'}
                        </button>
                    </div>
                </div>
            )}

            {/* Controles flotantes en fullscreen */}
            {isFullscreen && (
                <div className="fixed top-2 right-2 z-50 flex gap-2 opacity-30 hover:opacity-100 transition-opacity">
                    <button
                        onClick={toggleOrientacion}
                        className="p-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                        title={`Cambiar a modo ${orientacion === 'horizontal' ? 'vertical' : 'horizontal'}`}
                    >
                        <RotateCw size={16} />
                    </button>
                    <button
                        onClick={toggleTamano}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                        title={`Tamaño: ${tamano} (click para cambiar)`}
                    >
                        <ZoomIn size={16} />
                        <span className="text-xs font-bold">
                            {tamano === 'pequeno' ? 'P' : tamano === 'mediano' ? 'M' : 'G'}
                        </span>
                    </button>
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                        title="Salir (ESC)"
                    >
                        <Minimize2 size={16} />
                    </button>
                </div>
            )}

            {/* Estadísticas */}
            <EstadisticasHeader estadisticas={estadisticas} />

            {/* Alerta de urgentes */}
            {estadisticas.urgentes > 0 && (
                <div className="bg-red-100 border-2 border-red-300 rounded-xl p-4 mb-6 flex items-center gap-3">
                    <AlertTriangle size={24} className="text-red-600" />
                    <span className="font-medium text-red-800">
                        {estadisticas.urgentes} proyecto(s) urgente(s) o próximos a vencer
                    </span>
                </div>
            )}

            {/* Filtros - ocultos en fullscreen para más espacio */}
            {!isFullscreen && <FiltrosProyectos filtro={filtro} setFiltro={setFiltro} />}

            {/* Lista de proyectos como timeline */}
            <div className={`${isFullscreen && orientacion === 'horizontal'
                ? tamano === 'pequeno'
                    ? 'grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3'
                    : tamano === 'grande'
                        ? 'grid grid-cols-1 xl:grid-cols-2 gap-4'
                        : 'grid grid-cols-2 xl:grid-cols-3 gap-4'
                : 'space-y-4'
                }`}>
                {proyectosFiltrados.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-xl col-span-full">
                        <Package size={64} className="mx-auto mb-4 text-gray-300" />
                        <h2 className="text-xl font-semibold text-gray-500">No hay proyectos</h2>
                        <p className="text-gray-400 mt-1">
                            {filtro === 'todos'
                                ? 'Crea tu primer proyecto de producción'
                                : 'No hay proyectos con este filtro'}
                        </p>
                    </div>
                ) : (
                    proyectosFiltrados.map(proyecto => (
                        <ProyectoTimeline
                            key={proyecto.id}
                            proyecto={proyecto}
                            onCompletar={handleCompletar}
                            isFullscreen={isFullscreen}
                            orientacion={orientacion}
                            tamano={tamano}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default DashboardProduccionPage;
