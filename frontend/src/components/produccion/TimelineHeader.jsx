import React, { memo } from 'react';
import { User, Clock, Calendar, AlertTriangle, CheckCircle2, CalendarClock } from 'lucide-react';
import { s, px, calcularDiasPorEtapa, esUrgenteMTO } from '../../utils/produccion';
import { ETAPAS_CONFIG, getColorPorTipo, calcularPorcentaje, usaTimelineSimplificado } from './constants';
import { useDiseno3G } from '../../diseno-3g/useDiseno3G';
import { useTvG3, tipoTv } from '../../diseno-3g/tvG3';

// Diseño 3G (interruptor o TV): tipo de trabajo con su nombre completo y el color del tipo (tokens del paquete).
const COLOR_TIPO_G3 = {
    'g3tv-etq--instalacion': { background: 'var(--g3-instalacion-suave)', color: 'var(--g3-instalacion)' },
    'g3tv-etq--mantenimiento': { background: 'var(--g3-mantenimiento-suave)', color: 'var(--g3-mantenimiento)' },
    'g3tv-etq--garantia': { background: 'var(--g3-garantia-suave)', color: 'var(--g3-garantia)' },
};

/**
 * Header de la tarjeta de proyecto
 * Muestra: badges, nombre, cliente y círculo de progreso
 */
