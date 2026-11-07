import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Factory, Hammer, PaintBucket } from 'lucide-react';
import toast from 'react-hot-toast';
import articulosService from '../services/articulos.service';
import camionetasService from '../services/camionetas.service';
import movimientosService from '../services/movimientos.service';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import VistaEntradasSalidas from '../rediseno2/tickets/VistaEntradasSalidas';

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
    // Rediseño 2: la vista nueva enseña el error de carga (el aviso flotante de siempre no cambia)
    const [errorCargaR2, setErrorCargaR2] = useState(null);

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
                setErrorCargaR2(error);
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

    return (
        <VistaEntradasSalidas s={{
            camionetas, cargando, errorCarga: errorCargaR2, AREAS, formatCantidad,
            destino, setDestino, operacion, setOperacion, seleccionados, busqueda, setBusqueda, guardando,
            inputBusquedaRef, handleEnterBusqueda, resultados, agregarArticulo, cambiarCantidad, fijarCantidad, quitar,
            totalPiezas, sinStock, confirmar,
        }} />
    );
};

export default EntradasSalidasPage;
