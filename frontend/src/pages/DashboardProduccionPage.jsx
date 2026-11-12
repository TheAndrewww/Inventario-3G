import React, { useState, useCallback, lazy, Suspense } from 'react';
import { useProduccionData } from '../hooks/useProduccionData';
import { useProduccionFilters } from '../hooks/useProduccionFilters';
import { useAuth } from '../context/AuthContext';
import VistaTablero from '../rediseno2/produccion/VistaTablero';

// ============ Filtros ============
// Orden de las pestañas de filtro, por usuario (se arrastran para reordenar).
// Las pestañas nuevas que no estén en el orden guardado van al final.
const claveOrdenFiltros = (userId) => `produccion-filtros-orden:${userId ?? 'anon'}`;

const ordenarOpciones = (opciones, guardado) => {
    if (!Array.isArray(guardado) || guardado.length === 0) return opciones;
    const porValor = new Map(opciones.map(o => [o.value, o]));
    const ordenadas = guardado.filter(v => porValor.has(v)).map(v => porValor.get(v));
    const restantes = opciones.filter(o => !guardado.includes(o.value));
    return [...ordenadas, ...restantes];
};

// ============ Página principal ============
const DashboardProduccionPage = () => {
    const [modalOpen, setModalOpen] = useState(false);
    // Proyecto cuya carpeta de Drive se está viendo (click en el nombre).
    const [proyectoCarpeta, setProyectoCarpeta] = useState(null);
    const { user } = useAuth();
    const esAlmacen = user?.rol === 'almacen';

    // Hooks personalizados
    const {
        proyectos,
        estadisticas,
        loading,
        sincronizando,
        ultimaSync,
        cargarDatos,
        sincronizarSheets,
        sincronizarDrive,
        completarEtapa,
        regresarEtapa,
        reabrirManufactura,
        completarSubEtapa,
        crearProyecto,
        togglePausa,
        toggleEtapa
    } = useProduccionData({ autoSync: true, refreshInterval: 5 * 60 * 1000 });

    // Almacén: vista de solo lectura que replica la "pantalla de producción" (TV).
    // Solo proyectos activos en producción (diseño, compras, producción),
    // excluyendo completados, pendientes, preparados/instalación, pausados y los
    // MTO/GTIA simplificados (que van directo a Preparados).
    const usaTimelineSimplificado = (p) => {
        const tipo = p.tipo_proyecto?.toUpperCase();
        return (tipo === 'MTO' || tipo === 'GTIA') && !p.es_extensivo;
    };
    const proyectosVisibles = esAlmacen
        ? proyectos.filter(p =>
            p.etapa_actual !== 'completado' &&
            p.etapa_actual !== 'pendiente' &&
            p.etapa_actual !== 'instalacion' &&
            !p.pausado &&
            !usaTimelineSimplificado(p)
        )
        : proyectos;

    const { filtro, setFiltro, busqueda, setBusqueda, proyectosFiltrados, opciones } = useProduccionFilters(proyectosVisibles);

    return (
        <VistaTablero
            usuario={user} esAlmacen={esAlmacen} proyectos={proyectos} proyectosVisibles={proyectosVisibles}
            proyectosFiltrados={proyectosFiltrados} estadisticas={estadisticas} loading={loading}
            sincronizando={sincronizando} ultimaSync={ultimaSync} cargarDatos={cargarDatos}
            sincronizarSheets={sincronizarSheets} sincronizarDrive={sincronizarDrive} regresarEtapa={regresarEtapa}
            reabrirManufactura={reabrirManufactura}
            completarEtapa={completarEtapa} completarSubEtapa={completarSubEtapa}
            crearProyecto={crearProyecto} togglePausa={togglePausa} toggleEtapa={toggleEtapa}
            filtro={filtro} setFiltro={setFiltro} busqueda={busqueda} setBusqueda={setBusqueda} opciones={opciones}
            modalOpen={modalOpen} setModalOpen={setModalOpen} proyectoCarpeta={proyectoCarpeta} setProyectoCarpeta={setProyectoCarpeta}
            claveOrdenFiltros={claveOrdenFiltros} ordenarOpciones={ordenarOpciones}
        />
    );
};

export default DashboardProduccionPage;
