import React, { memo } from 'react';
import { User, Clock, Calendar } from 'lucide-react';
import { s, px, calcularDiasPorEtapa } from '../../utils/produccion';
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
    let diasRetrasoDisplay = estadoRetraso.diasRetraso || 0;

    // Si el proyecto tiene fecha de calendario, recalcular con calcularDiasPorEtapa
    // ya que el backend no considera la fecha_limite del calendario
    if (enRetraso && proyecto._fechaCalendario) {
        const diasPorEtapa = calcularDiasPorEtapa(proyecto);
        if (diasPorEtapa) {
            const etapaKey = proyecto.etapa_actual === 'produccion' ? 'produccion' : proyecto.etapa_actual;
            const info = diasPorEtapa[etapaKey];
            if (info && info.dias >= 0) {
                enRetraso = false;  // Está a tiempo según calendario
            } else if (info && info.dias < 0) {
                diasRetrasoDisplay = Math.abs(info.dias);  // Usar días de atraso reales
            }
        }
    }

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
                            ⚠️ {diasRetrasoDisplay}d atraso
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
                            ? ETAPAS_CONFIG.instalacion.nombre.toUpperCase()
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
                    <div className="flex items-center justify-center mb-1">
                        {proyecto._fechaCalendario ? (
                            <div className="flex flex-col items-center justify-center bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5 shadow-sm min-w-[85px]">
                                <div className="flex items-center gap-1 text-blue-600 font-bold uppercase tracking-wider mb-0.5" style={{ fontSize: s(0.65) }}>
                                    <Calendar size={12} />
                                    Cita agendada
                                </div>
                                <span className="font-bold text-blue-800 leading-tight whitespace-nowrap" style={{ fontSize: s(1.35) }}>
                                    {new Date(proyecto.fecha_limite + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '')}
                                </span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm min-w-[85px]">
                                <span className="text-gray-400 font-bold uppercase tracking-wider mb-0.5" style={{ fontSize: s(0.65) }}>AVANCE</span>
                                <span className="font-bold text-gray-700 leading-tight" style={{ fontSize: s(1.15) }}>{porcentaje}%</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

TimelineHeader.displayName = 'TimelineHeader';

export default TimelineHeader;
