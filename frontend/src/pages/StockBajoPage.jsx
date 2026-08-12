import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AlertTriangle, Package, Search, RefreshCw, Download, Warehouse, ChevronDown, ChevronRight, XCircle, DollarSign } from 'lucide-react';
import reportesService from '../services/reportes.service';
import { Loader } from '../components/common';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const formatCurrency = (n) => `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatNumber = (n) => (n || 0).toLocaleString('es-MX');
const formatCantidad = (n) => {
    const v = parseFloat(n) || 0;
    return Number.isInteger(v) ? v.toLocaleString('es-MX') : v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const ESTADOS = {
    agotado: { texto: 'Agotado', badge: 'bg-red-100 text-red-800 border-red-200', barra: 'bg-red-500', dot: 'bg-red-500' },
    critico: { texto: 'Crítico', badge: 'bg-orange-100 text-orange-800 border-orange-200', barra: 'bg-orange-500', dot: 'bg-orange-500' },
    bajo: { texto: 'Bajo mínimo', badge: 'bg-yellow-100 text-yellow-800 border-yellow-200', barra: 'bg-yellow-500', dot: 'bg-yellow-500' }
};

const KpiCard = ({ icon, bg, label, value, sub }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
        <div className={`${bg} rounded-lg p-2.5 shrink-0`}>{icon}</div>
        <div className="min-w-0">
            <p className="text-xs text-gray-500 truncate">{label}</p>
            <p className="text-xl font-bold text-gray-900">{value}</p>
            {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
        </div>
    </div>
);

const BarraCobertura = ({ articulo }) => {
    const { stock_actual, stock_minimo, estado } = articulo;
    const pct = stock_minimo > 0
        ? Math.min(100, Math.max(0, (stock_actual / stock_minimo) * 100))
        : (stock_actual > 0 ? 100 : 0);
    return (
        <div className="w-24">
            <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full ${ESTADOS[estado].barra}`} style={{ width: `${pct}%` }}></div>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">{Math.round(pct)}% del mínimo</p>
        </div>
    );
};

