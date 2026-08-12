import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Truck, Factory, Hammer, PaintBucket, ArrowUpFromLine, ArrowDownToLine, Search, X, Plus, Minus, Check, ScanLine } from 'lucide-react';
import toast from 'react-hot-toast';
import articulosService from '../services/articulos.service';
import camionetasService from '../services/camionetas.service';
import movimientosService from '../services/movimientos.service';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { getImageUrl } from '../utils/imageUtils';
import { Loader } from '../components/common';

// Áreas de planta que reciben material sin pasar por un ticket de diseño
const AREAS = [
    { valor: 'manufactura', nombre: 'Manufactura', icon: Factory, color: 'amber' },
    { valor: 'herreria', nombre: 'Herrería', icon: Hammer, color: 'red' },
    { valor: 'pintura', nombre: 'Pintura', icon: PaintBucket, color: 'blue' }
];

const formatCantidad = (n) => {
    const v = parseFloat(n) || 0;
    return Number.isInteger(v) ? v : parseFloat(v.toFixed(2));
};

const EntradasSalidasPage = () => {
    const [articulos, setArticulos] = useState([]);
    const [camionetas, setCamionetas] = useState([]);
    const [cargando, setCargando] = useState(true);

    const [destino, setDestino] = useState(null);       // { tipo: 'camioneta'|'area', id?, valor?, nombre }
    const [operacion, setOperacion] = useState('salida');
    const [seleccionados, setSeleccionados] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [guardando, setGuardando] = useState(false);

    const inputBusquedaRef = useRef(null);

    useEffect(() => {
        const cargar = async () => {
            try {
                setCargando(true);
                const [arts, cams] = await Promise.all([
                    articulosService.getAll(),
                    camionetasService.obtenerTodos().catch(() => ({ data: { camionetas: [] } }))
                ]);
                setArticulos((arts || []).filter(a => a.activo !== false && !a.es_herramienta));
                setCamionetas((cams?.data?.camionetas || []).filter(c => c.activo !== false));
            } catch (error) {
                console.error('Error al cargar datos:', error);
                toast.error('Error al cargar artículos');
            } finally {
                setCargando(false);
            }
        };
        cargar();
    }, []);

    // Agrega el artículo o le suma 1 si ya está en la lista
    const agregarArticulo = (articulo) => {
        setSeleccionados(prev => {
            const existente = prev.find(a => a.id === articulo.id);
            if (existente) {
                return prev.map(a => a.id === articulo.id ? { ...a, cantidad: a.cantidad + 1 } : a);
            }
            return [...prev, {
                id: articulo.id,
                nombre: articulo.nombre,
                unidad: articulo.unidad,
                imagen_url: articulo.imagen_url,
                stock_actual: parseFloat(articulo.stock_actual) || 0,
                cantidad: 1
            }];
        });
        setBusqueda('');
    };

    const buscarPorCodigo = (codigo) => (
        articulos.find(a => a.codigo_ean13 === codigo)
        || articulos.find(a => a.sku === codigo)
        || articulos.find(a => a.codigo_ean13?.includes(codigo))
    );

    // Pistola de códigos: busca por código y agrega sin tocar el teclado
    const handleEscaneo = (codigo) => {
        const encontrado = buscarPorCodigo(codigo);

        if (!encontrado) {
            toast.error(`Código no encontrado: ${codigo}`);
            return;
        }
        agregarArticulo(encontrado);
        toast.success(`${encontrado.nombre} +1`);
    };

    // El hook del escáner se desactiva cuando el foco está en un input, así que
    // el ENTER dentro del buscador también tiene que resolver el escaneo.
    const handleEnterBusqueda = (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();

        const texto = busqueda.trim();
        if (!texto) return;

        const porCodigo = buscarPorCodigo(texto);
        if (porCodigo) {
            agregarArticulo(porCodigo);
            toast.success(`${porCodigo.nombre} +1`);
            return;
        }

        if (resultados.length > 0) {
            agregarArticulo(resultados[0]);
            return;
        }

        toast.error(`No se encontró: ${texto}`);
    };

    useBarcodeScanner(handleEscaneo, { enabled: !cargando && !!destino });

    const resultados = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();
        if (texto.length < 2) return [];
        return articulos
            .filter(a =>
                a.nombre?.toLowerCase().includes(texto) ||
                a.sku?.toLowerCase().includes(texto) ||
                a.codigo_ean13?.includes(texto)
            )
            .slice(0, 8);
    }, [busqueda, articulos]);

    const cambiarCantidad = (id, delta) => {
        setSeleccionados(prev => prev.map(a => {
            if (a.id !== id) return a;
            const nueva = Math.max(0, parseFloat((a.cantidad + delta).toFixed(2)));
            return { ...a, cantidad: nueva };
        }).filter(a => a.cantidad > 0));
    };

    const fijarCantidad = (id, valor) => {
        setSeleccionados(prev => prev.map(a =>
            a.id === id ? { ...a, cantidad: valor === '' ? '' : parseFloat(valor) } : a
        ));
    };

    const quitar = (id) => setSeleccionados(prev => prev.filter(a => a.id !== id));

    const totalPiezas = seleccionados.reduce((s, a) => s + (parseFloat(a.cantidad) || 0), 0);

    // Solo en salidas importa el stock: no puede salir lo que no hay
    const sinStock = operacion === 'salida'
        ? seleccionados.filter(a => (parseFloat(a.cantidad) || 0) > a.stock_actual)
        : [];

    const confirmar = async () => {
        if (!destino) {
            toast.error('Elige el destino');
            return;
        }
        const validos = seleccionados.filter(a => (parseFloat(a.cantidad) || 0) > 0);
        if (validos.length === 0) {
            toast.error('Agrega al menos un artículo');
            return;
        }
        if (sinStock.length > 0) {
            toast.error(`Sin stock suficiente: ${sinStock[0].nombre}`);
            return;
        }

        try {
            setGuardando(true);
            const respuesta = await movimientosService.registrarRapido({
                operacion,
                destino_tipo: destino.tipo,
                camioneta_id: destino.tipo === 'camioneta' ? destino.id : undefined,
                destino_area: destino.tipo === 'area' ? destino.valor : undefined,
                articulos: validos.map(a => ({ articulo_id: a.id, cantidad: parseFloat(a.cantidad) }))
            });

            toast.success(respuesta.message || 'Movimiento registrado');

            // Refleja el nuevo stock sin recargar toda la página
            const signo = operacion === 'salida' ? -1 : 1;
            setArticulos(prev => prev.map(art => {
                const usado = validos.find(v => v.id === art.id);
                if (!usado) return art;
                return { ...art, stock_actual: (parseFloat(art.stock_actual) || 0) + signo * parseFloat(usado.cantidad) };
            }));

            // Se queda listo para el siguiente registro con el mismo destino
            setSeleccionados([]);
            setBusqueda('');
            inputBusquedaRef.current?.blur(); // devuelve el teclado a la pistola
        } catch (error) {
            console.error('Error al registrar:', error);
            toast.error(error.message || 'Error al registrar el movimiento');
        } finally {
            setGuardando(false);
        }
    };

    if (cargando) return <Loader fullScreen />;

    const esSalida = operacion === 'salida';

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto pb-32">
            <div className="mb-5">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Entradas y Salidas</h1>
                <p className="text-gray-600 text-sm mt-1">
                    Material que se lleva o regresa una camioneta o un área de planta. No genera ticket.
                </p>
            </div>

            {/* Paso 1: destino */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">1 · ¿A dónde va?</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {camionetas.map(cam => {
                        const activo = destino?.tipo === 'camioneta' && destino.id === cam.id;
                        return (
                            <button
                                key={`cam-${cam.id}`}
                                onClick={() => setDestino({ tipo: 'camioneta', id: cam.id, nombre: cam.nombre })}
                                className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-left transition-colors ${activo
                                    ? 'border-gray-900 bg-gray-900 text-white'
                                    : 'border-gray-200 hover:border-gray-400 text-gray-800'}`}
                            >
                                <Truck size={20} className="shrink-0" />
                                <span className="font-medium truncate">{cam.nombre}</span>
                            </button>
                        );
                    })}
                    {AREAS.map(area => {
                        const activo = destino?.tipo === 'area' && destino.valor === area.valor;
                        const Icono = area.icon;
                        return (
                            <button
                                key={area.valor}
                                onClick={() => setDestino({ tipo: 'area', valor: area.valor, nombre: area.nombre })}
                                className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-left transition-colors ${activo
                                    ? 'border-gray-900 bg-gray-900 text-white'
                                    : 'border-gray-200 hover:border-gray-400 text-gray-800'}`}
                            >
                                <Icono size={20} className="shrink-0" />
                                <span className="font-medium truncate">{area.nombre}</span>
                            </button>
                        );
                    })}
                </div>
                {camionetas.length === 0 && (
                    <p className="text-xs text-gray-400 mt-2">No hay camionetas registradas; usa las áreas.</p>
                )}
            </div>

            {/* Paso 2: entrada o salida */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">2 · ¿Sale o regresa?</p>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setOperacion('salida')}
                        className={`flex items-center justify-center gap-2 py-4 rounded-xl border-2 font-semibold transition-colors ${esSalida
                            ? 'border-red-600 bg-red-600 text-white'
                            : 'border-gray-200 text-gray-700 hover:border-red-300'}`}
                    >
                        <ArrowUpFromLine size={22} />
                        Salida
                    </button>
                    <button
                        onClick={() => setOperacion('entrada')}
                        className={`flex items-center justify-center gap-2 py-4 rounded-xl border-2 font-semibold transition-colors ${!esSalida
                            ? 'border-green-600 bg-green-600 text-white'
                            : 'border-gray-200 text-gray-700 hover:border-green-300'}`}
                    >
                        <ArrowDownToLine size={22} />
                        Entrada
                    </button>
                </div>
            </div>

            {/* Paso 3: artículos */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">3 · ¿Qué piezas?</p>
                    {destino && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                            <ScanLine size={14} /> Pistola activa
                        </span>
                    )}
                </div>

                <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        ref={inputBusquedaRef}
                        type="text"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        onKeyDown={handleEnterBusqueda}
                        placeholder="Escanea el código o busca por nombre / SKU..."
                        disabled={!destino}
                        className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                </div>

                {resultados.length > 0 && (
                    <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                        {resultados.map(art => (
                            <button
                                key={art.id}
                                onClick={() => agregarArticulo(art)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left"
                            >
                                {getImageUrl(art.imagen_url) ? (
                                    <img src={getImageUrl(art.imagen_url)} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
                                ) : (
                                    <div className="w-9 h-9 rounded bg-gray-100 flex items-center justify-center shrink-0">📦</div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-gray-900 truncate">{art.nombre}</p>
                                    <p className="text-xs text-gray-500">
                                        {art.sku ? `SKU ${art.sku} · ` : ''}Hay {formatCantidad(art.stock_actual)} {art.unidad}
                                    </p>
                                </div>
                                <Plus size={18} className="text-gray-400 shrink-0" />
                            </button>
                        ))}
                    </div>
                )}

                {/* Lista capturada */}
                {seleccionados.length > 0 && (
                    <div className="mt-4 space-y-2">
                        {seleccionados.map(art => {
                            const excede = esSalida && (parseFloat(art.cantidad) || 0) > art.stock_actual;
                            return (
                                <div
                                    key={art.id}
                                    className={`flex items-center gap-3 p-2.5 rounded-lg border ${excede ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-gray-900 truncate">{art.nombre}</p>
                                        <p className={`text-xs ${excede ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                            {excede
                                                ? `Solo hay ${formatCantidad(art.stock_actual)} ${art.unidad}`
                                                : `Hay ${formatCantidad(art.stock_actual)} ${art.unidad}`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => cambiarCantidad(art.id, -1)}
                                            className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                                        >
                                            <Minus size={16} />
                                        </button>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            value={art.cantidad}
                                            onChange={(e) => fijarCantidad(art.id, e.target.value)}
                                            className="w-16 text-center py-1.5 border border-gray-300 rounded-lg font-semibold"
                                        />
                                        <button
                                            onClick={() => cambiarCantidad(art.id, 1)}
                                            className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                                        >
                                            <Plus size={16} />
                                        </button>
                                        <button
                                            onClick={() => quitar(art.id)}
                                            className="w-9 h-9 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 flex items-center justify-center"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {seleccionados.length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-8">
                        {destino ? 'Escanea o busca las piezas' : 'Primero elige el destino'}
                    </p>
                )}
            </div>

            {/* Barra de confirmación */}
            {seleccionados.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
                    <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">
                                {esSalida ? 'Salida' : 'Entrada'} · {destino?.nombre}
                            </p>
                            <p className="text-sm text-gray-500">
                                {seleccionados.length} artículo(s) · {formatCantidad(totalPiezas)} pzas
                            </p>
                        </div>
                        <button
                            onClick={confirmar}
                            disabled={guardando || sinStock.length > 0}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold disabled:opacity-50 ${esSalida ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                        >
                            <Check size={20} />
                            {guardando ? 'Guardando...' : 'Confirmar'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EntradasSalidasPage;
