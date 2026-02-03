import React from 'react';
import { Package, ShoppingCart, Factory, Truck } from 'lucide-react';
import { ETAPAS_CONFIG } from './ProyectoTimeline';

const EstadisticasHeader = ({ estadisticas }) => {
    const s = (val) => `calc(${val}rem * var(--escala, 1))`;
    const px = (val) => `calc(${val}px * var(--escala, 1))`;

    const items = [
        { label: 'En Diseño',      value: estadisticas.diseno || 0,     color: ETAPAS_CONFIG.diseno.color,     icon: Package },
        { label: 'En Compras',     value: estadisticas.compras || 0,    color: ETAPAS_CONFIG.compras.color,    icon: ShoppingCart },
        { label: 'En Producción',  value: estadisticas.produccion || 0, color: ETAPAS_CONFIG.produccion.color, icon: Factory },
        { label: 'En Instalación', value: estadisticas.instalacion || 0,color: ETAPAS_CONFIG.instalacion.color,icon: Truck },
    ];

    return (
        <div className="grid grid-cols-4 mb-6" style={{ gap: px(8) }}>
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
