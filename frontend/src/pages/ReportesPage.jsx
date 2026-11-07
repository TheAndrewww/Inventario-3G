import React, { useEffect, useMemo, useState } from 'react';
import reportesService from '../services/reportes.service';
import toast from 'react-hot-toast';
import { confirmarG3 } from '../diseno-3g/dialogosG3';
import VistaReportes from '../rediseno2/gestion/VistaReportes';
const formatNumber = (n) => (n || 0).toLocaleString('es-MX');

const ReportesPage = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dias, setDias] = useState(90);
    const [seleccion, setSeleccion] = useState(new Set());
    const [aplicando, setAplicando] = useState(false);
    const [filtroAccion, setFiltroAccion] = useState('todos');
    // Mín/máx escritos a mano en la tabla: id → { min, max } (texto del input)
    const [valores, setValores] = useState({});
    const [errorCargaR2, setErrorCargaR2] = useState(null); // Rediseño 2: el error de la carga, para pintarlo con «Reintentar»

    const cargar = async () => {
        try {
            setLoading(true);
            const res = await reportesService.inventarioConsumibles(dias);
            setData(res);
            setSeleccion(new Set());
            setValores({});
            setErrorCargaR2(null);
        } catch (err) {
            console.error(err);
            toast.error('Error al cargar el reporte');
            setErrorCargaR2(err.response?.data?.message || err.message || 'Error al cargar el reporte');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [dias]);

    const sugerenciasFiltradas = useMemo(() => {
        if (!data) return [];
        if (filtroAccion === 'todos') return data.sugerencias;
        return data.sugerencias.filter(s => s.sugerencia.accion === filtroAccion);
    }, [data, filtroAccion]);

    // Lo que se propone aplicar en cada fila: la sugerencia del reporte donde la
    // hay, si no el valor actual. El usuario lo puede sobrescribir en la tabla.
    const propuesta = (s) => {
        const acc = s.sugerencia.accion;
        const cambiaMin = acc === 'aumentar_min' || acc === 'reducir_min' || acc === 'sin_movimiento';
        const cambiaMax = acc === 'reducir_max' || acc === 'definir_max';
        const min = cambiaMin ? (acc === 'sin_movimiento' ? 0 : s.sugerencia.stock_min_sugerido) : s.stock_minimo;
        const max = cambiaMax ? s.sugerencia.stock_max_sugerido : s.stock_maximo;
        return {
            min: valores[s.id]?.min ?? String(min ?? 0),
            max: valores[s.id]?.max ?? (max === null || max === undefined ? '' : String(max))
        };
    };

    const editarValor = (id, campo, texto) => {
        setValores(prev => ({ ...prev, [id]: { ...prev[id], [campo]: texto } }));
        // Editar una fila la selecciona para aplicarla
        setSeleccion(prev => (prev.has(id) ? prev : new Set(prev).add(id)));
    };

    const toggleSeleccion = (id) => {
        setSeleccion(prev => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id); else n.add(id);
            return n;
        });
    };

    const seleccionarTodos = () => {
        if (seleccion.size === sugerenciasFiltradas.length) {
            setSeleccion(new Set());
        } else {
            setSeleccion(new Set(sugerenciasFiltradas.map(s => s.id)));
        }
    };

    const aplicar = async () => {
        if (seleccion.size === 0) {
            toast.error('Selecciona al menos un artículo');
            return;
        }
        const ajustes = [];
        const errores = [];
        for (const s of sugerenciasFiltradas.filter(x => seleccion.has(x.id))) {
            const p = propuesta(s);
            const min = p.min.trim() === '' ? null : Number(p.min);
            const max = p.max.trim() === '' ? null : Number(p.max);
            if (min === null || !Number.isFinite(min) || min < 0) { errores.push(`${s.nombre}: mínimo inválido`); continue; }
            if (max !== null && (!Number.isFinite(max) || max < 0)) { errores.push(`${s.nombre}: máximo inválido`); continue; }
            if (max !== null && max > 0 && max < min) { errores.push(`${s.nombre}: el máximo (${max}) es menor que el mínimo (${min})`); continue; }
            const a = { id: s.id };
            if (min !== s.stock_minimo) a.stock_minimo = min;
            if (max !== null && max !== s.stock_maximo) a.stock_maximo = max;
            if (Object.keys(a).length > 1) ajustes.push(a);
        }
        if (errores.length > 0) {
            toast.error(errores.slice(0, 3).join('\n') + (errores.length > 3 ? `\n…y ${errores.length - 3} más` : ''));
            return;
        }
        if (ajustes.length === 0) {
            toast('Los artículos seleccionados ya tienen esos valores');
            return;
        }
        const aCero = ajustes.filter(a => a.stock_minimo === 0).length;
        // Vista previa antes → después armada con los mismos ajustes que se van a mandar (ya calculados arriba)
        const nombre = (id) => sugerenciasFiltradas.find(x => x.id === id);
        const cambios = ajustes.slice(0, 8).map(a => {
            const s = nombre(a.id) || {};
            const antes = `mín ${formatNumber(s.stock_minimo)} · máx ${s.stock_maximo !== null && s.stock_maximo !== undefined ? formatNumber(s.stock_maximo) : '-'}`;
            const despues = `mín ${formatNumber(a.stock_minimo !== undefined ? a.stock_minimo : s.stock_minimo)} · máx ${a.stock_maximo !== undefined ? formatNumber(a.stock_maximo) : (s.stock_maximo !== null && s.stock_maximo !== undefined ? formatNumber(s.stock_maximo) : '-')}`;
            return { campo: s.nombre || `Artículo ${a.id}`, antes, despues };
        });
        if (!(await confirmarG3({
            titulo: `¿Aplicar ${ajustes.length} ${ajustes.length === 1 ? 'ajuste' : 'ajustes'} de stock?`,
            aviso: 'Esta acción modifica los artículos.',
            cambios,
            datos: ajustes.length > 8 ? [['Además', `${ajustes.length - 8} artículo(s) más`]] : [],
            pasa: aCero > 0 ? [`${aCero} quedará(n) con mínimo 0 y se desactivarán.`] : [],
            confirmar: 'Aplicar ajustes', cancelar: 'Regresar', ancho: true,
        }))) return;
        try {
            setAplicando(true);
            const res = await reportesService.aplicarSugerencias(ajustes);
            toast.success(res.message || 'Ajustes aplicados');
            await cargar();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Error al aplicar ajustes');
        } finally {
            setAplicando(false);
        }
    };

    return (
        <VistaReportes data={data} loading={loading} errorCarga={errorCargaR2} dias={dias} setDias={setDias} cargar={cargar}
            filtroAccion={filtroAccion} setFiltroAccion={setFiltroAccion} seleccion={seleccion} setSeleccion={setSeleccion}
            aplicando={aplicando} aplicar={aplicar} sugerenciasFiltradas={sugerenciasFiltradas} propuesta={propuesta}
            editarValor={editarValor} valores={valores} toggleSeleccion={toggleSeleccion} seleccionarTodos={seleccionarTodos} />
    );
};

export default ReportesPage;
