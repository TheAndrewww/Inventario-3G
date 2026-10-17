// Rediseño 2 · Compras · Stock bajo (/stock-bajo), vista ENCENDIDA (solo administración, como hoy).
// Pantalla de consulta: una tira de cifras que filtra (Agotados · Críticos · Bajo mínimo) con el costo de reposición, filtros
// en una fila y una tabla compacta agrupada por almacén con la columna «A comprar» destacada. Los datos, los filtros y la
// exportación son los de StockBajoPage; aquí solo se pinta.
import { useMemo } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import {
  Pagina, EncabezadoPagina, TiraCifras, BarraFiltros, FiltroMenu, ChipFiltro, Tabla, Estado, Miniatura, dinero, cantidad, numero,
  plural, horaCorta, fechaExacta, clases, useEsCelular,
} from '../fundacion';
import { getImageUrl } from '../../utils/imageUtils';
import { errorDeCarga } from './comunes';
import './compras.css';

const ESTADO = {
  agotado: { tono: 'mal', texto: 'Agotado' },
  critico: { tono: 'aviso', texto: 'Crítico' },
  bajo: { tono: 'neutro', texto: 'Bajo mínimo' },
};

const cobertura = (a) => (a.stock_minimo > 0 ? Math.min(100, Math.max(0, (a.stock_actual / a.stock_minimo) * 100)) : (a.stock_actual > 0 ? 100 : 0));

