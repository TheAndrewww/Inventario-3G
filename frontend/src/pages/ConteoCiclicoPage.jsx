import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import conteosCiclicosService from '../services/conteosCiclicos.service';
import { VistaConteoCiclico, VistaConteoHoy, VistaReportesConteo } from '../rediseno2/inventario/VistaConteoCiclico';

const ConteoCiclicoPage = () => {
    const [tab, setTab] = useState('conteo'); // 'conteo' | 'reportes'
    return (
        <VistaConteoCiclico tab={tab} setTab={setTab}>
            {tab === 'conteo' && <TabConteo />}
            {tab === 'reportes' && <TabReportes />}
        </VistaConteoCiclico>
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
                toast.success('La cantidad coincide');
            } else if (diff > 0) {
                toast(`Sobrante: +${diff}`, undefined);
            } else {
                toast(`Faltante: ${diff}`, undefined);
            }

            if (res.data?.sesion?.completado) {
                toast.success('Terminaste la lista de conteo del día.', { duration: 5000 });
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

    return (
        <VistaConteoHoy c={{
            conteo, pendientes, busqueda, setBusqueda, loading, loadingPendientes, adelantando,
            articuloSeleccionado, setArticuloSeleccionado, cantidadFisica, setCantidadFisica, observaciones, setObservaciones, registrando,
            searchInputRef, cantidadInputRef, seleccionarArticulo, registrarConteo, handleAdelantarConteo, cargarConteoHoy, progreso,
        }} />
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
    const [errorCargaR2, setErrorCargaR2] = useState(null); // Rediseño 2: el error de carga para la vista nueva (el aviso de siempre no cambia)

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
            setErrorCargaR2(null);
        } catch (error) {
            setErrorCargaR2(error?.response?.data?.message || error?.message || 'Error al cargar reportes');
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

    return (
        <VistaReportesConteo r={{
            reportes, estadisticas, pagination, loading, expandido, resumen, loadingResumen, desde, setDesde, hasta, setHasta, errorCargaR2,
            cargarReportes, aplicarFiltros, toggleResumen,
            // «Limpiar» de siempre: borra las fechas y vuelve a cargar la primera página
            limpiarFechas: () => { setDesde(''); setHasta(''); setTimeout(() => cargarReportes(1), 100); },
        }} />
    );
};

export default ConteoCiclicoPage;
