import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import reportesService from '../services/reportes.service';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import VistaStockBajoR2 from '../rediseno2/compras/VistaStockBajo';

const ESTADOS = {
    agotado: { texto: 'Agotado', badge: 'bg-red-100 text-red-800 border-red-200', barra: 'bg-red-500', dot: 'bg-red-500' },
    critico: { texto: 'Crítico', badge: 'bg-orange-100 text-orange-800 border-orange-200', barra: 'bg-orange-500 g3p-fondo-naranja', dot: 'bg-orange-500' },
    bajo: { texto: 'Bajo mínimo', badge: 'bg-yellow-100 text-yellow-800 border-yellow-200', barra: 'bg-yellow-500', dot: 'bg-yellow-500' }
};

const StockBajoPage = () => {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('todos');
    const [almacenActivo, setAlmacenActivo] = useState('todos');
    const [soloConMinimo, setSoloConMinimo] = useState(false);
    const [errorCargaR2, setErrorCargaR2] = useState(null); // Rediseño 2: el error de la carga, para pintarlo con «Reintentar»

    const cargar = async () => {
        try {
            setLoading(true);
            const res = await reportesService.stockBajo();
            setData(res);
            setErrorCargaR2(null);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Error al cargar el stock bajo');
            setErrorCargaR2(err.response?.data?.message || err.message || 'Error al cargar el stock bajo');
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

    return (
        <VistaStockBajoR2
            data={data}
            loading={loading}
            errorCarga={errorCargaR2}
            recargar={cargar}
            busqueda={busqueda}
            setBusqueda={setBusqueda}
            filtroEstado={filtroEstado}
            setFiltroEstado={setFiltroEstado}
            almacenActivo={almacenActivo}
            setAlmacenActivo={setAlmacenActivo}
            soloConMinimo={soloConMinimo}
            setSoloConMinimo={setSoloConMinimo}
            gruposBase={gruposBase}
            almacenesFiltrados={almacenesFiltrados}
            totales={totales}
            exportarCSV={exportarCSV}
        />
    );
};

export default StockBajoPage;