const StockBajoPage = () => {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('todos');
    const [almacenActivo, setAlmacenActivo] = useState('todos');
    const [soloConMinimo, setSoloConMinimo] = useState(false);
    const [colapsados, setColapsados] = useState(new Set());

    const cargar = async () => {
        try {
            setLoading(true);
            const res = await reportesService.stockBajo();
            setData(res);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Error al cargar el stock bajo');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { cargar(); }, []);

    // Búsqueda + estado + "solo con mínimo", sin filtrar todavía por almacén:
    // así los chips de almacén muestran el conteo real de lo que se está viendo.
    const gruposBase = useMemo(() => {
        if (!data) return [];
        const texto = busqueda.trim().toLowerCase();
        return data.almacenes.map(g => {
            const articulos = g.articulos.filter(a => {
                if (soloConMinimo && !(a.stock_minimo > 0)) return false;
                if (filtroEstado !== 'todos' && a.estado !== filtroEstado) return false;
                if (!texto) return true;
                return (
                    a.nombre?.toLowerCase().includes(texto) ||
                    a.sku?.toLowerCase().includes(texto) ||
                    a.codigo_ean13?.toLowerCase().includes(texto) ||
                    a.categoria?.toLowerCase().includes(texto) ||
                    a.proveedor?.toLowerCase().includes(texto)
                );
            });
            return { ...g, articulos };
        });
    }, [data, busqueda, filtroEstado, soloConMinimo]);

    const almacenesFiltrados = useMemo(() => (
        gruposBase
            .filter(g => almacenActivo === 'todos' || String(g.almacen_id ?? g.almacen) === almacenActivo)
            .filter(g => g.articulos.length > 0)
    ), [gruposBase, almacenActivo]);

    const totales = useMemo(() => {
        return almacenesFiltrados.reduce((acc, g) => {
            acc.articulos += g.articulos.length;
            g.articulos.forEach(a => {
                if (a.estado === 'agotado') acc.agotados += 1;
                else if (a.estado === 'critico') acc.criticos += 1;
                else acc.bajos += 1;
                acc.reposicion += a.costo_reposicion || 0;
            });
            return acc;
        }, { articulos: 0, agotados: 0, criticos: 0, bajos: 0, reposicion: 0 });
    }, [almacenesFiltrados]);

    const toggleAlmacen = (clave) => {
        setColapsados(prev => {
            const n = new Set(prev);
            if (n.has(clave)) n.delete(clave); else n.add(clave);
            return n;
        });
    };

    const exportarCSV = () => {
        const filas = [['Almacén', 'Artículo', 'SKU', 'Código', 'Categoría', 'Proveedor', 'Ubicación', 'Stock actual', 'Stock mínimo', 'Stock máximo', 'Unidad', 'Faltante', 'Sugerido comprar', 'Costo reposición', 'Estado']];
        almacenesFiltrados.forEach(g => {
            g.articulos.forEach(a => {
                filas.push([
                    g.almacen, a.nombre, a.sku || '', a.codigo_ean13 || '', a.categoria || '', a.proveedor || '', a.ubicacion || '',
                    a.stock_actual, a.stock_minimo, a.stock_maximo ?? '', a.unidad || '',
                    a.faltante, a.sugerido_comprar, a.costo_reposicion, ESTADOS[a.estado].texto
                ]);
            });
        });
        const csv = filas
            .map(f => f.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `stock-bajo-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    // Ventana exclusiva de administrador (el backend también lo valida)
    if (user && user.rol !== 'administrador') {
        return <Navigate to="/inventario" replace />;
    }

    if (loading && !data) return <Loader fullScreen />;

    const resumen = data?.resumen || {};

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <AlertTriangle className="text-red-700" size={32} />
                        Stock Bajo
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Todos los artículos por debajo de su mínimo, en todos los almacenes
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={exportarCSV}
                        disabled={totales.articulos === 0}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                    >
                        <Download size={16} />
                        Exportar CSV
                    </button>
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <KpiCard
                    icon={<Package size={22} className="text-blue-600" />}
                    bg="bg-blue-100"
                    label="Artículos bajo mínimo"
                    value={formatNumber(totales.articulos)}
                    sub={totales.articulos !== resumen.total ? `de ${formatNumber(resumen.total)} en total` : null}
                />
                <KpiCard
                    icon={<XCircle size={22} className="text-red-600" />}
                    bg="bg-red-100"
                    label="Agotados"
                    value={formatNumber(totales.agotados)}
                />
                <KpiCard
                    icon={<AlertTriangle size={22} className="text-orange-600" />}
                    bg="bg-orange-100"
                    label="Críticos"
                    value={formatNumber(totales.criticos)}
                    sub="Menos de la mitad del mínimo"
                />
                <KpiCard
                    icon={<Warehouse size={22} className="text-purple-600" />}
                    bg="bg-purple-100"
                    label="Almacenes afectados"
                    value={formatNumber(almacenesFiltrados.length)}
                />
                <KpiCard
                    icon={<DollarSign size={22} className="text-green-600" />}
                    bg="bg-green-100"
                    label="Costo de reposición"
                    value={formatCurrency(totales.reposicion)}
                    sub="Para volver al máximo"
                />
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar por artículo, SKU, código, categoría o proveedor..."
                            className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                    </div>
                    <select
                        value={filtroEstado}
                        onChange={(e) => setFiltroEstado(e.target.value)}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                    >
                        <option value="todos">Todos los estados</option>
                        <option value="agotado">Agotados</option>
                        <option value="critico">Críticos</option>
                        <option value="bajo">Bajo mínimo</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={soloConMinimo}
                            onChange={(e) => setSoloConMinimo(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-red-700 focus:ring-red-500"
                        />
                        Solo con mínimo configurado
                    </label>
                </div>

                {/* Chips por almacén */}
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setAlmacenActivo('todos')}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${almacenActivo === 'todos'
                            ? 'bg-red-700 text-white border-red-700'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                    >
                        Todos los almacenes ({formatNumber(gruposBase.reduce((s, g) => s + g.articulos.length, 0))})
                    </button>
                    {gruposBase.map(g => {
                        const clave = String(g.almacen_id ?? g.almacen);
                        const activo = almacenActivo === clave;
                        if (g.articulos.length === 0 && !activo) return null;
                        return (
                            <button
                                key={clave}
                                onClick={() => setAlmacenActivo(clave)}
                                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${activo
                                    ? 'bg-red-700 text-white border-red-700'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                            >
                                {g.almacen} ({g.articulos.length})
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Resultado */}
            {almacenesFiltrados.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <Package size={48} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-600 font-medium">
                        {resumen.total === 0 ? 'Ningún artículo está por debajo de su mínimo' : 'Sin resultados con estos filtros'}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {almacenesFiltrados.map(g => {
                        const clave = String(g.almacen_id ?? g.almacen);
                        const colapsado = colapsados.has(clave);
                        const reposicionVisible = g.articulos.reduce((s, a) => s + (a.costo_reposicion || 0), 0);
                        return (
                            <div key={clave} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                <button
                                    onClick={() => toggleAlmacen(clave)}
                                    className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        {colapsado ? <ChevronRight size={18} className="text-gray-500" /> : <ChevronDown size={18} className="text-gray-500" />}
                                        <Warehouse size={18} className="text-gray-600 shrink-0" />
                                        <span className="font-semibold text-gray-900 truncate">{g.almacen}</span>
                                        <span className="text-sm text-gray-500">· {g.articulos.length} artículo(s)</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs shrink-0">
                                        {g.articulos.some(a => a.estado === 'agotado') && (
                                            <span className="px-2 py-0.5 rounded-full border bg-red-100 text-red-800 border-red-200">
                                                {g.articulos.filter(a => a.estado === 'agotado').length} agotados
                                            </span>
                                        )}
                                        {g.articulos.some(a => a.estado === 'critico') && (
                                            <span className="px-2 py-0.5 rounded-full border bg-orange-100 text-orange-800 border-orange-200">
                                                {g.articulos.filter(a => a.estado === 'critico').length} críticos
                                            </span>
                                        )}
                                        <span className="hidden sm:inline text-gray-600 font-medium">{formatCurrency(reposicionVisible)}</span>
                                    </div>
                                </button>

                                {!colapsado && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-white border-b border-gray-200">
                                                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                                    <th className="px-4 py-2 font-medium">Artículo</th>
                                                    <th className="px-4 py-2 font-medium">Ubicación</th>
                                                    <th className="px-4 py-2 font-medium text-right">Actual</th>
                                                    <th className="px-4 py-2 font-medium text-right">Mínimo</th>
                                                    <th className="px-4 py-2 font-medium">Cobertura</th>
                                                    <th className="px-4 py-2 font-medium text-right">Comprar</th>
                                                    <th className="px-4 py-2 font-medium text-right">Costo</th>
                                                    <th className="px-4 py-2 font-medium">Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {g.articulos.map(a => (
                                                    <tr key={a.id} className="hover:bg-gray-50">
                                                        <td className="px-4 py-2.5">
                                                            <p className="font-medium text-gray-900">{a.nombre}</p>
                                                            <p className="text-xs text-gray-500">
                                                                {a.categoria}
                                                                {a.sku ? ` · SKU ${a.sku}` : ''}
                                                                {a.proveedor ? ` · ${a.proveedor}` : ''}
                                                            </p>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-gray-600">{a.ubicacion || '—'}</td>
                                                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                                                            {formatCantidad(a.stock_actual)} <span className="text-xs font-normal text-gray-500">{a.unidad}</span>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right text-gray-600">{formatCantidad(a.stock_minimo)}</td>
                                                        <td className="px-4 py-2.5"><BarraCobertura articulo={a} /></td>
                                                        <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                                                            {a.sugerido_comprar > 0 ? formatCantidad(a.sugerido_comprar) : '—'}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right text-gray-600">
                                                            {a.costo_reposicion > 0 ? formatCurrency(a.costo_reposicion) : '—'}
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <span className={`px-2 py-0.5 text-xs rounded-full border ${ESTADOS[a.estado].badge}`}>
                                                                {ESTADOS[a.estado].texto}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {data?.generado && (
                <p className="text-xs text-gray-400 mt-4">
                    Actualizado el {new Date(data.generado).toLocaleString('es-MX')}
                </p>
            )}
        </div>
    );
};

export default StockBajoPage;
