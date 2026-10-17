// VIEJO: se borra a partir del 24-oct-2026 — solo el diseño nuevo (16-oct-2026): en este archivo, lo que sigue a cada
// `if (…)` marcado y las ramas con d3 en false son la vista apagada, que ya nunca se ve. Las ramas con tv
// (useTvG3) en true son el diseño de TV de la ola 3, que tampoco se ve.
// Se deja escondido una semana por si hay que regresar; ver src/diseno-3g/LEEME.md («Solo el diseño nuevo»).
import React from 'react';
import { ETAPAS_CONFIG } from './ProyectoTimeline';
import { s, px } from '../../utils/produccion';
import { useTvG3 } from '../../diseno-3g/tvG3';

const EstadisticasHeader = ({ estadisticas }) => {
    const tv = useTvG3(); // Diseño 3G para TV (solo con ?diseno=3g en la pantalla de TV); si no, lo de siempre

    const items = [
        { label: 'En Diseño', value: estadisticas.diseno || 0, color: ETAPAS_CONFIG.diseno.color, icon: ETAPAS_CONFIG.diseno.icon },
        { label: 'En Compras', value: estadisticas.compras || 0, color: ETAPAS_CONFIG.compras.color, icon: ETAPAS_CONFIG.compras.icon },
        { label: 'En Producción', value: estadisticas.produccion || 0, color: ETAPAS_CONFIG.produccion.color, icon: ETAPAS_CONFIG.produccion.icon },
        { label: 'Completado', value: estadisticas.instalacion || 0, color: ETAPAS_CONFIG.instalacion.color, icon: ETAPAS_CONFIG.instalacion.icon },
    ];

    if (tv) {
        // Mismos números y mismas etiquetas (en oración), con el ícono de cada etapa en su color.
        return (
            <section className="g3tv-kpis" aria-label="Proyectos por etapa">
                {items.map(item => {
                    const Icon = item.icon;
                    return (
                        <div key={item.label} className="g3tv-kpi">
                            <div className="g3tv-kpi-cab"><Icon aria-hidden="true" style={{ color: item.color }} />{item.label.charAt(0) + item.label.slice(1).toLowerCase()}</div>
                            <div className="g3tv-kpi-valor">{item.value}</div>
                        </div>
                    );
                })}
            </section>
        );
    }

    return (
        <div className="grid grid-cols-4 mb-6 g3:max-md:grid-cols-2" style={{ gap: px(8) }}>
            {items.map(item => {
                const Icon = item.icon;
                return (
                    <div
                        key={item.label}
                        className="bg-white rounded-xl shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center"
                        style={{ padding: `${px(24)} ${px(8)}`, minHeight: px(220) }}
                    >
                        <div className="flex items-center justify-center" style={{ marginBottom: px(8) }}>
                            <div className="rounded-full flex items-center justify-center" style={{ width: px(48), height: px(48), backgroundColor: `${item.color}20` }}>
                                <Icon style={{ width: px(24), height: px(24), color: item.color }} />
                            </div>
                        </div>
                        <div className="font-bold" style={{ fontSize: s(2.25), color: item.color }}>{item.value}</div>
                        <div className="font-bold leading-tight text-gray-500" style={{ fontSize: s(1.125) }}>{item.label}</div>
                    </div>
                );
            })}
        </div>
    );
};

export default EstadisticasHeader;
