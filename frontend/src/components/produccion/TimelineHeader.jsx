import React, { memo } from 'react';
import { User, Clock } from 'lucide-react';
import { s, px } from '../../utils/produccion';
import { ETAPAS_CONFIG, getColorPorTipo, calcularPorcentaje, usaTimelineSimplificado } from './constants';

/**
 * Header de la tarjeta de proyecto
 * Muestra: badges, nombre, cliente y círculo de progreso
 */
const TimelineHeader = memo(({ proyecto }) => {
    const diasRestantes = proyecto.diasRestantes;
    const esGarantia = proyecto.tipo_proyecto?.toUpperCase() === 'GTIA';
    const esMTO = proyecto.tipo_proyecto?.toUpperCase() === 'MTO';
    const timelineSimplificado = usaTimelineSimplificado(proyecto);

    const estadoRetraso = proyecto.estadoRetraso || { enRetraso: false };
    let enRetraso = estadoRetraso.enRetraso;

    // Lógica especial para Instalación: Ignorar "retraso" de etapas previas.
    // "ya es como si hubiera terminado" -> No mostrar badge de atraso ni urgencia por fecha
    if (proyecto.etapa_actual === 'instalacion') {
        enRetraso = false;
    }

    let urgenciaPorFecha = diasRestantes !== null && diasRestantes <= 3;
    if (proyecto.etapa_actual === 'instalacion') {
        const diasRestantesCheck = diasRestantes ?? 999;
        // Solo urgente si faltan <= 2 días
        urgenciaPorFecha = diasRestantesCheck <= 2;
    }

    const esUrgente = proyecto.prioridad === 1 || esGarantia || urgenciaPorFecha || enRetraso;

    const colorTipo = getColorPorTipo(proyecto.tipo_proyecto);
    const porcentaje = calcularPorcentaje(proyecto);

    return (
        <div
            className={`${colorTipo.bg === 'bg-white' ? 'bg-gradient-to-r from-gray-50 to-white' : ''} border-b border-gray-100 flex items-start justify-between`}
            style={{ padding: `${px(8)} ${px(12)}` }}
        >
            <div className="flex-1" style={{ minWidth: 0 }}>
                {/* Badges */}
                <div className="flex items-center mb-1" style={{ gap: px(4) }}>
                    {colorTipo.label && (
                        <span
                            className={`inline-flex items-center font-bold rounded-full ${colorTipo.labelBg}`}
                            style={{ fontSize: s(0.75), padding: `${px(2)} ${px(8)}` }}
                        >
                            {colorTipo.label}
                        </span>
                    )}
                    {enRetraso && (
                        <span
                            className="inline-flex items-center font-bold rounded-full bg-red-600 text-white animate-pulse"
                            style={{ fontSize: s(0.75), padding: `${px(2)} ${px(8)}`, gap: px(4) }}
                        >
                            ⚠️ {estadoRetraso.diasRetraso}d atraso
                        </span>
                    )}
                    {esUrgente && !enRetraso && (
                        <span
                            className="inline-flex items-center font-bold rounded-full bg-red-500 text-white animate-pulse"
                            style={{ fontSize: s(0.75), padding: `${px(2)} ${px(8)}`, gap: px(4) }}
                        >
                            !
                        </span>
                    )}
                    {/* Badge etapa actual */}
                    <span
                        className="inline-flex items-center font-semibold rounded-full"
                        style={{
                            backgroundColor: `${ETAPAS_CONFIG[proyecto.etapa_actual]?.color}15`,
                            color: ETAPAS_CONFIG[proyecto.etapa_actual]?.color,
                            fontSize: s(0.75),
                            padding: `${px(2)} ${px(8)}`,
                            border: `1px solid ${ETAPAS_CONFIG[proyecto.etapa_actual]?.color}30`
                        }}
                    >
                        {timelineSimplificado && proyecto.etapa_actual !== 'completado'
                            ? 'INSTALACIÓN'
                            : ETAPAS_CONFIG[proyecto.etapa_actual]?.nombre}
                    </span>
                </div>

                {/* Nombre y cliente */}
                <h3 className="font-bold text-gray-900 leading-tight truncate" style={{ fontSize: s(1.8) }}>
                    {proyecto.nombre}
                </h3>
                {proyecto.cliente && (
                    <p className="text-gray-500 flex items-center" style={{ marginTop: px(8), fontSize: s(1.5), gap: px(6) }}>
                        <User style={{ width: s(1.4), height: s(1.4) }} className="text-gray-400" />
                        {proyecto.cliente}
                    </p>
                )}
            </div>

            {/* Círculo de progreso + días restantes */}
            <div className="flex flex-col items-center" style={{ marginLeft: px(12) }}>
                {!timelineSimplificado && (
                    <div className="relative" style={{ width: px(64), height: px(64) }}>
                        <svg className="transform -rotate-90" viewBox="0 0 100 100" style={{ width: px(64), height: px(64) }}>
                            <circle cx="50%" cy="50%" r="45%" stroke="#E5E7EB" strokeWidth="10%" fill="none" />
                            <circle
                                cx="50%" cy="50%" r="45%"
                                stroke={porcentaje > 0 ? ETAPAS_CONFIG[proyecto.etapa_actual]?.color : 'transparent'}
                                strokeWidth="10%" fill="none"
                                strokeLinecap={porcentaje > 0 ? "round" : "butt"}
                                strokeDasharray={`${porcentaje * 2.8} 280`}
                                className="transition-all duration-500"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="font-bold text-gray-700" style={{ fontSize: s(1.1) }}>{porcentaje}%</span>
                        </div>
                    </div>
                )}
                {proyecto.fecha_limite && (
                    <div
                        className={`text-center font-medium ${diasRestantes !== null && (diasRestantes <= 3 && proyecto.etapa_actual !== 'instalacion' || (proyecto.etapa_actual === 'instalacion' && diasRestantes <= 2))
                            ? 'text-red-600' : 'text-gray-500'
                            }`}
                        style={{ marginTop: px(4), fontSize: s(0.75) }}
                    >
                        <div className="flex items-center" style={{ gap: px(4) }}>
                            <Clock style={{ width: s(0.7), height: s(0.7) }} />
                            {
                                diasRestantes !== null && diasRestantes < 0
                                    ? 'Vencido'
                                    : diasRestantes === 0
                                        ? 'Hoy'
                                        : `${diasRestantes}d`
                            }
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

TimelineHeader.displayName = 'TimelineHeader';

export default TimelineHeader;
