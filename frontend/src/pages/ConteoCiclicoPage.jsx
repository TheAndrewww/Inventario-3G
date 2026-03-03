import React, { useState, useEffect, useRef } from 'react';
import { ClipboardCheck, Search, Package, CheckCircle2, AlertTriangle, ArrowRight, BarChart3, RefreshCw, X, Calendar, TrendingUp, ChevronDown, ChevronUp, FastForward } from 'lucide-react';
import toast from 'react-hot-toast';
import conteosCiclicosService from '../services/conteosCiclicos.service';

const ConteoCiclicoPage = () => {
    const [tab, setTab] = useState('conteo'); // 'conteo' | 'reportes'

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                        <ClipboardCheck className="text-red-600" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Conteo Cíclico</h1>
                        <p className="text-sm text-gray-500">Checklist diario de inventario</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
                <button
                    onClick={() => setTab('conteo')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${tab === 'conteo'
                        ? 'bg-white text-red-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    <ClipboardCheck size={18} />
                    Conteo del Día
                </button>
                <button
                    onClick={() => setTab('reportes')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${tab === 'reportes'
                        ? 'bg-white text-red-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    <BarChart3 size={18} />
                    Reportes
                </button>
            </div>

            {tab === 'conteo' && <TabConteo />}
            {tab === 'reportes' && <TabReportes />}
        </div>
    );
};

// ============ TAB CONTEO DEL DÍA ============
const TabConteo = () => {
    const [conteo, setConteo] = useState(null);
    const [pendientes, setPendientes] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingPendientes, setLoadingPendientes] = useState(false);
    const [adelantando, setAdelantando] = useState(false);

    const [articuloSeleccionado, setArticuloSeleccionado] = useState(null);
    const [cantidadFisica, setCantidadFisica] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [registrando, setRegistrando] = useState(false);

    const searchInputRef = useRef(null);
    const cantidadInputRef = useRef(null);

    useEffect(() => {
        cargarConteoHoy();
    }, []);

    const cargarConteoHoy = async () => {
        setLoading(true);
        try {
            const res = await conteosCiclicosService.getHoy();
            setConteo(res.data);
            if (res.data) {
                cargarPendientes(res.data.id, '');
            }
        } catch (error) {
            toast.error('Error al cargar conteo del día');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const cargarPendientes = async (conteoId, search) => {
        setLoadingPendientes(true);
        try {
            const res = await conteosCiclicosService.getPendientes(conteoId, search);
            setPendientes(res.data || []);
            // Sync conteo counts
            if (conteo) {
                setConteo(prev => ({
                    ...prev,
                    articulos_contados: res.contados,
                    total_asignados: res.total_asignados
                }));
            }
        } catch (error) {
            console.error('Error cargando pendientes:', error);
        } finally {
            setLoadingPendientes(false);
        }
    };

    useEffect(() => {
        if (!conteo) return;
        const timer = setTimeout(() => {
            cargarPendientes(conteo.id, busqueda);
        }, 300);
        return () => clearTimeout(timer);
    }, [busqueda]);

    const seleccionarArticulo = (articulo) => {
        setArticuloSeleccionado(articulo);
        setCantidadFisica('');
        setObservaciones('');
        setTimeout(() => cantidadInputRef.current?.focus(), 100);
    };

    const registrarConteo = async () => {
        if (!articuloSeleccionado || cantidadFisica === '') {
            toast.error('Ingresa la cantidad física');
            return;
        }

        const cantidad = parseFloat(cantidadFisica);
        if (isNaN(cantidad) || cantidad < 0) {
            toast.error('La cantidad debe ser un número válido');
            return;
        }

        setRegistrando(true);
        try {
            const res = await conteosCiclicosService.registrarConteo(conteo.id, {
                articulo_id: articuloSeleccionado.id,
                cantidad_fisica: cantidad,
                observaciones: observaciones || null
            });

            const diff = cantidad - parseFloat(articuloSeleccionado.stock_actual);
            if (diff === 0) {
                toast.success('✅ Cantidad coincide');
            } else if (diff > 0) {
                toast(`Sobrante: +${diff}`, { icon: '📦' });
            } else {
                toast(`Faltante: ${diff}`, { icon: '⚠️' });
            }

            if (res.data?.sesion?.completado) {
                toast.success('🎉 ¡Checklist del día completado!', { duration: 5000 });
            }

            setConteo(prev => ({
                ...prev,
                articulos_contados: res.data.sesion.articulos_contados,
                estado: res.data.sesion.estado
            }));

            setArticuloSeleccionado(null);
            setCantidadFisica('');
            setObservaciones('');
            cargarPendientes(conteo.id, busqueda);
            setTimeout(() => searchInputRef.current?.focus(), 100);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al registrar conteo');
        } finally {
            setRegistrando(false);
        }
    };

    const handleAdelantarConteo = async () => {
        setAdelantando(true);
        try {
            const res = await conteosCiclicosService.adelantarConteo();
            toast.success(res.message || 'Conteo adelantado exitosamente');
            // Recargar para mostrar el nuevo conteo
            await cargarConteoHoy();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al adelantar conteo');
        } finally {
            setAdelantando(false);
        }
    };

    const progreso = conteo
        ? Math.round((conteo.articulos_contados / conteo.total_asignados) * 100) || 0
        : 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
            </div>
        );
    }

    if (!conteo) {
        return <div className="text-center py-20 text-gray-500">No se pudo cargar el conteo del día.</div>;
    }

    const completado = conteo.estado === 'completado';

    return (
        <div className="space-y-4">
            {/* Progreso */}
            <div className={`rounded-xl shadow-sm border p-5 ${completado ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Calendar size={18} className="text-gray-500" />
                            {conteo.nombre}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            {completado ? (
                                <span className="text-green-600 font-medium flex items-center gap-1">
                                    <CheckCircle2 size={14} /> Checklist completado
                                    {conteo.secuencia > 1 && <span className="text-green-500 text-xs ml-1">(Conteo #{conteo.secuencia} del día)</span>}
                                </span>
                            ) : (
                                <>
                                    {conteo.articulos_contados} de {conteo.total_asignados} artículos contados
                                    {conteo.secuencia > 1 && <span className="text-gray-400 text-xs ml-1">(Conteo #{conteo.secuencia} del día)</span>}
                                </>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`text-2xl font-bold ${completado ? 'text-green-600' : 'text-red-600'}`}>
                            {progreso}%
                        </span>
                        <button
                            onClick={cargarConteoHoy}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                            title="Recargar"
                        >
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                        className={`h-3 rounded-full transition-all duration-500 ${completado ? 'bg-gradient-to-r from-green-400 to-green-500' : 'bg-gradient-to-r from-red-500 to-red-600'
                            }`}
                        style={{ width: `${progreso}%` }}
                    ></div>
                </div>
            </div>

            {/* Completado → mostrar opción de adelantar */}
            {completado ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                    <CheckCircle2 size={48} className="mx-auto mb-3 text-green-500" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">¡Buen trabajo!</h3>
                    <p className="text-gray-500">Has completado el conteo de los {conteo.total_asignados} artículos{conteo.secuencia > 1 ? ` (conteo #${conteo.secuencia})` : ' del día'}.</p>
                    <p className="text-sm text-gray-400 mt-2 mb-5">Mañana se asignarán nuevos artículos automáticamente.</p>

                    {/* Botón de adelantar conteo */}
                    <div className="border-t border-gray-100 pt-5">
                        <p className="text-sm text-gray-500 mb-3">¿Quieres seguir contando? Genera un conteo extra con artículos nuevos.</p>
                        <button
                            onClick={handleAdelantarConteo}
                            disabled={adelantando}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                            {adelantando ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    Generando conteo...
                                </>
                            ) : (
                                <>
                                    <FastForward size={20} />
                                    Adelantar: Generar Nuevo Conteo
                                </>
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Panel de registro */}
                    {articuloSeleccionado && (
                        <div className="bg-white rounded-xl shadow-sm border-2 border-red-200 p-5">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    {articuloSeleccionado.imagen_url ? (
                                        <img src={articuloSeleccionado.imagen_url} alt="" className="w-14 h-14 object-cover rounded-lg border" />
                                    ) : (
                                        <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center">
                                            <Package size={24} className="text-gray-400" />
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{articuloSeleccionado.nombre}</h3>
                                        <p className="text-sm text-gray-500">{articuloSeleccionado.codigo_ean13}</p>
                                        <p className="text-xs text-gray-400">
                                            Stock sistema: <span className="font-medium text-gray-700">{parseFloat(articuloSeleccionado.stock_actual)} {articuloSeleccionado.unidad}</span>
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setArticuloSeleccionado(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                                    <X size={20} className="text-gray-400" />
                                </button>
                            </div>

                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad Física</label>
                                    <input
                                        ref={cantidadInputRef}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={cantidadFisica}
                                        onChange={e => setCantidadFisica(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && registrarConteo()}
                                        placeholder="0"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-lg font-semibold"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                                    <input
                                        type="text"
                                        value={observaciones}
                                        onChange={e => setObservaciones(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && registrarConteo()}
                                        placeholder="Notas..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={registrarConteo}
                                disabled={registrando || cantidadFisica === ''}
                                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                                {registrando ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Registrando...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={20} />
                                        Confirmar Conteo
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Buscador */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            placeholder="Buscar artículo por nombre, código o SKU..."
                            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        />
                        {busqueda && (
                            <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X size={18} />
                            </button>
                        )}
                    </div>

                    {/* Lista de artículos */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
                        {loadingPendientes ? (
                            <div className="p-8 text-center text-gray-500">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600 mx-auto mb-2"></div>
                                Cargando artículos...
                            </div>
                        ) : pendientes.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <Package size={40} className="mx-auto mb-2 text-gray-300" />
                                <p className="font-medium">{busqueda ? 'No se encontraron artículos' : 'No hay artículos pendientes'}</p>
                            </div>
                        ) : (
                            pendientes.map(articulo => (
                                <div
                                    key={articulo.id}
                                    onClick={() => seleccionarArticulo(articulo)}
                                    className={`flex items-center gap-3 px-4 py-3 hover:bg-red-50 cursor-pointer transition-colors ${articuloSeleccionado?.id === articulo.id ? 'bg-red-50 border-l-4 border-l-red-500' : ''
                                        }`}
                                >
                                    {articulo.imagen_url ? (
                                        <img src={articulo.imagen_url} alt="" className="w-10 h-10 object-cover rounded-lg border flex-shrink-0" />
                                    ) : (
                                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <Package size={18} className="text-gray-400" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 truncate">{articulo.nombre}</p>
                                        <p className="text-xs text-gray-500 flex items-center gap-2">
                                            <span>{articulo.codigo_ean13}</span>
                                            {articulo.ubicacion && <span>• {articulo.ubicacion.codigo}</span>}
                                        </p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-semibold text-gray-700">{parseFloat(articulo.stock_actual)}</p>
                                        <p className="text-xs text-gray-400">{articulo.unidad}</p>
                                    </div>
                                    <ArrowRight size={16} className="text-gray-300 flex-shrink-0" />
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

// ============ TAB REPORTES ============
const TabReportes = () => {
    const [reportes, setReportes] = useState([]);
    const [estadisticas, setEstadisticas] = useState(null);
    const [pagination, setPagination] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandido, setExpandido] = useState(null);
    const [resumen, setResumen] = useState(null);
    const [loadingResumen, setLoadingResumen] = useState(false);

    // Filtros de fecha
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');

    useEffect(() => {
        cargarReportes();
    }, []);

    const cargarReportes = async (page = 1) => {
        setLoading(true);
        try {
            const res = await conteosCiclicosService.getReportes({ desde, hasta, page });
            setReportes(res.data || []);
            setEstadisticas(res.estadisticas_globales);
            setPagination(res.pagination);
        } catch (error) {
            toast.error('Error al cargar reportes');
        } finally {
            setLoading(false);
        }
    };

    const aplicarFiltros = () => {
        cargarReportes(1);
    };

    const toggleResumen = async (conteoId) => {
        if (expandido === conteoId) {
            setExpandido(null);
            setResumen(null);
            return;
        }
        setExpandido(conteoId);
        setLoadingResumen(true);
        try {
            const res = await conteosCiclicosService.getResumen(conteoId);
            setResumen(res.data);
        } catch (error) {
            toast.error('Error al cargar detalle');
        } finally {
            setLoadingResumen(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Estadísticas globales */}
            {estadisticas && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                        <p className="text-2xl font-bold text-gray-900">{estadisticas.total_dias}</p>
                        <p className="text-xs text-gray-500 mt-1">Días con conteo</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                        <p className="text-2xl font-bold text-blue-600">{estadisticas.total_articulos_contados}</p>
                        <p className="text-xs text-gray-500 mt-1">Artículos contados</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                        <p className="text-2xl font-bold text-yellow-600">{estadisticas.total_con_diferencia}</p>
                        <p className="text-xs text-gray-500 mt-1">Con diferencia</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                            <TrendingUp size={18} className="text-green-600" />
                            <p className="text-2xl font-bold text-green-600">{estadisticas.porcentaje_exactitud}%</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Exactitud</p>
                    </div>
                </div>
            )}

            {/* Filtros de fecha */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
                        <input
                            type="date"
                            value={desde}
                            onChange={e => setDesde(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
                        <input
                            type="date"
                            value={hasta}
                            onChange={e => setHasta(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                        />
                    </div>
                    <button
                        onClick={aplicarFiltros}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                    >
                        Filtrar
                    </button>
                    {(desde || hasta) && (
                        <button
                            onClick={() => { setDesde(''); setHasta(''); setTimeout(() => cargarReportes(1), 100); }}
                            className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm"
                        >
                            Limpiar
                        </button>
                    )}
                </div>
            </div>

            {/* Lista de días */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
                {reportes.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <Calendar size={40} className="mx-auto mb-2 text-gray-300" />
                        <p className="font-medium">No hay conteos registrados</p>
                    </div>
                ) : (
                    reportes.map(conteo => (
                        <div key={conteo.id}>
                            <div
                                className="px-4 py-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                                onClick={() => toggleResumen(conteo.id)}
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-gray-900">{conteo.nombre}</p>
                                        {conteo.estado === 'completado' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                                <CheckCircle2 size={12} /> Completado
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                                                Pendiente
                                            </span>
                                        )}
                                        {conteo.secuencia > 1 && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                                <FastForward size={10} /> #{conteo.secuencia}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                        <span>{conteo.articulos_contados} / {conteo.total_asignados} contados</span>
                                        {conteo.stats?.faltantes > 0 && (
                                            <span className="text-red-600">{conteo.stats.faltantes} faltantes</span>
                                        )}
                                        {conteo.stats?.sobrantes > 0 && (
                                            <span className="text-yellow-600">{conteo.stats.sobrantes} sobrantes</span>
                                        )}
                                        {conteo.stats?.exactos > 0 && (
                                            <span className="text-green-600">{conteo.stats.exactos} exactos</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">{conteo.fecha}</span>
                                    {expandido === conteo.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                            </div>

                            {/* Detalle expandido */}
                            {expandido === conteo.id && (
                                <div className="px-4 pb-4">
                                    {loadingResumen ? (
                                        <div className="py-4 text-center text-gray-500">Cargando detalle...</div>
                                    ) : resumen ? (
                                        <ResumenDetalle resumen={resumen} />
                                    ) : null}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Paginación */}
            {pagination && pagination.totalPages > 1 && (
                <div className="flex justify-center gap-2">
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(page => (
                        <button
                            key={page}
                            onClick={() => cargarReportes(page)}
                            className={`px-3 py-1 rounded text-sm ${page === pagination.page
                                ? 'bg-red-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {page}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ============ RESUMEN DETALLE ============
const ResumenDetalle = ({ resumen }) => {
    const { estadisticas, articulos } = resumen;

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-blue-700">{estadisticas.total_contados}</p>
                    <p className="text-xs text-blue-600">Total</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-green-700">{estadisticas.exacto}</p>
                    <p className="text-xs text-green-600">Exactos</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-yellow-700">{estadisticas.sobrante}</p>
                    <p className="text-xs text-yellow-600">Sobrantes</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-red-700">{estadisticas.faltante}</p>
                    <p className="text-xs text-red-600">Faltantes</p>
                </div>
            </div>

            {estadisticas.con_diferencia > 0 && (
                <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                        <AlertTriangle size={14} className="text-yellow-500" />
                        Artículos con Diferencia
                    </h4>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="text-left px-3 py-2 font-medium text-gray-600">Artículo</th>
                                    <th className="text-right px-3 py-2 font-medium text-gray-600">Sistema</th>
                                    <th className="text-right px-3 py-2 font-medium text-gray-600">Físico</th>
                                    <th className="text-right px-3 py-2 font-medium text-gray-600">Dif.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {articulos
                                    .filter(a => parseFloat(a.diferencia) !== 0)
                                    .sort((a, b) => Math.abs(parseFloat(b.diferencia)) - Math.abs(parseFloat(a.diferencia)))
                                    .map(item => (
                                        <tr key={item.id} className="hover:bg-gray-50">
                                            <td className="px-3 py-2">
                                                <p className="font-medium text-gray-800 truncate max-w-[200px]">
                                                    {item.articulo?.nombre || `ID: ${item.articulo_id}`}
                                                </p>
                                            </td>
                                            <td className="text-right px-3 py-2 text-gray-600">{parseFloat(item.cantidad_sistema)}</td>
                                            <td className="text-right px-3 py-2 text-gray-600">{parseFloat(item.cantidad_fisica)}</td>
                                            <td className={`text-right px-3 py-2 font-semibold ${parseFloat(item.diferencia) > 0 ? 'text-yellow-600' : 'text-red-600'
                                                }`}>
                                                {parseFloat(item.diferencia) > 0 ? '+' : ''}{parseFloat(item.diferencia)}
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {estadisticas.con_diferencia === 0 && estadisticas.total_contados > 0 && (
                <div className="text-center py-2 text-green-600 font-medium flex items-center justify-center gap-2">
                    <CheckCircle2 size={16} />
                    Todo coincide perfectamente
                </div>
            )}
        </div>
    );
};

export default ConteoCiclicoPage;
