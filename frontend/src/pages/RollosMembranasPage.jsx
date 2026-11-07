import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { confirmarG3 } from '../diseno-3g/dialogosG3';
import VistaRollos from '../rediseno2/inventario/VistaRollos';

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
    const [errorCargaR2, setErrorCargaR2] = useState(null); // Rediseño 2: el error de carga para la vista nueva (el aviso de siempre no cambia)

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
            setErrorCargaR2(null);
        } catch (error) {
            setErrorCargaR2(error?.response?.data?.message || error?.message || 'Error al cargar artículos de membrana');
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
        // Vista previa con los datos del rollo que ya están en pantalla; la petición de después es la misma
        if (!(await confirmarG3({
            titulo: `¿Eliminar el rollo «${rollo.identificador}»?`,
            datos: [
                ['Artículo', articuloSeleccionado?.nombre || ''],
                ['Metraje', `${parseFloat(rollo.metraje_restante)} de ${parseFloat(rollo.metraje_total)} metros`],
                ['Estado', (estadoConfig[rollo.estado] || estadoConfig.disponible).label],
            ],
            pasa: ['El rollo deja de aparecer en la lista de este artículo.'],
            confirmar: 'Eliminar rollo', cancelar: 'No eliminar', peligro: true,
        }))) return;
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

    return (
        <VistaRollos r={{
            vista, articuloSeleccionado, articulos, busqueda, setBusqueda, loading, rollos, loadingRollos, filtroEstado, setFiltroEstado,
            modalRollo, setModalRollo, formRollo, setFormRollo, guardando, rolloDescuento, setRolloDescuento,
            cantidadDescuento, setCantidadDescuento, obsDescuento, setObsDescuento, descontando, cantidadRef, idRef,
            seleccionarArticulo, volverAArticulos, abrirCrearRollo, abrirEditarRollo, guardarRollo, eliminarRollo, abrirDescuento, confirmarDescuento,
            errorCargaR2, cargarArticulos,
        }} />
    );
};

export default RollosMembranasPage;
