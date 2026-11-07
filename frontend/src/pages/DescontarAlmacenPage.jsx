import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import VistaDescontar from '../rediseno2/inventario/VistaDescontar';

const API = '/descontar-almacen';
const API_ROLLOS = '/rollos-membrana';

const DescontarAlmacenPage = () => {
    const [almacenes, setAlmacenes] = useState([]);
    const [almacenSeleccionado, setAlmacenSeleccionado] = useState(null);
    const [articulos, setArticulos] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingArticulos, setLoadingArticulos] = useState(false);

    // Modal de descuento normal
    const [articuloDescuento, setArticuloDescuento] = useState(null);
    const [cantidad, setCantidad] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [descontando, setDescontando] = useState(false);

    // === Rollos de membrana ===
    const [esMembranas, setEsMembranas] = useState(false);
    const [rollosArticulo, setRollosArticulo] = useState(null); // artículo seleccionado para ver rollos
    const [rollos, setRollos] = useState([]);
    const [loadingRollos, setLoadingRollos] = useState(false);
    const [rolloSeleccionado, setRolloSeleccionado] = useState(null);
    const [cantidadRollo, setCantidadRollo] = useState('');
    const [obsRollo, setObsRollo] = useState('');
    const [descontandoRollo, setDescontandoRollo] = useState(false);

    const cantidadRef = useRef(null);
    const cantidadRolloRef = useRef(null);
    const [errorCargaR2, setErrorCargaR2] = useState(null); // Rediseño 2: el error de carga para la vista nueva (avisos y consola de siempre)

    useEffect(() => {
        cargarAlmacenes();
    }, []);

    const cargarAlmacenes = async () => {
        setLoading(true);
        try {
            const res = await api.get(`${API}/almacenes`);
            setAlmacenes(res.data.data || []);
            setErrorCargaR2(null);
        } catch (error) {
            setErrorCargaR2({ de: 'almacenes', motivo: error?.response?.data?.message || error?.message || 'Error al cargar almacenes' });
            toast.error('Error al cargar almacenes');
        } finally {
            setLoading(false);
        }
    };

    const seleccionarAlmacen = (almacen) => {
        setAlmacenSeleccionado(almacen);
        setEsMembranas(almacen === 'Membranas');
        setBusqueda('');
        cargarArticulos(almacen, '');
    };

    const cargarArticulos = async (almacen, search) => {
        setLoadingArticulos(true);
        try {
            const params = search ? `?search=${encodeURIComponent(search)}` : '';
            const res = await api.get(`${API}/${encodeURIComponent(almacen)}/articulos${params}`);
            setArticulos(res.data.data || []);
            setErrorCargaR2(null);
        } catch (error) {
            setErrorCargaR2({ de: 'articulos', motivo: error?.response?.data?.message || error?.message || 'Error cargando artículos' });
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

    // === DESCUENTO NORMAL (no membranas) ===
    const abrirDescuento = (articulo) => {
        if (esMembranas) {
            abrirRollos(articulo);
            return;
        }
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

            toast.success(`-${cantidadNum} ${articuloDescuento.unidad} descontados`, undefined);

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

    // === ROLLOS DE MEMBRANA ===
    const abrirRollos = async (articulo) => {
        setRollosArticulo(articulo);
        setRolloSeleccionado(null);
        setCantidadRollo('');
        setObsRollo('');
        setLoadingRollos(true);
        try {
            const res = await api.get(`${API_ROLLOS}/${articulo.id}/rollos`);
            setRollos((res.data.data?.rollos || []).filter(r => r.estado !== 'agotado'));
        } catch (error) {
            toast.error('Error al cargar rollos');
            setRollos([]);
        } finally {
            setLoadingRollos(false);
        }
    };

    const seleccionarRollo = (rollo) => {
        setRolloSeleccionado(rollo);
        setCantidadRollo('');
        setObsRollo('');
        setTimeout(() => cantidadRolloRef.current?.focus(), 100);
    };

    const confirmarDescuentoRollo = async () => {
        const amount = parseFloat(cantidadRollo);
        if (!amount || amount <= 0) {
            toast.error('Ingresa una cantidad válida');
            return;
        }
        if (amount > parseFloat(rolloSeleccionado.metraje_restante)) {
            toast.error(`Metraje insuficiente. Disponible: ${parseFloat(rolloSeleccionado.metraje_restante)}m`);
            return;
        }

        setDescontandoRollo(true);
        try {
            await api.post(`${API_ROLLOS}/rollos/${rolloSeleccionado.id}/descontar`, {
                cantidad: amount,
                observaciones: obsRollo || null
            });

            toast.success(`-${amount}m de "${rolloSeleccionado.identificador}"`, undefined);

            // Refrescar rollos
            setRolloSeleccionado(null);
            setCantidadRollo('');
            setObsRollo('');
            abrirRollos(rollosArticulo);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al descontar');
        } finally {
            setDescontandoRollo(false);
        }
    };

    const cerrarRollos = () => {
        setRollosArticulo(null);
        setRollos([]);
        setRolloSeleccionado(null);
    };

    const volverAAlmacenes = () => {
        setAlmacenSeleccionado(null);
        setEsMembranas(false);
        setArticulos([]);
        setBusqueda('');
        setArticuloDescuento(null);
        cerrarRollos();
    };

    return (
        <VistaDescontar d={{
            almacenes, almacenSeleccionado, articulos, busqueda, setBusqueda, loading, loadingArticulos,
            articuloDescuento, setArticuloDescuento, cantidad, setCantidad, observaciones, setObservaciones, descontando,
            esMembranas, rollosArticulo, rollos, loadingRollos, rolloSeleccionado, setRolloSeleccionado, cantidadRollo, setCantidadRollo,
            obsRollo, setObsRollo, descontandoRollo, cantidadRef, cantidadRolloRef,
            seleccionarAlmacen, abrirDescuento, confirmarDescuento, seleccionarRollo, confirmarDescuentoRollo, cerrarRollos, volverAAlmacenes,
            errorCargaR2, cargarAlmacenes, cargarArticulos,
        }} />
    );
};

export default DescontarAlmacenPage;