export default function VistaStockBajo(p) {
  const {
    data, loading, errorCarga, recargar, busqueda, setBusqueda, filtroEstado, setFiltroEstado, almacenActivo, setAlmacenActivo,
    soloConMinimo, setSoloConMinimo, gruposBase, almacenesFiltrados, totales, exportarCSV,
  } = p;
  const resumen = data?.resumen || {};
  const celular = useEsCelular();

  // Cuántos hay de cada estado con los demás filtros puestos (la tira no se vacía al elegir uno)
  const porEstado = useMemo(() => {
    const c = { agotado: 0, critico: 0, bajo: 0 };
    if (!data) return c;
    const texto = busqueda.trim().toLowerCase();
    data.almacenes.forEach((g) => {
      if (almacenActivo !== 'todos' && String(g.almacen_id ?? g.almacen) !== almacenActivo) return;
      g.articulos.forEach((a) => {
        if (soloConMinimo && !(a.stock_minimo > 0)) return;
        if (texto && ![a.nombre, a.sku, a.codigo_ean13, a.categoria, a.proveedor].some((x) => x?.toLowerCase().includes(texto))) return;
        c[a.estado] = (c[a.estado] || 0) + 1;
      });
    });
    return c;
  }, [data, busqueda, almacenActivo, soloConMinimo]);

  const alternar = (estado) => setFiltroEstado(filtroEstado === estado ? 'todos' : estado);
  const cifras = [
    { id: 'agotado', valor: porEstado.agotado, texto: 'Agotados', tono: porEstado.agotado ? 'mal' : null },
    { id: 'critico', valor: porEstado.critico, texto: 'Críticos', tono: porEstado.critico ? 'aviso' : null, titulo: 'Menos de la mitad del mínimo' },
    { id: 'bajo', valor: porEstado.bajo, texto: 'Bajo mínimo' },
  ].map((c) => ({ ...c, activa: filtroEstado === c.id, alElegir: () => alternar(c.id) }));

  const quitarFiltros = () => { setBusqueda(''); setAlmacenActivo('todos'); setSoloConMinimo(false); setFiltroEstado('todos'); };
  const activos = (busqueda ? 1 : 0) + (almacenActivo !== 'todos' ? 1 : 0) + (soloConMinimo ? 1 : 0) + (filtroEstado !== 'todos' ? 1 : 0);

  const opcionesAlmacen = [
    { valor: 'todos', texto: 'Todos', cuenta: gruposBase.reduce((s, g) => s + g.articulos.length, 0) },
    ...gruposBase
      .filter((g) => g.articulos.length > 0 || String(g.almacen_id ?? g.almacen) === almacenActivo)
      .map((g) => ({ valor: String(g.almacen_id ?? g.almacen), texto: g.almacen, cuenta: g.articulos.length })),
  ];

  const grupos = almacenesFiltrados.map((g) => {
    const reposicion = g.articulos.reduce((s, a) => s + (a.costo_reposicion || 0), 0);
    const agotados = g.articulos.filter((a) => a.estado === 'agotado').length;
    const criticos = g.articulos.filter((a) => a.estado === 'critico').length;
    return {
      id: String(g.almacen_id ?? g.almacen),
      titulo: g.almacen,
      filas: g.articulos,
      nota: (
        <span className="r2c-grupo-nota">
          {[agotados ? plural(agotados, 'agotado', 'agotados') : null, criticos ? plural(criticos, 'crítico', 'críticos') : null,
            `reposición ${dinero(reposicion)}`].filter(Boolean).join(' · ')}
        </span>
      ),
    };
  });

  const columnas = [
    {
      id: 'foto', titulo: <span className="r2-solo-lectores">Foto</span>, ancho: '56px', sinBoton: true,
      celda: (a) => <Miniatura src={a.imagen_url ? getImageUrl(a.imagen_url) : null} alt={a.nombre} tamano={40} />,
    },
    {
      id: 'articulo', titulo: 'Artículo',
      celda: (a) => {
        const sec = [a.categoria, a.sku ? `Clave ${a.sku}` : null, a.proveedor].filter(Boolean).join(' · ');
        return (
          <span className="r2c-celda-doble r2c-celda-corta">
            <span className="r2c-fuerte">{a.nombre}</span>
            <span className="r2c-sec r2c-una-linea" title={sec}>{sec}</span>
          </span>
        );
      },
    },
    { id: 'ubicacion', titulo: 'Ubicación', ocultarEn: 'celular-ancho', celda: (a) => a.ubicacion || '—' },
    {
      id: 'actual', titulo: 'Actual', alinear: 'der',
      celda: (a) => <span className={clases('r2c-fuerte', a.stock_actual <= 0 && 'r2-tono--mal')}>{cantidad(a.stock_actual, a.unidad)}</span>,
    },
    { id: 'minimo', titulo: 'Mínimo', alinear: 'der', celda: (a) => numero(a.stock_minimo) },
    { id: 'cobertura', titulo: 'Cobertura', alinear: 'der', ocultarEn: 'tableta', celda: (a) => `${Math.round(cobertura(a))} %` },
    {
      id: 'comprar', titulo: 'A comprar', alinear: 'der',
      celda: (a) => (a.sugerido_comprar > 0 ? <span className="r2c-comprar">{cantidad(a.sugerido_comprar, a.unidad)}</span> : '—'),
    },
    { id: 'costo', titulo: 'Costo', alinear: 'der', ocultarEn: 'celular-ancho', celda: (a) => (a.costo_reposicion > 0 ? dinero(a.costo_reposicion) : '—') },
    { id: 'estado', titulo: 'Estado', celda: (a) => <Estado tono={ESTADO[a.estado]?.tono} texto={ESTADO[a.estado]?.texto || a.estado} /> },
  ];

  const dato = data ? [
    `${plural(totales.articulos, 'artículo', 'artículos')} bajo su mínimo${totales.articulos !== resumen.total ? ` de ${numero(resumen.total)}` : ''}`,
    plural(almacenesFiltrados.length, 'almacén', 'almacenes'),
    data.generado && !celular ? `datos de las ${horaCorta(data.generado)}` : null,
  ].filter(Boolean).join(' · ') : undefined;

  return (
    <Pagina titulo="Stock bajo" densidad="compacta" className="r2c-pagina">
      <EncabezadoPagina pestanas="seccion" dato={dato}
        secundarias={[
          { texto: 'Exportar CSV', icono: Download, alHacer: exportarCSV, deshabilitado: totales.articulos === 0, motivo: 'No hay artículos en la lista' },
          { texto: 'Actualizar', icono: RefreshCw, alHacer: recargar, cargando: loading && Boolean(data) },
        ]} />
      {data?.generado && <span className="r2-solo-lectores">{fechaExacta(data.generado)}</span>}

      {data && (
        <TiraCifras etiqueta="Artículos por estado" cifras={cifras}
          informativas={[{ valor: dinero(totales.reposicion), texto: 'Reposición' }]} />
      )}

      <BarraFiltros
        busqueda={{ valor: busqueda, alCambiar: setBusqueda, texto: celular ? 'Buscar artículo o clave' : 'Buscar artículo, clave, código o proveedor', etiqueta: 'Buscar artículo, clave, código, categoría o proveedor' }}
        filtros={[
          <FiltroMenu key="almacen" etiqueta="Almacén" valor={almacenActivo} alCambiar={setAlmacenActivo} opciones={opcionesAlmacen} />,
          <ChipFiltro key="minimo" texto="Solo con mínimo configurado" activo={soloConMinimo} alCambiar={setSoloConMinimo} />,
        ]}
        activos={activos} alQuitar={quitarFiltros} resultados={totales.articulos} />

      <Tabla etiqueta="Artículos bajo su mínimo por almacén" clave="id" columnas={columnas} grupos={grupos} densidad="compacta"
        filaCelular={(a) => ({
          inicio: <Miniatura src={a.imagen_url ? getImageUrl(a.imagen_url) : null} alt={a.nombre} tamano={44} />,
          principal: a.nombre,
          secundario: [a.ubicacion, `tiene ${numero(a.stock_actual)} de ${cantidad(a.stock_minimo, a.unidad)}`, a.costo_reposicion > 0 ? dinero(a.costo_reposicion) : null].filter(Boolean).join(' · '),
          derecha: a.sugerido_comprar > 0 ? `Comprar ${numero(a.sugerido_comprar)}` : null,
          debajo: <Estado tono={ESTADO[a.estado]?.tono} texto={ESTADO[a.estado]?.texto || a.estado} />,
        })}
        cargando={loading && !data}
        error={data ? undefined : errorDeCarga('No se pudo cargar el stock bajo.', errorCarga, recargar)}
        vacio={resumen.total === 0
          ? { titulo: 'Ningún artículo está por debajo de su mínimo', texto: 'Cuando la existencia de algo baje de su mínimo aparecerá aquí.' }
          : { sinResultados: true, busqueda: busqueda || undefined, alQuitar: quitarFiltros }} />
    </Pagina>
  );
}
