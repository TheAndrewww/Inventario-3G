import React, { useState, useEffect, useRef } from 'react';
import { Layers, Search, Package, ArrowLeft, X, Plus, Minus, Edit2, Trash2, CheckCircle2, AlertTriangle, Ruler, CircleDot } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const API = '/rollos-membrana';

const estadoConfig = {
    disponible: { label: 'Disponible', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    en_uso: { label: 'En uso', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
    agotado: { label: 'Agotado', bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
};

const RollosMembranasPage = () => {
    // Estado de navegación
    const [vista, setVista] = useState('articulos'); // 'articulos' | 'rollos'
    const [articuloSeleccionado, setArticuloSeleccionado] = useState(null);

    // Lista de artículos
    const [articulos, setArticulos] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [loading, setLoading] = useState(true);

    // Lista de rollos
    const [rollos, setRollos] = useState([]);
    const [loadingRollos, setLoadingRollos] = useState(false);
    const [filtroEstado, setFiltroEstado] = useState('');

    // Modal: crear/editar rollo
    const [modalRollo, setModalRollo] = useState(null); // null, 'crear', o el rollo a editar
    const [formRollo, setFormRollo] = useState({ identificador: '', metraje_total: '', color: '', observaciones: '' });
    const [guardando, setGuardando] = useState(false);

    // Modal: descontar metraje
    const [rolloDescuento, setRolloDescuento] = useState(null);
    const [cantidadDescuento, setCantidadDescuento] = useState('');
    const [obsDescuento, setObsDescuento] = useState('');
    const [descontando, setDescontando] = useState(false);

    const cantidadRef = useRef(null);
    const idRef = useRef(null);

    // === CARGAR ARTÍCULOS ===
    useEffect(() => {
        cargarArticulos();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            cargarArticulos(busqueda);
        }, 300);
        return () => clearTimeout(timer);
    }, [busqueda]);

    const cargarArticulos = async (search = '') => {
        setLoading(true);
        try {
            const params = search ? `?search=${encodeURIComponent(search)}` : '';
            const res = await api.get(`${API}/articulos${params}`);
            setArticulos(res.data.data || []);
        } catch (error) {
            toast.error('Error al cargar artículos de membrana');
        } finally {
            setLoading(false);
        }
    };

    // === SELECCIONAR ARTÍCULO → VER ROLLOS ===
    const seleccionarArticulo = (articulo) => {
        setArticuloSeleccionado(articulo);
        setVista('rollos');
        setFiltroEstado('');
        cargarRollos(articulo.id);
    };

    const volverAArticulos = () => {
        setVista('articulos');
        setArticuloSeleccionado(null);
        setRollos([]);
        setModalRollo(null);
        setRolloDescuento(null);
        cargarArticulos(busqueda);
    };

    // === CARGAR ROLLOS ===
    const cargarRollos = async (articuloId, estado = '') => {
        setLoadingRollos(true);
        try {
            const params = estado ? `?estado=${estado}` : '';
            const res = await api.get(`${API}/${articuloId}/rollos${params}`);
            setRollos(res.data.data?.rollos || []);
            if (res.data.data?.articulo) {
                setArticuloSeleccionado(prev => ({ ...prev, ...res.data.data.articulo }));
            }
        } catch (error) {
            toast.error('Error al cargar rollos');
        } finally {
            setLoadingRollos(false);
        }
    };

    useEffect(() => {
        if (vista === 'rollos' && articuloSeleccionado) {
            cargarRollos(articuloSeleccionado.id, filtroEstado);
        }
    }, [filtroEstado]);

    // === CREAR / EDITAR ROLLO ===
    const abrirCrearRollo = () => {
        setModalRollo('crear');
        setFormRollo({ identificador: '', metraje_total: '', color: '', observaciones: '' });
        setTimeout(() => idRef.current?.focus(), 100);
    };

    const abrirEditarRollo = (rollo) => {
        setModalRollo(rollo);
        setFormRollo({
            identificador: rollo.identificador,
            metraje_total: rollo.metraje_total,
            color: rollo.color || '',
            observaciones: rollo.observaciones || ''
        });
    };

    const guardarRollo = async () => {
        if (!formRollo.identificador?.trim()) {
            toast.error('El identificador es obligatorio');
            return;
        }
        if (modalRollo === 'crear' && (!formRollo.metraje_total || parseFloat(formRollo.metraje_total) <= 0)) {
            toast.error('El metraje debe ser mayor a 0');
            return;
        }

        setGuardando(true);
        try {
            if (modalRollo === 'crear') {
                await api.post(`${API}/${articuloSeleccionado.id}/rollos`, {
                    identificador: formRollo.identificador.trim(),
                    metraje_total: parseFloat(formRollo.metraje_total),
                    color: formRollo.color?.trim() || null,
                    observaciones: formRollo.observaciones?.trim() || null
                });
                toast.success(`Rollo "${formRollo.identificador}" creado`);
            } else {
                await api.put(`${API}/rollos/${modalRollo.id}`, {
                    identificador: formRollo.identificador.trim(),
                    color: formRollo.color?.trim() || null,
                    observaciones: formRollo.observaciones?.trim() || null
                });
                toast.success('Rollo actualizado');
            }
            setModalRollo(null);
            cargarRollos(articuloSeleccionado.id, filtroEstado);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al guardar');
        } finally {
            setGuardando(false);
        }
    };

    // === ELIMINAR ROLLO ===
    const eliminarRollo = async (rollo) => {
        if (!window.confirm(`¿Eliminar rollo "${rollo.identificador}"?`)) return;
        try {
            await api.delete(`${API}/rollos/${rollo.id}`);
            toast.success(`Rollo "${rollo.identificador}" eliminado`);
            cargarRollos(articuloSeleccionado.id, filtroEstado);
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    // === DESCONTAR METRAJE ===
    const abrirDescuento = (rollo) => {
        setRolloDescuento(rollo);
        setCantidadDescuento('');
        setObsDescuento('');
        setTimeout(() => cantidadRef.current?.focus(), 100);
    };

    const confirmarDescuento = async () => {
        const amount = parseFloat(cantidadDescuento);
        if (!amount || amount <= 0) {
            toast.error('Ingresa una cantidad válida');
            return;
        }
        if (amount > parseFloat(rolloDescuento.metraje_restante)) {
            toast.error(`Metraje insuficiente. Disponible: ${parseFloat(rolloDescuento.metraje_restante)}m`);
            return;
        }

        setDescontando(true);
        try {
            await api.post(`${API}/rollos/${rolloDescuento.id}/descontar`, {
                cantidad: amount,
                observaciones: obsDescuento || null
            });
            toast.success(`-${amount}m descontados de "${rolloDescuento.identificador}"`);
            setRolloDescuento(null);
            cargarRollos(articuloSeleccionado.id, filtroEstado);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al descontar');
        } finally {
            setDescontando(false);
        }
    };

    // === HELPERS ===
    const porcentajeRestante = (rollo) => {
        const total = parseFloat(rollo.metraje_total);
        const restante = parseFloat(rollo.metraje_restante);
        return total > 0 ? Math.round((restante / total) * 100) : 0;
    };

    const barColor = (pct) => {
        if (pct > 50) return 'bg-emerald-500';
        if (pct > 20) return 'bg-amber-500';
        return 'bg-red-500';
    };

    // === RENDER ===
    if (loading && vista === 'articulos') {
        return (
            <div className="flex items-center justify-center h-full min-h-[60vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
                {vista === 'rollos' && (
                    <button
                        onClick={volverAArticulos}
                        className="p-2 -ml-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                        <ArrowLeft size={22} />
                    </button>
                )}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
                        <Layers className="text-purple-600" size={22} />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold text-gray-900 truncate">
                            {vista === 'rollos' ? articuloSeleccionado?.nombre : 'Rollos de Membrana'}
                        </h1>
                        <p className="text-xs text-gray-500">
                            {vista === 'rollos'
                                ? `${rollos.length} rollo${rollos.length !== 1 ? 's' : ''} registrado${rollos.length !== 1 ? 's' : ''}`
                                : 'Almacén de Membranas'
                            }
                        </p>
                    </div>
                </div>
                {vista === 'rollos' && (
                    <button
                        onClick={abrirCrearRollo}
                        className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium active:scale-[0.97] flex-shrink-0"
                    >
                        <Plus size={16} />
                        <span className="hidden sm:inline">Nuevo Rollo</span>
                    </button>
                )}
            </div>

            {/* ===== VISTA: ARTÍCULOS DE MEMBRANA ===== */}
            {vista === 'articulos' && (
                <>
                    {/* Buscador */}
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            placeholder="Buscar membrana o malla..."
                            className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                        />
                        {busqueda && (
                            <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* Lista de artículos */}
                    <div className="space-y-2">
                        {articulos.length === 0 ? (
                            <div className="text-center py-16 text-gray-500">
                                <Layers size={48} className="mx-auto mb-3 text-gray-300" />
                                <p className="font-medium">{busqueda ? 'Sin resultados' : 'No hay artículos en el almacén de Membranas'}</p>
                                <p className="text-xs text-gray-400 mt-1">Verifica que existan artículos con ubicación en almacén "Membranas"</p>
                            </div>
                        ) : (
                            articulos.map(art => {
                                const stats = art.rollos_stats || {};
                                return (
                                    <button
                                        key={art.id}
                                        onClick={() => seleccionarArticulo(art)}
                                        className="w-full flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all text-left active:scale-[0.98]"
                                    >
                                        {art.imagen_url ? (
                                            <img src={art.imagen_url} alt="" className="w-12 h-12 object-cover rounded-lg border flex-shrink-0" />
                                        ) : (
                                            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <Package size={20} className="text-purple-400" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-900 text-sm truncate">{art.nombre}</p>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <CircleDot size={10} className="text-purple-400" />
                                                    {stats.total_rollos || 0} rollo{stats.total_rollos !== 1 ? 's' : ''}
                                                </span>
                                                {stats.metraje_total_disponible > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <Ruler size={10} className="text-gray-400" />
                                                        {stats.metraje_total_disponible.toFixed(1)}m disp.
                                                    </span>
                                                )}
                                            </div>
                                            {stats.total_rollos > 0 && (
                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                    {stats.rollos_disponibles > 0 && (
                                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-medium">
                                                            {stats.rollos_disponibles} disp
                                                        </span>
                                                    )}
                                                    {stats.rollos_en_uso > 0 && (
                                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-medium">
                                                            {stats.rollos_en_uso} en uso
                                                        </span>
                                                    )}
                                                    {stats.rollos_agotados > 0 && (
                                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-50 text-red-700 rounded text-[10px] font-medium">
                                                            {stats.rollos_agotados} agotado{stats.rollos_agotados !== 1 ? 's' : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <ArrowLeft size={18} className="text-gray-300 rotate-180 flex-shrink-0" />
                                    </button>
                                );
                            })
                        )}
                    </div>
                </>
            )}

            {/* ===== VISTA: ROLLOS DE UN ARTÍCULO ===== */}
            {vista === 'rollos' && (
                <>
                    {/* === Modal crear/editar rollo === */}
                    {modalRollo && (
                        <div className="bg-white rounded-xl shadow-lg border-2 border-purple-200 p-4 mb-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-gray-900">
                                    {modalRollo === 'crear' ? 'Nuevo Rollo' : `Editar: ${modalRollo.identificador}`}
                                </h3>
                                <button onClick={() => setModalRollo(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                                    <X size={18} className="text-gray-400" />
                                </button>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Identificador *</label>
                                    <input
                                        ref={idRef}
                                        type="text"
                                        value={formRollo.identificador}
                                        onChange={e => setFormRollo({ ...formRollo, identificador: e.target.value })}
                                        placeholder="Ej: R-001, MALLA-HDPE-001"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                                    />
                                </div>
                                {modalRollo === 'crear' && (
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Metraje total (metros) *</label>
                                        <input
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            value={formRollo.metraje_total}
                                            onChange={e => setFormRollo({ ...formRollo, metraje_total: e.target.value })}
                                            placeholder="Ej: 100"
                                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-xl font-bold text-center"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
                                    <input
                                        type="text"
                                        value={formRollo.color}
                                        onChange={e => setFormRollo({ ...formRollo, color: e.target.value })}
                                        placeholder="Ej: Negro, Blanco, Verde"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones</label>
                                    <input
                                        type="text"
                                        value={formRollo.observaciones}
                                        onChange={e => setFormRollo({ ...formRollo, observaciones: e.target.value })}
                                        placeholder="Notas adicionales..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                                    />
                                </div>
                                <button
                                    onClick={guardarRollo}
                                    disabled={guardando}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 font-medium active:scale-[0.98]"
                                >
                                    {guardando ? (
                                        <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Guardando...</>
                                    ) : (
                                        <><CheckCircle2 size={18} /> {modalRollo === 'crear' ? 'Crear Rollo' : 'Guardar Cambios'}</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* === Modal descontar metraje === */}
                    {rolloDescuento && (
                        <div className="bg-white rounded-xl shadow-lg border-2 border-orange-200 p-4 mb-4">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="font-semibold text-gray-900">Descontar metraje</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Rollo: <span className="font-medium text-gray-700">{rolloDescuento.identificador}</span>
                                        {' · '}Disponible: <span className="font-bold text-gray-800">{parseFloat(rolloDescuento.metraje_restante)}m</span>
                                    </p>
                                </div>
                                <button onClick={() => setRolloDescuento(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                                    <X size={18} className="text-gray-400" />
                                </button>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Metros a descontar</label>
                                    <input
                                        ref={cantidadRef}
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        max={parseFloat(rolloDescuento.metraje_restante)}
                                        value={cantidadDescuento}
                                        onChange={e => setCantidadDescuento(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && confirmarDescuento()}
                                        placeholder="0"
                                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-xl font-bold text-center"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Motivo / Observaciones</label>
                                    <input
                                        type="text"
                                        value={obsDescuento}
                                        onChange={e => setObsDescuento(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && confirmarDescuento()}
                                        placeholder="Ej: Corte para proyecto..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                                    />
                                </div>

                                {cantidadDescuento && parseFloat(cantidadDescuento) > 0 && (
                                    <div className={`flex items-center gap-2 p-2 rounded-lg text-sm ${parseFloat(cantidadDescuento) > parseFloat(rolloDescuento.metraje_restante)
                                        ? 'bg-red-50 text-red-700'
                                        : 'bg-orange-50 text-orange-700'
                                        }`}>
                                        {parseFloat(cantidadDescuento) > parseFloat(rolloDescuento.metraje_restante) ? (
                                            <><AlertTriangle size={14} /> Excede el metraje disponible</>
                                        ) : (
                                            <>
                                                <Minus size={14} />
                                                Metraje resultante: <span className="font-bold">{(parseFloat(rolloDescuento.metraje_restante) - parseFloat(cantidadDescuento)).toFixed(2)}</span> metros
                                            </>
                                        )}
                                    </div>
                                )}

                                <button
                                    onClick={confirmarDescuento}
                                    disabled={descontando || !cantidadDescuento || parseFloat(cantidadDescuento) <= 0 || parseFloat(cantidadDescuento) > parseFloat(rolloDescuento.metraje_restante)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium active:scale-[0.98]"
                                >
                                    {descontando ? (
                                        <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Descontando...</>
                                    ) : (
                                        <><Minus size={18} /> Confirmar Descuento</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Filtros de estado */}
                    <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
                        <button
                            onClick={() => setFiltroEstado('')}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${!filtroEstado ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            Todos
                        </button>
                        {Object.entries(estadoConfig).map(([key, cfg]) => (
                            <button
                                key={key}
                                onClick={() => setFiltroEstado(key)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filtroEstado === key ? 'bg-purple-600 text-white' : `${cfg.bg} ${cfg.text} hover:opacity-80`}`}
                            >
                                {cfg.label}
                            </button>
                        ))}
                    </div>

                    {/* Lista de rollos */}
                    {loadingRollos ? (
                        <div className="p-8 text-center text-gray-500">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto mb-2"></div>
                            Cargando rollos...
                        </div>
                    ) : rollos.length === 0 ? (
                        <div className="text-center py-16 text-gray-500">
                            <Layers size={48} className="mx-auto mb-3 text-gray-300" />
                            <p className="font-medium text-sm">{filtroEstado ? 'Sin rollos con ese estado' : 'No hay rollos registrados'}</p>
                            <p className="text-xs text-gray-400 mt-1">Usa el botón "Nuevo Rollo" para agregar uno</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {rollos.map(rollo => {
                                const pct = porcentajeRestante(rollo);
                                const cfg = estadoConfig[rollo.estado] || estadoConfig.disponible;
                                return (
                                    <div
                                        key={rollo.id}
                                        className={`bg-white rounded-xl shadow-sm border p-4 transition-all ${rolloDescuento?.id === rollo.id
                                            ? 'border-orange-300 bg-orange-50/30'
                                            : 'border-gray-200 hover:border-purple-200'
                                            }`}
                                    >
                                        {/* Row 1: info + acciones */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-gray-900 text-sm">{rollo.identificador}</span>
                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.bg} ${cfg.text}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
                                                        {cfg.label}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                                    {rollo.color && <span>🎨 {rollo.color}</span>}
                                                    <span>📅 {new Date(rollo.fecha_ingreso).toLocaleDateString('es-MX')}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                {rollo.estado !== 'agotado' && (
                                                    <button
                                                        onClick={() => abrirDescuento(rollo)}
                                                        className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                                                        title="Descontar metraje"
                                                    >
                                                        <Minus size={16} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => abrirEditarRollo(rollo)}
                                                    className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => eliminarRollo(rollo)}
                                                    className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Row 2: barra de metraje */}
                                        <div className="mt-2.5">
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="text-gray-500">
                                                    <span className="font-bold text-gray-800">{parseFloat(rollo.metraje_restante)}</span> / {parseFloat(rollo.metraje_total)} metros
                                                </span>
                                                <span className={`font-medium ${pct > 50 ? 'text-emerald-600' : pct > 20 ? 'text-amber-600' : 'text-red-600'}`}>
                                                    {pct}%
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${barColor(pct)}`}
                                                    style={{ width: `${pct}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* Row 3: observaciones */}
                                        {rollo.observaciones && (
                                            <p className="mt-2 text-xs text-gray-400 line-clamp-2">{rollo.observaciones}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default RollosMembranasPage;
