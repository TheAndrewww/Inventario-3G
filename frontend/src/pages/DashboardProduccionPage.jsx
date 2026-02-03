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
    Monitor,
    ExternalLink,
    Cloud,
    Database
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
    const esMTO = proyecto.tipo_proyecto?.toUpperCase() === 'MTO';
    // GTIA siempre simplificado, MTO simplificado solo si NO es extensivo
    const usaTimelineSimplificado = esGarantia || (esMTO && !proyecto.es_extensivo);

    // Estado de retraso para proyectos A, B, C
    const estadoRetraso = proyecto.estadoRetraso || { enRetraso: false };
    const enRetraso = estadoRetraso.enRetraso;

    // Regla de urgencia (igual que TV):
    // 1. Prioridad 1
    // 2. Garantía
    // 3. Menos de 3 días restantes (EXCEPTO MTO)
    // 4. MTO solo si ya se pasó la fecha (diasRestantes < 0)
    // 5. En retraso (tipos A, B, C)
    const urgenciaPorFecha = diasRestantes !== null && (esMTO ? diasRestantes < 0 : diasRestantes <= 3);
    const esUrgente = proyecto.prioridad === 1 || esGarantia || urgenciaPorFecha || enRetraso;

    // Verificar si tiene producción (manufactura o herrería)
    const tieneProduccion = proyecto.tiene_manufactura || proyecto.tiene_herreria;

    // Calcular porcentaje según tipo de timeline
    let porcentaje;
    if (usaTimelineSimplificado) {
        // MTO/GTIA: solo 2 etapas (instalacion=50%, completado=100%)
        porcentaje = proyecto.etapa_actual === 'completado' ? 100 : 50;
    } else {
        if (tieneProduccion) {
            // Normal: 5 etapas
            const etapaActualIndex = ETAPAS_ORDEN.indexOf(proyecto.etapa_actual);
            porcentaje = Math.round((etapaActualIndex / (ETAPAS_ORDEN.length - 1)) * 100);
        } else {
            // Sin producción: 4 etapas (Diseño, Compras, Instalación, Fin)
            const etapasSinProd = ['diseno', 'compras', 'instalacion', 'completado'];
            let idx = etapasSinProd.indexOf(proyecto.etapa_actual);
            if (idx === -1 && proyecto.etapa_actual === 'produccion') idx = 1;
            if (idx === -1) idx = 0;
            porcentaje = Math.round((idx / (etapasSinProd.length - 1)) * 100);
        }
    }

    // Definiciones de modo (movidas al inicio para ser usadas en POS)
    const esCompacto = isFullscreen && (orientacion === 'vertical' || tamano === 'pequeno');
    const esVertical = isFullscreen && orientacion === 'vertical';

    // Definiciones de timeline (movidas al scope principal)
    const POS = esVertical
        ? { P1: 8, P2: 24, P3: 40, P4: 56, P5: 72 }
        : { P1: 10, P2: 30, P3: 50, P4: 70, P5: 90 };

    const tieneManufacturaLocal = proyecto.tiene_manufactura !== false;
    const tieneHerreriaLocal = proyecto.tiene_herreria !== false;
    const tieneAmbas = tieneManufacturaLocal && tieneHerreriaLocal;

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

    // Si está en retraso, override de colores (igual que TV)
    const bgFinal = enRetraso ? 'bg-red-50' : colorTipo.bg;
    const borderFinal = enRetraso ? 'border-l-4 border-red-500' : colorTipo.border;

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
            return `${bgFinal} ${borderFinal} rounded-2xl shadow-lg overflow-hidden mb-5 transition-all hover:shadow-xl ${esUrgente ? 'ring-2 ring-red-400' : ''}`;
        }

        const baseClasses = `${bgFinal} ${borderFinal} overflow-hidden transition-all ${esUrgente ? 'ring-2 ring-red-400' : ''}`;

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

        // Modo vertical: texto MUY grande (duplicado)
        if (orientacion === 'vertical') return 'text-3xl';

        if (tamano === 'pequeno') return 'text-sm';
        if (tamano === 'grande') return 'text-xl';
        return 'text-base';
    };



    return (
        <div className={getCardClasses()}>
            {/* Header con gradiente sutil */}
            <div className={`${colorTipo.bg === 'bg-white' ? 'bg-gradient-to-r from-gray-50 to-white' : ''} ${getPadding()} ${esVertical ? 'py-1' : ''} border-b border-gray-100`}>
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className={`flex items-center gap-${esCompacto ? '1' : '3'} mb-${esCompacto ? '1' : '2'}`}>
                            {/* Badge de tipo de proyecto */}
                            {colorTipo.label && (
                                <span className={`inline-flex items-center ${esCompacto ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'} font-bold rounded-full ${colorTipo.labelBg}`}>
                                    {colorTipo.label}
                                </span>
                            )}
                            {enRetraso && (
                                <span className={`inline-flex items-center gap-1 bg-red-600 text-white ${esCompacto ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'} font-bold rounded-full animate-pulse`}>
                                    ⚠️ +{estadoRetraso.diasRetraso}d
                                </span>
                            )}
                            {esUrgente && !enRetraso && (
                                <span className={`inline-flex items-center gap-1 bg-red-500 text-white ${esCompacto ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'} font-bold rounded-full ${esCompacto ? '' : 'animate-pulse shadow-sm'}`}>
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
                                className={`inline-flex items-center gap-1 ${esCompacto ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'} font-semibold rounded-full`}
                                style={{
                                    backgroundColor: `${ETAPAS_CONFIG[proyecto.etapa_actual]?.color}15`,
                                    color: ETAPAS_CONFIG[proyecto.etapa_actual]?.color,
                                    border: `1px solid ${ETAPAS_CONFIG[proyecto.etapa_actual]?.color}30`
                                }}
                            >
                                {usaTimelineSimplificado && proyecto.etapa_actual !== 'completado'
                                    ? 'INSTALACIÓN'
                                    : ETAPAS_CONFIG[proyecto.etapa_actual]?.nombre}
                            </span>
                        </div>
                        <h3 className={`font-bold ${getTitleSize()} text-gray-900 leading-tight ${esCompacto ? 'truncate' : ''}`}>{proyecto.nombre}</h3>
                        {proyecto.cliente && (!esCompacto || orientacion === 'vertical') && (
                            <p className={`${orientacion === 'vertical' ? 'text-2xl mt-2' : 'text-sm mt-1'} text-gray-500 flex items-center gap-1.5`}>
                                <User size={orientacion === 'vertical' ? 22 : 14} className="text-gray-400" />
                                {proyecto.cliente}
                            </p>
                        )}
                    </div>

                    {/* Indicador de progreso circular - Solo para timeline normal */}
                    <div className="flex flex-col items-center">
                        {!usaTimelineSimplificado && (
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
                        )}
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
            <div className={`${esVertical ? 'px-3 py-3' : 'px-6 py-8'} bg-gray-50 relative overflow-visible`} style={{ height: esVertical ? '160px' : '220px' }}>

                {/* Cuadro de fecha de entrega - Visible en vertical pero más pequeño */}
                {proyecto.fecha_limite && (
                    <div className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-0.5 ${esVertical ? 'px-4 py-3 origin-right' : 'px-5 py-4'} rounded-xl shadow-md ${diasRestantes !== null && diasRestantes < 0
                        ? 'bg-red-100 text-red-700 border border-red-200'
                        : diasRestantes !== null && diasRestantes <= 3
                            ? 'bg-amber-100 text-amber-700 border border-amber-200'
                            : 'bg-white text-gray-700 border border-gray-200'
                        }`}>
                        <Calendar size={esVertical ? 20 : 24} className={esVertical ? "mb-1" : "mb-1"} />
                        {!esVertical && <span className="text-sm font-medium text-gray-500">Entrega</span>}
                        <span className={`${esVertical ? 'text-2xl' : 'text-lg'} font-bold`}>
                            {new Date(proyecto.fecha_limite).toLocaleDateString('es-MX', {
                                day: 'numeric',
                                month: 'short'
                            })}
                        </span>
                        {diasRestantes !== null && (
                            <span className={`${esVertical ? 'text-lg' : 'text-sm'} font-semibold ${diasRestantes < 0 ? 'text-red-600' : diasRestantes <= 3 ? 'text-amber-600' : 'text-gray-500'
                                }`}>
                                {diasRestantes < 0 ? 'Venc' : diasRestantes === 0 ? 'Hoy' : `${diasRestantes}d`}
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

                    {/* Lógica de colores y posiciones */}
                    {(() => {
                        // Timeline simplificado para MTO/GTIA
                        if (usaTimelineSimplificado) {
                            const getStrokeColor = () => proyecto.etapa_actual === 'completado' ? '#10B981' : '#CBD5E1';
                            return (
                                <line x1="10" y1="40" x2="90" y2="40" stroke={getStrokeColor()} strokeWidth="4" vectorEffect="non-scaling-stroke" />
                            );
                        }



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

                            if (currentIndex > prodIndex) return '#10B981';
                            if (currentIndex === prodIndex) {
                                return proyecto.estadoSubEtapas?.[subStage]?.completado ? '#10B981' : '#CBD5E1';
                            }
                            return '#CBD5E1';
                        };

                        // Si no tiene producción, renderizar 4 nodos
                        if (!tieneProduccion) {
                            return (
                                <>
                                    <line x1={POS.P1} y1="40" x2="34" y2="40" stroke={getStrokeColor('diseno')} strokeWidth={esVertical ? "2" : "4"} vectorEffect="non-scaling-stroke" />
                                    <line x1="34" y1="40" x2="60" y2="40" stroke={getStrokeColor('compras')} strokeWidth={esVertical ? "2" : "4"} vectorEffect="non-scaling-stroke" />
                                    <line x1="60" y1="40" x2={POS.P5} y2="40" stroke={getStrokeColor('instalacion')} strokeWidth={esVertical ? "2" : "4"} vectorEffect="non-scaling-stroke" />
                                </>
                            );
                        }

                        // Posicionamiento de splits
                        const splitStart = POS.P2;
                        const splitEnd = POS.P3;
                        const splitMid = (splitStart + splitEnd) / 2;

                        return (
                            <>
                                {/* Diseño -> Compras */}
                                <line x1={POS.P1} y1="40" x2={POS.P2} y2="40" stroke={getStrokeColor('diseno')} strokeWidth={esVertical ? "2" : "4"} vectorEffect="non-scaling-stroke" />

                                {/* Stepper Bifurcado */}
                                {tieneAmbas && (
                                    <>
                                        <path d={`M ${splitStart} 40 L ${splitMid} 40 L ${splitMid} 20 L ${splitEnd} 20`} fill="none" stroke={getStrokeColor('compras')} strokeWidth={esVertical ? "2" : "4"} vectorEffect="non-scaling-stroke" />
                                        <path d={`M ${splitStart} 40 L ${splitMid} 40 L ${splitMid} 60 L ${splitEnd} 60`} fill="none" stroke={getStrokeColor('compras')} strokeWidth={esVertical ? "2" : "4"} vectorEffect="non-scaling-stroke" />
                                        <path d={`M ${splitEnd} 20 L ${POS.P4 - 10} 20 L ${POS.P4 - 10} 40 L ${POS.P4} 40`} fill="none" stroke={getSubStageStroke('manufactura')} strokeWidth={esVertical ? "2" : "4"} vectorEffect="non-scaling-stroke" />
                                        <path d={`M ${splitEnd} 60 L ${POS.P4 - 10} 60 L ${POS.P4 - 10} 40 L ${POS.P4} 40`} fill="none" stroke={getSubStageStroke('herreria')} strokeWidth={esVertical ? "2" : "4"} vectorEffect="non-scaling-stroke" />
                                    </>
                                )}

                                {/* Solo Manufactura */}
                                {tieneManufacturaLocal && !tieneHerreriaLocal && (
                                    <>
                                        <line x1={POS.P2} y1="40" x2={POS.P3} y2="40" stroke={getStrokeColor('compras')} strokeWidth={esVertical ? "2" : "4"} vectorEffect="non-scaling-stroke" />
                                        <line x1={POS.P3} y1="40" x2={POS.P4} y2="40" stroke={getSubStageStroke('manufactura')} strokeWidth={esVertical ? "2" : "4"} vectorEffect="non-scaling-stroke" />
                                    </>
                                )}

                                {/* Solo Herrería */}
                                {!tieneManufacturaLocal && tieneHerreriaLocal && (
                                    <>
                                        <line x1={POS.P2} y1="40" x2={POS.P3} y2="40" stroke={getStrokeColor('compras')} strokeWidth={esVertical ? "2" : "4"} vectorEffect="non-scaling-stroke" />
                                        <line x1={POS.P3} y1="40" x2={POS.P4} y2="40" stroke={getSubStageStroke('herreria')} strokeWidth={esVertical ? "2" : "4"} vectorEffect="non-scaling-stroke" />
                                    </>
                                )}

                                {/* Instalación -> Completado */}
                                <line x1={POS.P4} y1="40" x2={POS.P5} y2="40" stroke={getStrokeColor('instalacion')} strokeWidth={esVertical ? "2" : "4"} vectorEffect="non-scaling-stroke" />
                            </>
                        );
                    })()}
                </svg>

                {/* --- NODOS DEL STEPPER --- */}
                {(() => {
                    // Timeline simplificado para MTO/GTIA
                    if (usaTimelineSimplificado) {
                        const proyectoCompletado = proyecto.etapa_actual === 'completado';

                        // Función para determinar color del nodo simplificado
                        const getNodeColorSimple = (stage) => {
                            if (stage === 'completado') {
                                return proyectoCompletado ? 'bg-green-500 text-white' : 'bg-white border-2 border-gray-200 text-gray-400';
                            }
                            if (stage === 'instalacion') {
                                if (proyectoCompletado) return 'bg-green-500 text-white';
                                // GTIA siempre rojo, MTO rojo si vencido
                                if (esGarantia) return 'bg-red-500 text-white';
                                if (esMTO && diasRestantes !== null && diasRestantes < 0) return 'bg-red-500 text-white';
                                return 'bg-green-500 text-white';
                            }
                            return 'bg-white border-2 border-gray-200 text-gray-400';
                        };

                        return (
                            <>
                                {/* Instalación */}
                                <div className="absolute top-[40%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: '10%' }}>
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md ${getNodeColorSimple('instalacion')}`}>
                                        <Truck size={24} />
                                    </div>
                                    <span className="absolute top-14 text-xs font-bold text-gray-600 bg-gray-50 px-1">Instalación</span>
                                </div>
                                {/* Fin */}
                                <div className="absolute top-[40%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: '90%' }}>
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md ${getNodeColorSimple('completado')}`}>
                                        <CheckCircle2 size={24} />
                                    </div>
                                    <span className="absolute top-14 text-xs font-bold text-gray-600 bg-gray-50 px-1">Fin</span>
                                </div>
                            </>
                        );
                    }

                    // Timeline normal
                    const POS = esVertical
                        ? { P1: '8%', P2: '24%', P3: '40%', P4: '56%', P5: '72%' }
                        : { P1: '10%', P2: '30%', P3: '50%', P4: '70%', P5: '90%' };

                    // Función para color de nodo con soporte de retraso
                    const getNodeColor = (stage, stageIndex) => {
                        const etapaIndex = ETAPAS_ORDEN.indexOf(proyecto.etapa_actual);
                        const esEtapaCompletada = etapaIndex > stageIndex;
                        const esEtapaActual = proyecto.etapa_actual === stage;
                        const esCompletado = stage === 'completado' && proyecto.etapa_actual === 'completado';

                        if (esCompletado) return 'bg-green-500 text-white';
                        if (esEtapaActual) {
                            // En retraso o MTO vencido -> rojo
                            if (enRetraso) return 'bg-red-500 text-white';
                            if (esMTO && diasRestantes !== null && diasRestantes < 0) return 'bg-red-500 text-white';
                            return 'bg-green-500 text-white';
                        }
                        if (esEtapaCompletada) return 'bg-green-500 text-white';
                        return 'bg-white border-2 border-gray-200 text-gray-400';
                    };

                    // Si no tiene producción, mostrar 4 nodos
                    if (!tieneProduccion) {
                        return (
                            <>
                                {/* Diseño */}
                                <div className="absolute top-[40%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: POS.P1 }}>
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md ${getNodeColor('diseno', 1)}`}>
                                        {ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 1 ? <CheckCircle2 size={24} /> : <Package size={20} />}
                                    </div>
                                    <span className="absolute top-14 text-xs font-bold text-gray-600 bg-gray-50 px-1">Diseño</span>
                                </div>
                                {/* Compras */}
                                <div className="absolute top-[40%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: '34%' }}>
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md ${getNodeColor('compras', 2)}`}>
                                        {ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 2 ? <CheckCircle2 size={24} /> : <ShoppingCart size={20} />}
                                    </div>
                                    <span className="absolute top-14 text-xs font-bold text-gray-600 bg-gray-50 px-1">Compras</span>
                                </div>
                                {/* Instalación */}
                                <div className="absolute top-[40%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: '60%' }}>
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md ${getNodeColor('instalacion', 4)}`}>
                                        {ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 4 ? <CheckCircle2 size={24} /> : <Truck size={20} />}
                                    </div>
                                    <span className="absolute top-14 text-xs font-bold text-gray-600 bg-gray-50 px-1">Instalación</span>
                                </div>
                                {/* Fin */}
                                <div className="absolute top-[40%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: POS.P5 }}>
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md ${proyecto.etapa_actual === 'completado' ? 'bg-green-500 text-white' : 'bg-white border-2 border-gray-200 text-gray-400'}`}>
                                        <CheckCircle2 size={24} />
                                    </div>
                                    <span className="absolute top-14 text-xs font-bold text-gray-600 bg-gray-50 px-1">Fin</span>
                                </div>
                            </>
                        );
                    }

                    return (
                        <>
                            {/* 1. DISEÑO */}
                            <div className="absolute top-[40%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: POS.P1 }}>
                                <div className={`${esVertical ? 'w-14 h-14' : 'w-12 h-12'} rounded-full flex items-center justify-center shadow-md transition-colors duration-300 ${getNodeColor('diseno', 1)}`}>
                                    {ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 1 ? <CheckCircle2 size={esVertical ? 28 : 24} /> : <Package size={esVertical ? 26 : 20} />}
                                </div>
                                <span className={`absolute ${esVertical ? 'top-16 text-3xl' : 'top-14 text-xs'} font-bold text-gray-600 bg-gray-50 px-1`}>Diseño</span>
                            </div>

                            {/* 2. COMPRAS */}
                            <div className="absolute top-[40%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: POS.P2 }}>
                                <div className={`${esVertical ? 'w-14 h-14' : 'w-12 h-12'} rounded-full flex items-center justify-center shadow-md transition-colors duration-300 ${getNodeColor('compras', 2)}`}>
                                    {ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 2 ? <CheckCircle2 size={esVertical ? 28 : 24} /> : <ShoppingCart size={esVertical ? 26 : 20} />}
                                </div>
                                <span className={`absolute ${esVertical ? 'top-16 text-3xl' : 'top-14 text-xs'} font-bold text-gray-600 bg-gray-50 px-1`}>Compras</span>
                            </div>

                            {/* 3A. MANUFACTURA */}
                            {proyecto.tiene_manufactura !== false && (
                                <div className={`absolute ${tieneHerreriaLocal ? 'top-[20%]' : 'top-[40%]'} -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center`} style={{ left: POS.P3 }}>
                                    <div className={`${esVertical ? 'w-14 h-14' : 'w-12 h-12'} rounded-full flex items-center justify-center shadow-md transition-colors duration-300 ${(proyecto.estadoSubEtapas?.manufactura?.completado || ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 3) ? 'bg-green-500 text-white' :
                                        proyecto.etapa_actual === 'produccion' ? (enRetraso ? 'bg-red-500 text-white' : 'bg-white ring-4 ring-amber-200 text-amber-500') : 'bg-white border-2 border-gray-200 text-gray-400'
                                        }`}>
                                        {(proyecto.estadoSubEtapas?.manufactura?.completado || ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 3) ? <CheckCircle2 size={esVertical ? 28 : 24} /> : <Factory size={esVertical ? 26 : 20} />}
                                    </div>
                                    <span className={`absolute ${esVertical ? 'top-16 text-3xl' : 'top-14 text-xs'} font-bold text-gray-600 bg-gray-50 px-1`}>Manufactura</span>
                                </div>
                            )}

                            {/* 3B. HERRERÍA */}
                            {proyecto.tiene_herreria !== false && (
                                <div className={`absolute ${tieneManufacturaLocal ? 'top-[60%]' : 'top-[40%]'} -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center`} style={{ left: POS.P3 }}>
                                    <div className={`${esVertical ? 'w-14 h-14' : 'w-12 h-12'} rounded-full flex items-center justify-center shadow-md transition-colors duration-300 ${(proyecto.estadoSubEtapas?.herreria?.completado || ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 3) ? 'bg-green-500 text-white' :
                                        proyecto.etapa_actual === 'produccion' ? (enRetraso ? 'bg-red-500 text-white' : 'bg-white ring-4 ring-red-200 text-red-500') : 'bg-white border-2 border-gray-200 text-gray-400'
                                        }`}>
                                        {(proyecto.estadoSubEtapas?.herreria?.completado || ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 3) ? <CheckCircle2 size={esVertical ? 28 : 24} /> : <Factory size={esVertical ? 26 : 20} />}
                                    </div>
                                    <span className={`absolute ${esVertical ? 'top-16 text-3xl' : 'top-14 text-xs'} font-bold text-gray-600 bg-gray-50 px-1`}>Herrería</span>
                                </div>
                            )}

                            {/* 4. INSTALACIÓN */}
                            <div className="absolute top-[40%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: POS.P4 }}>
                                <div className={`${esVertical ? 'w-14 h-14' : 'w-12 h-12'} rounded-full flex items-center justify-center shadow-md transition-colors duration-300 ${getNodeColor('instalacion', 4)}`}>
                                    {ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) > 4 ? <CheckCircle2 size={esVertical ? 28 : 24} /> : <Truck size={esVertical ? 26 : 20} />}
                                </div>
                                <span className={`absolute ${esVertical ? 'top-16 text-3xl' : 'top-14 text-xs'} font-bold text-gray-600 bg-gray-50 px-1`}>Instalación</span>
                            </div>

                            {/* 5. COMPLETADO */}
                            <div className="absolute top-[40%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center" style={{ left: POS.P5 }}>
                                <div className={`${esVertical ? 'w-14 h-14' : 'w-12 h-12'} rounded-full flex items-center justify-center shadow-md transition-colors duration-300 ${proyecto.etapa_actual === 'completado' ? 'bg-green-500 text-white' : 'bg-white border-2 border-gray-200 text-gray-400'
                                    }`}>
                                    <CheckCircle2 size={esVertical ? 28 : 24} />
                                </div>
                                <span className={`absolute ${esVertical ? 'top-16 text-3xl' : 'top-14 text-xs'} font-bold text-gray-600 bg-gray-50 px-1`}>Fin</span>
                            </div>
                        </>
                    );
                })()}
            </div>

            {/* Sub-etapas Detalle (solo si está en producción) */}
            {proyecto.etapa_actual === 'produccion' && proyecto.estadoSubEtapas && !proyecto.estadoSubEtapas.ambosCompletados && (
                <div className={`px-6 py-3 bg-amber-50 border-t border-amber-100 flex justify-center gap-8 ${esVertical ? 'text-xl' : 'text-sm'}`}>
                    <div className="flex items-center gap-2">
                        <div className={`w-3.5 h-3.5 rounded-full ${proyecto.estadoSubEtapas.manufactura?.completado ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className={proyecto.estadoSubEtapas.manufactura?.completado ? 'text-green-700 font-medium line-through' : 'text-gray-500'}>
                            Manufactura
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-3.5 h-3.5 rounded-full ${proyecto.estadoSubEtapas.herreria?.completado ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className={proyecto.estadoSubEtapas.herreria?.completado ? 'text-green-700 font-medium line-through' : 'text-gray-500'}>
                            Herrería
                        </span>
                    </div>
                </div>
            )}

            {proyecto.estadoSubEtapas?.ambosCompletados && proyecto.etapa_actual === 'produccion' && (
                <div className="px-6 py-3 bg-green-50 border-t border-green-100 text-center">
                    <span className={`${esVertical ? 'text-xl' : 'text-base'} text-green-700 font-bold flex items-center justify-center gap-2`}>
                        <CheckCircle2 size={esVertical ? 20 : 16} /> Producción Finalizada - Listo para enviar a Instalación
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

            {/* Botón de Siguiente Etapa - Solo en vista principal, no en instalación ni completado */}
            {/* Nota: La finalización a "completado" solo se hace desde el spreadsheet */}
            {!isFullscreen && proyecto.etapa_actual !== 'completado' && proyecto.etapa_actual !== 'instalacion' && !usaTimelineSimplificado && (
                <div className="px-6 py-4 bg-white border-t border-gray-100">
                    <button
                        onClick={handleCompletar}
                        disabled={loading}
                        className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <RefreshCw size={18} className="animate-spin" />
                        ) : (
                            <ChevronRight size={18} />
                        )}
                        Avanzar a {ETAPAS_CONFIG[ETAPAS_ORDEN[ETAPAS_ORDEN.indexOf(proyecto.etapa_actual) + 1]]?.nombre}
                    </button>
                </div>
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
const EstadisticasHeader = ({ estadisticas, isFullscreen = false, orientacion = 'horizontal' }) => {
    const items = [
        { label: 'En Diseño', value: estadisticas.diseno || 0, color: ETAPAS_CONFIG.diseno.color, icon: Package },
        { label: 'En Compras', value: estadisticas.compras || 0, color: ETAPAS_CONFIG.compras.color, icon: ShoppingCart },
        { label: 'En Producción', value: estadisticas.produccion || 0, color: ETAPAS_CONFIG.produccion.color, icon: Factory },
        { label: 'En Instalación', value: estadisticas.instalacion || 0, color: ETAPAS_CONFIG.instalacion.color, icon: Truck },
    ];

    // En vertical usamos grid de 4 columnas (una sola fila) pero más altas
    return (
        <div className={`grid ${isFullscreen && orientacion === 'vertical' ? 'grid-cols-4 gap-2' : 'grid-cols-4 gap-4'} mb-6`}>
            {items.map(item => {
                const Icon = item.icon;
                return (
                    <div
                        key={item.label}
                        className={`bg-white rounded-xl shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center
                            ${isFullscreen && orientacion === 'vertical' ? 'p-2 py-6 min-h-[220px]' : 'p-4'}`}
                    >
                        <div className="flex items-center justify-center mb-2">
                            <div
                                className={`${isFullscreen && orientacion === 'vertical' ? 'w-12 h-12' : 'w-10 h-10'} rounded-full flex items-center justify-center`}
                                style={{ backgroundColor: `${item.color}20` }}
                            >
                                <Icon size={isFullscreen && orientacion === 'vertical' ? 24 : 20} style={{ color: item.color }} />
                            </div>
                        </div>
                        <div className={`${isFullscreen && orientacion === 'vertical' ? 'text-4xl' : 'text-3xl'} font-bold`} style={{ color: item.color }}>
                            {item.value}
                        </div>
                        <div className={`${isFullscreen && orientacion === 'vertical' ? 'text-lg font-bold leading-tight' : 'text-sm'} text-gray-500`}>{item.label}</div>
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
    const [tamano, setTamano] = useState('mediano');

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

        // Auto-refresh: 5 minutos normal
        const interval = setInterval(sincronizarYCargar, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [cargarDatos]);

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
                const mesesInfo = response.data.meses?.length > 1 ? ` (${response.data.meses.length} meses)` : '';
                toast.success(
                    `Sincronizado${mesesInfo}: ${response.data.creados} nuevos, ${response.data.actualizados} actualizados`
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

    const handleSincronizarDrive = async () => {
        try {
            setSincronizando(true);
            toast.loading('Sincronizando con Drive (esto puede tardar unos segundos)...', { id: 'sync-drive' });

            const response = await produccionService.sincronizarTodosDrive();

            if (response.success) {
                toast.success(
                    `Drive actualizado: ${response.data.exitosos} proyectos procesados`,
                    { id: 'sync-drive' }
                );
                cargarDatos();
            } else {
                toast.error('Error al sincronizar con Drive', { id: 'sync-drive' });
            }
        } catch (error) {
            console.error('Error al sincronizar Drive:', error);
            toast.error('Error de conexión con Drive', { id: 'sync-drive' });
        } finally {
            setSincronizando(false);
        }
    };

    // Filtros
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
        // 1. Proyectos en retraso primero
        const aRetraso = a.estadoRetraso?.enRetraso ? 1 : 0;
        const bRetraso = b.estadoRetraso?.enRetraso ? 1 : 0;
        if (aRetraso !== bRetraso) return bRetraso - aRetraso;

        // 2. Si ambos en retraso, el que tiene más días de retraso primero
        if (aRetraso && bRetraso) {
            const aRetrasoDias = a.estadoRetraso?.diasRetraso || 0;
            const bRetrasoDias = b.estadoRetraso?.diasRetraso || 0;
            if (aRetrasoDias !== bRetrasoDias) return bRetrasoDias - aRetrasoDias;
        }

        // 3. Vencidos
        const aVencido = a.diasRestantes !== null && a.diasRestantes < 0;
        const bVencido = b.diasRestantes !== null && b.diasRestantes < 0;
        if (aVencido && !bVencido) return -1;
        if (!aVencido && bVencido) return 1;

        // 4. Por prioridad
        return (a.prioridad || 3) - (b.prioridad || 3);
    });

    // Nuevo Proyecto Modal
    const [modalOpen, setModalOpen] = useState(false);
    const handleCrearProyecto = async (data) => {
        try {
            const response = await produccionService.crearProyecto(data);
            if (response.success) {
                toast.success('Proyecto creado exitosamente');
                cargarDatos();
            }
        } catch (error) {
            console.error('Error al crear proyecto:', error);
            toast.error('Error al crear proyecto');
        }
    };

    if (loading && proyectos.length === 0) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader size="lg" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 lg:p-6 transition-all duration-300">
            {/* Header */}
            <div>
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

                        <a
                            href="/produccion-tv"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
                            title="Abrir vista para TV Vertical"
                        >
                            <Monitor size={18} />
                            <span>Vista TV</span>
                            <ExternalLink size={14} className="opacity-50" />
                        </a>

                        <div className="h-8 w-px bg-gray-300 mx-2 hidden lg:block"></div>

                        {/* Botones de Sincronización Manual */}
                        <button
                            onClick={handleSincronizar}
                            disabled={sincronizando}
                            className="flex items-center gap-2 px-3 py-2 bg-white text-green-700 border border-green-200 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50 text-sm font-medium"
                            title="Actualizar nuevos proyectos desde Google Sheets"
                        >
                            <Database size={16} />
                            {sincronizando ? '...' : 'Sync Sheets'}
                        </button>

                        <button
                            onClick={handleSincronizarDrive}
                            disabled={sincronizando}
                            className="flex items-center gap-2 px-3 py-2 bg-white text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 text-sm font-medium"
                            title="Actualizar carpetas y archivos desde Google Drive"
                        >
                            <Cloud size={16} />
                            {sincronizando ? '...' : 'Sync Drive'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Estadísticas */}
            <EstadisticasHeader estadisticas={estadisticas} />

            {/* Filtros */}
            <FiltrosProyectos filtro={filtro} setFiltro={setFiltro} />

            {/* Lista de Proyectos */}
            <div className="space-y-6">
                {proyectosFiltrados.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
                        <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Package size={32} className="text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">No hay proyectos</h3>
                        <p className="text-gray-500">No se encontraron proyectos con el filtro actual</p>
                    </div>
                ) : (
                    proyectosFiltrados.map(proyecto => (
                        <ProyectoTimeline
                            key={proyecto.id}
                            proyecto={proyecto}
                            onCompletar={handleCompletar}
                            tamano={tamano}
                        />
                    ))
                )}
            </div>

            <ModalNuevoProyecto
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onCrear={handleCrearProyecto}
            />
        </div>
    );
};

export default DashboardProduccionPage;

