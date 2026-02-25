import React, { useState, useEffect, useRef } from 'react';
import { Warehouse, Search, Package, Minus, ArrowLeft, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const API = '/descontar-almacen';

const DescontarAlmacenPage = () => {
    const [almacenes, setAlmacenes] = useState([]);
    const [almacenSeleccionado, setAlmacenSeleccionado] = useState(null);
    const [articulos, setArticulos] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingArticulos, setLoadingArticulos] = useState(false);

    // Modal de descuento
    const [articuloDescuento, setArticuloDescuento] = useState(null);
    const [cantidad, setCantidad] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [descontando, setDescontando] = useState(false);

    const cantidadRef = useRef(null);
    const searchRef = useRef(null);

    useEffect(() => {
        cargarAlmacenes();
    }, []);

    const cargarAlmacenes = async () => {
        setLoading(true);
        try {
            const res = await api.get(`${API}/almacenes`);
            setAlmacenes(res.data.data || []);
        } catch (error) {
            toast.error('Error al cargar almacenes');
        } finally {
            setLoading(false);
        }
    };

    const seleccionarAlmacen = (almacen) => {
        setAlmacenSeleccionado(almacen);
        setBusqueda('');
        cargarArticulos(almacen, '');
    };

    const cargarArticulos = async (almacen, search) => {
        setLoadingArticulos(true);
        try {
            const params = search ? `?search=${encodeURIComponent(search)}` : '';
            const res = await api.get(`${API}/${encodeURIComponent(almacen)}/articulos${params}`);
            setArticulos(res.data.data || []);
        } catch (error) {
            console.error('Error cargando artículos:', error);
        } finally {
            setLoadingArticulos(false);
        }
    };

    // Debounce búsqueda
    useEffect(() => {
        if (!almacenSeleccionado) return;
        const timer = setTimeout(() => {
            cargarArticulos(almacenSeleccionado, busqueda);
        }, 300);
        return () => clearTimeout(timer);
    }, [busqueda]);

    const abrirDescuento = (articulo) => {
        setArticuloDescuento(articulo);
        setCantidad('');
        setObservaciones('');
        setTimeout(() => cantidadRef.current?.focus(), 100);
    };

    const confirmarDescuento = async () => {
        if (!cantidad || parseFloat(cantidad) <= 0) {
            toast.error('Ingresa una cantidad válida');
            return;
        }

        const cantidadNum = parseFloat(cantidad);
        const stockDisponible = parseFloat(articuloDescuento.stock_actual);

        if (cantidadNum > stockDisponible) {
            toast.error(`Stock insuficiente. Disponible: ${stockDisponible}`);
            return;
        }

        setDescontando(true);
        try {
            const res = await api.post(`${API}/descontar`, {
                articulo_id: articuloDescuento.id,
                cantidad: cantidadNum,
                observaciones: observaciones || null
            });

            toast.success(`-${cantidadNum} ${articuloDescuento.unidad} descontados`, { icon: '✅' });

            // Actualizar artículo en la lista
            setArticulos(prev => prev.map(a => {
                if (a.id === articuloDescuento.id) {
                    const nuevoStock = parseFloat(a.stock_actual) - cantidadNum;
                    return { ...a, stock_actual: nuevoStock };
                }
                return a;
            }).filter(a => parseFloat(a.stock_actual) > 0));

            setArticuloDescuento(null);
            setCantidad('');
            setObservaciones('');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al descontar');
        } finally {
            setDescontando(false);
        }
    };

    const volverAAlmacenes = () => {
        setAlmacenSeleccionado(null);
        setArticulos([]);
        setBusqueda('');
        setArticuloDescuento(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[60vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
                {almacenSeleccionado && (
                    <button
                        onClick={volverAAlmacenes}
                        className="p-2 -ml-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                        <ArrowLeft size={22} />
                    </button>
                )}
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                        <Warehouse className="text-orange-600" size={22} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">
                            {almacenSeleccionado || 'Descuento por Almacén'}
                        </h1>
                        <p className="text-xs text-gray-500">
                            {almacenSeleccionado ? 'Selecciona un artículo para descontar' : 'Selecciona un almacén'}
                        </p>
                    </div>
                </div>
            </div>

            {/* ===== VISTA: SELECTOR DE ALMACÉN ===== */}
            {!almacenSeleccionado && (
                <div className="grid grid-cols-1 gap-3">
                    {almacenes.map((alm) => (
                        <button
                            key={alm.almacen}
                            onClick={() => seleccionarAlmacen(alm.almacen)}
                            className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all text-left active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                                    <Warehouse size={20} className="text-orange-500" />
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">{alm.almacen}</p>
                                    <p className="text-xs text-gray-500">{alm.total_articulos} artículos con stock</p>
                                </div>
                            </div>
                            <ArrowLeft size={18} className="text-gray-300 rotate-180" />
                        </button>
                    ))}

                    {almacenes.length === 0 && (
                        <div className="text-center py-16 text-gray-500">
                            <Warehouse size={48} className="mx-auto mb-3 text-gray-300" />
                            <p className="font-medium">No hay almacenes con artículos</p>
                        </div>
                    )}
                </div>
            )}

            {/* ===== VISTA: ARTÍCULOS DEL ALMACÉN ===== */}
            {almacenSeleccionado && (
                <>
                    {/* Modal de descuento */}
                    {articuloDescuento && (
                        <div className="bg-white rounded-xl shadow-lg border-2 border-orange-200 p-4 mb-4">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    {articuloDescuento.imagen_url ? (
                                        <img src={articuloDescuento.imagen_url} alt="" className="w-12 h-12 object-cover rounded-lg border flex-shrink-0" />
                                    ) : (
                                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <Package size={20} className="text-gray-400" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <h3 className="font-semibold text-gray-900 truncate">{articuloDescuento.nombre}</h3>
                                        <p className="text-xs text-gray-500">
                                            Disponible: <span className="font-bold text-gray-800">{parseFloat(articuloDescuento.stock_actual)} {articuloDescuento.unidad}</span>
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setArticuloDescuento(null)} className="p-1 hover:bg-gray-100 rounded-lg flex-shrink-0">
                                    <X size={18} className="text-gray-400" />
                                </button>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad a descontar</label>
                                    <input
                                        ref={cantidadRef}
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        max={parseFloat(articuloDescuento.stock_actual)}
                                        value={cantidad}
                                        onChange={e => setCantidad(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && confirmarDescuento()}
                                        placeholder="0"
                                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-xl font-bold text-center"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Motivo / Observaciones</label>
                                    <input
                                        type="text"
                                        value={observaciones}
                                        onChange={e => setObservaciones(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && confirmarDescuento()}
                                        placeholder="Ej: Salida a obra, uso interno..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                                    />
                                </div>

                                {cantidad && parseFloat(cantidad) > 0 && (
                                    <div className={`flex items-center gap-2 p-2 rounded-lg text-sm ${parseFloat(cantidad) > parseFloat(articuloDescuento.stock_actual)
                                            ? 'bg-red-50 text-red-700'
                                            : 'bg-orange-50 text-orange-700'
                                        }`}>
                                        {parseFloat(cantidad) > parseFloat(articuloDescuento.stock_actual) ? (
                                            <><AlertTriangle size={14} /> Excede el stock disponible</>
                                        ) : (
                                            <>
                                                <Minus size={14} />
                                                Stock resultante: <span className="font-bold">{(parseFloat(articuloDescuento.stock_actual) - parseFloat(cantidad)).toFixed(2)}</span> {articuloDescuento.unidad}
                                            </>
                                        )}
                                    </div>
                                )}

                                <button
                                    onClick={confirmarDescuento}
                                    disabled={descontando || !cantidad || parseFloat(cantidad) <= 0 || parseFloat(cantidad) > parseFloat(articuloDescuento.stock_actual)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium active:scale-[0.98]"
                                >
                                    {descontando ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            Descontando...
                                        </>
                                    ) : (
                                        <>
                                            <Minus size={18} />
                                            Confirmar Descuento
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Buscador */}
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            ref={searchRef}
                            type="text"
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            placeholder="Buscar artículo..."
                            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                        />
                        {busqueda && (
                            <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* Lista de artículos */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
                        {loadingArticulos ? (
                            <div className="p-8 text-center text-gray-500">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600 mx-auto mb-2"></div>
                                Cargando...
                            </div>
                        ) : articulos.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <Package size={36} className="mx-auto mb-2 text-gray-300" />
                                <p className="font-medium text-sm">{busqueda ? 'Sin resultados' : 'Sin artículos con stock'}</p>
                            </div>
                        ) : (
                            articulos.map(art => (
                                <div
                                    key={art.id}
                                    onClick={() => abrirDescuento(art)}
                                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors active:bg-orange-50 ${articuloDescuento?.id === art.id ? 'bg-orange-50 border-l-4 border-l-orange-500' : 'hover:bg-gray-50'
                                        }`}
                                >
                                    {art.imagen_url ? (
                                        <img src={art.imagen_url} alt="" className="w-10 h-10 object-cover rounded-lg border flex-shrink-0" />
                                    ) : (
                                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <Package size={16} className="text-gray-400" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 text-sm truncate">{art.nombre}</p>
                                        <p className="text-xs text-gray-500">
                                            {art.codigo_ean13}
                                            {art.ubicacion && <span> • {art.ubicacion.codigo}</span>}
                                        </p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-bold text-gray-800">{parseFloat(art.stock_actual)}</p>
                                        <p className="text-xs text-gray-400">{art.unidad}</p>
                                    </div>
                                    <Minus size={16} className="text-orange-400 flex-shrink-0" />
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default DescontarAlmacenPage;
