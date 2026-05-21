import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Package, AlertCircle, AlertTriangle, CheckCircle, TrendingUp, RefreshCw, Check, X, Sparkles, DollarSign } from 'lucide-react';
import reportesService from '../services/reportes.service';
import { Loader } from '../components/common';
import toast from 'react-hot-toast';

const formatCurrency = (n) => `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatNumber = (n) => (n || 0).toLocaleString('es-MX');

const ESTADO_LABEL = {
    critico: { texto: 'Crítico', color: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-500' },
    bajoMinimo: { texto: 'Bajo mínimo', color: 'bg-orange-100 text-orange-800 border-orange-200', dot: 'bg-orange-500' },
    ok: { texto: 'OK', color: 'bg-green-100 text-green-800 border-green-200', dot: 'bg-green-500' },
    sobreMaximo: { texto: 'Sobre máximo', color: 'bg-purple-100 text-purple-800 border-purple-200', dot: 'bg-purple-500' },
    sinMovimiento: { texto: 'Sin movimiento', color: 'bg-gray-100 text-gray-700 border-gray-200', dot: 'bg-gray-400' }
};

const ACCION_LABEL = {
    aumentar_min: { texto: 'Aumentar mínimo', color: 'bg-red-50 text-red-700 border-red-200' },
    reducir_min: { texto: 'Reducir mínimo', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    reducir_max: { texto: 'Reducir máximo', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    definir_max: { texto: 'Definir máximo', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    sin_movimiento: { texto: 'Sin movimiento', color: 'bg-gray-50 text-gray-700 border-gray-200' },
    ok: { texto: 'OK', color: 'bg-green-50 text-green-700 border-green-200' }
};

// Dona SVG simple a partir de distribución
const DonutChart = ({ data, total }) => {
    const segments = [
        { key: 'critico', value: data.critico, color: '#ef4444' },
        { key: 'bajoMinimo', value: data.bajoMinimo, color: '#f97316' },
        { key: 'ok', value: data.ok, color: '#22c55e' },
        { key: 'sobreMaximo', value: data.sobreMaximo, color: '#a855f7' },
        { key: 'sinMovimiento', value: data.sinMovimiento, color: '#9ca3af' }
    ].filter(s => s.value > 0);

    const radius = 70;
    const cx = 90, cy = 90;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    if (total === 0) {
        return (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                Sin datos para mostrar
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center gap-6 flex-wrap">
            <svg width="180" height="180" viewBox="0 0 180 180">
                <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f3f4f6" strokeWidth="22" />
                {segments.map((seg) => {
                    const len = (seg.value / total) * circumference;
                    const dasharray = `${len} ${circumference - len}`;
                    const dashoffset = -offset;
                    offset += len;
                    return (
                        <circle
                            key={seg.key}
                            cx={cx}
                            cy={cy}
                            r={radius}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth="22"
                            strokeDasharray={dasharray}
                            strokeDashoffset={dashoffset}
                            transform={`rotate(-90 ${cx} ${cy})`}
                        />
                    );
                })}
                <text x={cx} y={cy - 4} textAnchor="middle" className="fill-gray-900 text-2xl font-bold">{total}</text>
                <text x={cx} y={cy + 16} textAnchor="middle" className="fill-gray-500 text-xs">consumibles</text>
            </svg>
            <div className="space-y-1.5 text-sm">
                {Object.entries(data).map(([k, v]) => {
                    if (v === 0) return null;
                    const label = ESTADO_LABEL[k];
                    if (!label) return null;
                    return (
                        <div key={k} className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${label.dot}`}></span>
                            <span className="text-gray-700">{label.texto}</span>
                            <span className="text-gray-500 ml-auto">{v}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Gráfica de barras horizontal simple