const TimelineHeader = memo(({ proyecto, onAbrirCarpeta }) => {
    const g3 = useDiseno3G();
    const tv = useTvG3();
    const nuevo = g3 || !!tv; // textos sin siglas ni emojis (apagado, lo de siempre)
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

    // MTO: solo cuenta la fecha del calendario. Urgente únicamente si ya se pasó.
    const esUrgente = esMTO
        ? esUrgenteMTO(proyecto)
        : (proyecto.prioridad === 1 || esGarantia || urgenciaPorFecha || enRetraso);

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
                    {colorTipo.label && (nuevo ? (() => {
                        const t = tipoTv(proyecto.tipo_proyecto);
                        return (
                            <span
                                className="inline-flex items-center font-bold rounded-full"
                                style={{ fontSize: s(0.75), padding: `${px(2)} ${px(8)}`, ...(COLOR_TIPO_G3[t.clase] || { background: 'var(--g3-neutro-suave)', color: 'var(--g3-tinta)' }) }}
                            >
                                {t.texto}
                            </span>
                        );
                    })() : (
                        <span
                            className={`inline-flex items-center font-bold rounded-full ${colorTipo.labelBg}`}
                            style={{ fontSize: s(0.75), padding: `${px(2)} ${px(8)}` }}
                        >
                            {colorTipo.label}
                        </span>
                    ))}
                    {enRetraso && (
                        <span
                            className="inline-flex items-center font-bold rounded-full bg-red-600 text-white animate-pulse"
                            style={{ fontSize: s(0.75), padding: `${px(2)} ${px(8)}`, gap: px(4) }}
                        >
                            {nuevo
                                ? <><AlertTriangle style={{ width: s(0.85), height: s(0.85) }} aria-hidden="true" />{diasRetrasoDisplay} día{diasRetrasoDisplay !== 1 ? 's' : ''} de atraso</>
                                : <>⚠️ {diasRetrasoDisplay}d atraso</>}
                        </span>
                    )}
                    {esUrgente && !enRetraso && (
                        <span
                            className="inline-flex items-center font-bold rounded-full bg-red-500 text-white animate-pulse"
                            style={{ fontSize: s(0.75), padding: `${px(2)} ${px(8)}`, gap: px(4) }}
                        >
                            {nuevo ? 'Urgente' : '!'}
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
                            ? (nuevo ? ETAPAS_CONFIG.instalacion.nombre : ETAPAS_CONFIG.instalacion.nombre.toUpperCase())
                            : ETAPAS_CONFIG[proyecto.etapa_actual]?.nombre}
                    </span>
                </div>

                {/* Nombre y cliente. Con onAbrirCarpeta, abren la carpeta de Drive. */}
                {onAbrirCarpeta ? (
                    <button
                        type="button"
                        onClick={onAbrirCarpeta}
                        title="Ver la carpeta de producción de este proyecto"
                        className="text-left w-full rounded hover:bg-black/5 transition-colors cursor-pointer"
                        style={{ minWidth: 0 }}
                    >
                        <h3 className="font-bold text-gray-900 leading-tight truncate" style={{ fontSize: s(1.8) }}>
                            {proyecto.nombre}
                        </h3>

                        {proyecto.cliente && (
                            <p className="text-gray-500 flex items-center" style={{ marginTop: px(8), fontSize: s(1.5), gap: px(6) }}>
                                <User style={{ width: s(1.4), height: s(1.4) }} className="text-gray-400" />
                                {proyecto.cliente}
                            </p>
                        )}
                    </button>
                ) : (
                    <>
                        <h3 className="font-bold text-gray-900 leading-tight truncate" style={{ fontSize: s(1.8) }}>
                            {proyecto.nombre}
                        </h3>

                        {proyecto.cliente && (
                            <p className="text-gray-500 flex items-center" style={{ marginTop: px(8), fontSize: s(1.5), gap: px(6) }}>
                                <User style={{ width: s(1.4), height: s(1.4) }} className="text-gray-400" />
                                {proyecto.cliente}
                            </p>
                        )}
                    </>
                )}

                {/* C7 · PLA-17: el sí o el no de Producción por WhatsApp (lo manda Julia). Solo Diseño 3G o TV con ?diseno=3g;
                    con el diseño de siempre no se monta nada. Solo informa: no cierra ni mueve la etapa. */}
                {nuevo && proyecto.pronostico_whatsapp?.texto && (() => {
                    const si = proyecto.pronostico_whatsapp.respuesta === 'si';
                    const Icono = si ? CheckCircle2 : CalendarClock;
                    return (
                        <p
                            className="inline-flex items-center font-semibold rounded-xl"
                            style={{
                                marginTop: px(8), fontSize: s(1.05), padding: `${px(3)} ${px(10)}`, gap: px(6), maxWidth: '100%', lineHeight: 1.3,
                                background: si ? 'var(--g3-ok-suave)' : 'var(--g3-aviso-suave)',
                                color: si ? 'var(--g3-ok)' : 'var(--g3-aviso)'
                            }}
                        >
                            <Icono style={{ width: s(1.1), height: s(1.1), flex: 'none' }} aria-hidden="true" />
                            <span style={{ minWidth: 0 }}>{proyecto.pronostico_whatsapp.texto}</span>
                        </p>
                    );
                })()}
            </div>

            {/* Círculo de progreso + días restantes */}
            <div className="flex flex-col items-center" style={{ marginLeft: px(12) }}>
                {!timelineSimplificado && (
                    <div className="flex items-center justify-center mb-1">
                        {proyecto._fechaCalendario ? (
                            <div className="flex flex-col items-center justify-center bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5 shadow-sm min-w-[85px]">
                                <div className="flex items-center gap-1 text-blue-600 font-bold uppercase tracking-wider mb-0.5 g3p-texto-min g3:normal-case g3:tracking-normal" style={{ fontSize: s(0.65) }}>
                                    <Calendar size={12} />
                                    Cita agendada
                                </div>
                                <span className="font-bold text-blue-800 leading-tight whitespace-nowrap" style={{ fontSize: s(1.35) }}>
                                    {new Date((proyecto._fechaInstalacion || proyecto.fecha_limite) + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '')}
                                </span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm min-w-[85px]">
                                <span className="text-gray-400 font-bold uppercase tracking-wider mb-0.5 g3p-texto-min g3:normal-case g3:tracking-normal" style={{ fontSize: s(0.65) }}>{nuevo ? 'Avance' : 'AVANCE'}</span>
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