const BarChart = ({ items, valueKey, labelKey, unitKey, color = 'bg-blue-500' }) => {
    if (items.length === 0) return <div className="text-gray-400 text-sm py-8 text-center">Sin datos</div>;
    const max = Math.max(...items.map(i => parseFloat(i[valueKey]) || 0));
    return (
        <div className="space-y-2">
            {items.map((item, idx) => {
                const value = parseFloat(item[valueKey]) || 0;
                const pct = max > 0 ? (value / max) * 100 : 0;
                return (
                    <div key={idx} className="text-sm">
                        <div className="flex items-center justify-between mb-0.5">
                            <span className="text-gray-700 truncate max-w-[60%]" title={item[labelKey]}>
                                {item[labelKey]}
                            </span>
                            <span className="font-medium text-gray-900">
                                {formatNumber(Math.round(value))} {item[unitKey] || ''}
                            </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }}></div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const ReportesPage = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dias, setDias] = useState(90);
    const [seleccion, setSeleccion] = useState(new Set());
    const [aplicando, setAplicando] = useState(false);
    const [filtroAccion, setFiltroAccion] = useState('todos');

    const cargar = async () => {
        try {
            setLoading(true);
            const res = await reportesService.inventarioConsumibles(dias);
            setData(res);
            setSeleccion(new Set());
        } catch (err) {
            console.error(err);
            toast.error('Error al cargar el reporte');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [dias]);

    const sugerenciasFiltradas = useMemo(() => {
        if (!data) return [];
        if (filtroAccion === 'todos') return data.sugerencias;
        return data.sugerencias.filter(s => s.sugerencia.accion === filtroAccion);
    }, [data, filtroAccion]);

    const toggleSeleccion = (id) => {
        setSeleccion(prev => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id); else n.add(id);
            return n;
        });
    };

    const seleccionarTodos = () => {
        if (seleccion.size === sugerenciasFiltradas.length) {
            setSeleccion(new Set());
        } else {
            setSeleccion(new Set(sugerenciasFiltradas.map(s => s.id)));
        }
    };

    const aplicar = async () => {
        if (seleccion.size === 0) {
            toast.error('Selecciona al menos un artículo');
            return;
        }
        const ajustes = sugerenciasFiltradas
            .filter(s => seleccion.has(s.id))
            .map(s => {
                const a = { id: s.id };
                const acc = s.sugerencia.accion;
                if (acc === 'aumentar_min' || acc === 'reducir_min') {
                    a.stock_minimo = s.sugerencia.stock_min_sugerido;
                } else if (acc === 'reducir_max' || acc === 'definir_max') {
                    a.stock_maximo = s.sugerencia.stock_max_sugerido;
                } else if (acc === 'sin_movimiento') {
                    a.stock_minimo = 0;
                }
                return a;
            });
        if (!window.confirm(`¿Aplicar ${ajustes.length} ajuste(s) de stock? Esta acción modifica los artículos.`)) return;
        try {
            setAplicando(true);
            const res = await reportesService.aplicarSugerencias(ajustes);
            toast.success(res.message || 'Ajustes aplicados');
            await cargar();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Error al aplicar ajustes');
        } finally {
            setAplicando(false);
        }
    };

    if (loading && !data) return <Loader fullScreen />;

    const { kpis, distribucion, top_consumidos, resumen_categorias, parametros } = data || {};

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <BarChart3 className="text-red-700" size={32} />
                        Reportes de Inventario
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Análisis de materiales consumibles y sugerencias de ajuste · {parametros?.dias_analizados ?? dias} días
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={dias}
                        onChange={(e) => setDias(parseInt(e.target.value, 10))}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                    >
                        <option value={30}>Últimos 30 días</option>
                        <option value={60}>Últimos 60 días</option>
                        <option value={90}>Últimos 90 días</option>
                        <option value={180}>Últimos 180 días</option>
                        <option value={365}>Últimos 365 días</option>
                    </select>
                    <button
                        onClick={cargar}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Actualizar
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <KpiCard
                    icon={<Package size={24} className="text-blue-600" />}
                    bg="bg-blue-100"
                    label="Consumibles"
                    value={formatNumber(kpis.total_consumibles)}
                />
                <KpiCard
                    icon={<DollarSign size={24} className="text-green-600" />}
                    bg="bg-green-100"
                    label="Valoración total"
                    value={formatCurrency(kpis.valoracion_total)}
                />
                <KpiCard
                    icon={<AlertTriangle size={24} className="text-orange-600" />}
                    bg="bg-orange-100"
                    label="Bajo mínimo"
                    value={formatNumber(kpis.articulos_bajo_minimo + kpis.articulos_criticos)}
                    sub={`${kpis.articulos_criticos} crítico${kpis.articulos_criticos !== 1 ? 's' : ''}`}
                />
                <KpiCard
                    icon={<Sparkles size={24} className="text-purple-600" />}
                    bg="bg-purple-100"
                    label="Sugerencias"
                    value={formatNumber(kpis.sugerencias_pendientes)}
                    sub="ajustes propuestos"
                />
            </div>

            {/* Gráficas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Estado del stock</h2>
                    <DonutChart data={distribucion} total={kpis.total_consumibles} />
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <TrendingUp size={20} className="text-blue-600" />
                        Top consumidos (período)
                    </h2>
                    <BarChart
                        items={top_consumidos.map(t => ({ ...t, label: t.nombre }))}
                        valueKey="consumo_total"
                        labelKey="label"
                        unitKey="unidad"
                        color="bg-blue-500"
                    />
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 lg:col-span-2">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Valoración por categoría</h2>
                    <BarChart
                        items={resumen_categorias.slice(0, 10).map(c => ({ label: c.categoria, valor: c.valor, articulos: c.articulos, bajo_minimo: c.bajo_minimo }))}
                        valueKey="valor"
                        labelKey="label"
                        color="bg-green-500"
                    />
                </div>
            </div>

            {/* Sugerencias */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Sparkles size={20} className="text-purple-600" />
                            Sugerencias de ajuste
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Mínimo sugerido = consumo diario × {parametros?.lead_time_dias} días · Máximo = consumo × {parametros?.cobertura_dias} días
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={filtroAccion}
                            onChange={(e) => { setFiltroAccion(e.target.value); setSeleccion(new Set()); }}
                            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                        >
                            <option value="todos">Todas las acciones</option>
                            <option value="aumentar_min">Aumentar mínimo</option>
                            <option value="reducir_min">Reducir mínimo</option>
                            <option value="reducir_max">Reducir máximo</option>
                            <option value="definir_max">Definir máximo</option>
                            <option value="sin_movimiento">Sin movimiento</option>
                        </select>
                        <button
                            onClick={aplicar}
                            disabled={aplicando || seleccion.size === 0}
                            className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
                        >
                            <Check size={16} />
                            Aplicar {seleccion.size > 0 ? `(${seleccion.size})` : ''}
                        </button>
                    </div>
                </div>

                {sugerenciasFiltradas.length === 0 ? (
                    <div className="p-10 text-center text-gray-500">
                        <CheckCircle size={48} className="mx-auto mb-3 text-green-300" />
                        <p>No hay sugerencias pendientes con este filtro.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                                <tr>
                                    <th className="px-3 py-3 text-left">
                                        <input
                                            type="checkbox"
                                            checked={seleccion.size > 0 && seleccion.size === sugerenciasFiltradas.length}
                                            onChange={seleccionarTodos}
                                        />
                                    </th>
                                    <th className="px-3 py-3 text-left">Artículo</th>
                                    <th className="px-3 py-3 text-left">Estado</th>
                                    <th className="px-3 py-3 text-right">Stock actual</th>
                                    <th className="px-3 py-3 text-right">Consumo/mes</th>
                                    <th className="px-3 py-3 text-right">Mín actual → sugerido</th>
                                    <th className="px-3 py-3 text-right">Máx actual → sugerido</th>
                                    <th className="px-3 py-3 text-left">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {sugerenciasFiltradas.map(s => {
                                    const est = ESTADO_LABEL[s.estado] || ESTADO_LABEL.ok;
                                    const acc = ACCION_LABEL[s.sugerencia.accion] || ACCION_LABEL.ok;
                                    const sel = seleccion.has(s.id);
                                    const cambiaMin = s.stock_minimo !== s.sugerencia.stock_min_sugerido && (s.sugerencia.accion === 'aumentar_min' || s.sugerencia.accion === 'reducir_min' || s.sugerencia.accion === 'sin_movimiento');
                                    const cambiaMax = s.stock_maximo !== s.sugerencia.stock_max_sugerido && (s.sugerencia.accion === 'reducir_max' || s.sugerencia.accion === 'definir_max');
                                    return (
                                        <tr key={s.id} className={sel ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                                            <td className="px-3 py-3">
                                                <input type="checkbox" checked={sel} onChange={() => toggleSeleccion(s.id)} />
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="font-medium text-gray-900">{s.nombre}</div>
                                                <div className="text-xs text-gray-500">{s.categoria || 'Sin categoría'} · {s.unidad}</div>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${est.color}`}>
                                                    <span className={`w-2 h-2 rounded-full ${est.dot}`}></span>
                                                    {est.texto}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-right text-gray-900">{formatNumber(s.stock_actual)}</td>
                                            <td className="px-3 py-3 text-right text-gray-700">{s.consumo_mensual.toFixed(1)}</td>
                                            <td className="px-3 py-3 text-right">
                                                <span className="text-gray-500">{formatNumber(s.stock_minimo)}</span>
                                                {cambiaMin && (
                                                    <>
                                                        {' → '}
                                                        <span className="font-semibold text-gray-900">{formatNumber(s.sugerencia.stock_min_sugerido)}</span>
                                                    </>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                <span className="text-gray-500">{s.stock_maximo !== null ? formatNumber(s.stock_maximo) : '-'}</span>
                                                {cambiaMax && (
                                                    <>
                                                        {' → '}
                                                        <span className="font-semibold text-gray-900">{formatNumber(s.sugerencia.stock_max_sugerido)}</span>
                                                    </>
                                                )}
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded border ${acc.color}`} title={s.sugerencia.razon}>
                                                    {acc.texto}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

const KpiCard = ({ icon, bg, label, value, sub }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">{label}</p>
            <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
        </div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
);

export default ReportesPage;
