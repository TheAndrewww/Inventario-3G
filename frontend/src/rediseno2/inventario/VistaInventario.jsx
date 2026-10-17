// Rediseño 2 · grupo inventario · Inventario (/inventario) encendido. DISENO-v2 §5.3.
// Una sola pantalla de artículos: los tres niveles de hoy (inicio → almacén → sección) son estado de la página y aquí se
// pintan como filtros en una fila (Almacén ▾ · Sección ▾ · Categoría ▾ · Ubicación ▾). Sin almacén elegido, la pantalla
// es el buscador global y la lista de almacenes (el inicio de hoy, sin tarjetas).
//
// Todo llega de la página por `p` (estado, permisos y manejadores de siempre). Esta vista no pide nada por su cuenta:
// elegir un almacén llama a los mismos setters de hoy (y la página pide sus categorías, ubicaciones y secciones).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, ScanLine, Tags, SlidersHorizontal, Lock, Unlock, Warehouse, Columns3, PackagePlus, PackageMinus, Eye, MapPin,
  Ban, RotateCcw, Trash2, ChevronDown, Settings2, Wrench, Package,
} from 'lucide-react';
import { Pagina } from '../fundacion/piezas/Pagina';
import { EncabezadoPagina } from '../fundacion/piezas/EncabezadoPagina';
import { TiraCifras } from '../fundacion/piezas/TiraCifras';
import { BarraFiltros, FiltroMenu } from '../fundacion/piezas/BarraFiltros';
import { Tabla } from '../fundacion/piezas/Tabla';
import { Estado } from '../fundacion/piezas/Estado';
import { Cargando, Vacio, ErrorCarga } from '../fundacion/piezas/Estados';
import { Boton } from '../fundacion/piezas/Boton';
import { BarraAccion } from '../fundacion/piezas/BarraAccion';
import { Miniatura, IndicadorPistola } from '../fundacion/piezas/Miniatura';
import { Nota } from '../fundacion/piezas/Ayudas';
import { useAnchoR2 } from '../fundacion/useDiseno3G';
import { plural, numero, cantidad } from '../fundacion/formato';
import { Modal } from '../../components/common';
import ArticuloDetalleModal from '../../components/articulos/ArticuloDetalleModal';
import ArticuloFormModal from '../../components/articulos/ArticuloFormModal';
import UnidadHerramientaDetalleModal from '../../components/articulos/UnidadHerramientaDetalleModal';
import EAN13Scanner from '../../components/scanner/EAN13Scanner';
import BarcodeScannerIndicator from '../../components/scanner/BarcodeScannerIndicator';
import TablaArticulos from './TablaArticulos';
import NuevosPorAutorizar from './NuevosPorAutorizar';
import CajonEtiquetas from './CajonEtiquetas';
import CajonAlmacenes from './CajonAlmacenes';
import DialogoCantidad from './DialogoCantidad';
import { CajonTaxonomia, DialogosTaxonomia } from './Taxonomia';
import { existencia, estadoExistencia, num, ubicacionDe, motivoLegible } from './ayudas';
import './inventario.css';

const ORDENES = [
  { valor: 'nombre-asc', texto: 'Nombre A-Z' },
  { valor: 'nombre-desc', texto: 'Nombre Z-A' },
  { valor: 'stock-bajo', texto: 'Bajo mínimo primero' },
  { valor: 'stock-asc', texto: 'Existencia: de menos a más' },
  { valor: 'stock-desc', texto: 'Existencia: de más a menos' },
  { valor: 'costo-asc', texto: 'Precio: de menos a más' },
  { valor: 'costo-desc', texto: 'Precio: de más a menos' },
  { valor: 'categoria', texto: 'Por categoría' },
];

const delAlmacen = (a, id) => a.ubicacion && (String(a.ubicacion.almacen_id) === String(id) || String(a.ubicacion.almacen_ref?.id) === String(id));
const bajoMinimo = (a) => a.es_herramienta === false && num(a.stock_minimo) > 0 && num(a.stock_actual) <= num(a.stock_minimo);

export default function VistaInventario({ p }) {
  const navegar = useNavigate();
  const ancho = useAnchoR2();
  const celular = ancho === 'celular';
  // En celular la búsqueda comparte la fila con Filtros, «⋯» y Escanear: el ejemplo corto cabe sin cortarse
  const textoBusqueda = celular ? 'Nombre o clave' : 'Nombre, clave o código';
  const tableta = ancho !== 'escritorio';
  const [taxonomia, setTaxonomia] = useState(null);

  const enInicio = p.almacenSeleccionado === null;
  const nuevos = p.modoNuevosRegistros;
  const almacenActual = p.almacenesDisponibles.find((a) => String(a.id) === String(p.almacenSeleccionado));
  const nombreAlmacen = nuevos ? 'Nuevos por autorizar' : almacenActual?.nombre || 'Almacén';
  const ajuste = p.modoAjusteStock && p.puedeAjustarStock;

  // ───── Cifras (con lo que la pantalla ya cargó) ─────
  const activos = p.articulos.filter((a) => a.activo === true);
  const parcial = p.articulos.length >= 1000; // GET /articulos trae hasta 1000 (límite de siempre)
  const nBajo = activos.filter(bajoMinimo).length;
  const verStockBajo = p.esAdministrador && p.rolPuedeVer?.(p.user?.rol, '/stock-bajo');
  const nPorAutorizar = p.articulosPendientesRevision.length;
  const veNuevos = p.esAdministrador || p.esAlmacen;
  const desactivadosAqui = !enInicio && !nuevos ? p.articulos.filter((a) => a.activo === false && !a.pendiente_revision && delAlmacen(a, p.almacenSeleccionado)).length : 0;

  // ───── Navegación interna (los mismos setters de hoy) ─────
  const elegirAlmacen = (alm) => {
    p.setAlmacenSeleccionado(alm.id);
    p.setTabActivo(alm.nombre === 'Herramientas' ? 'herramientas' : 'consumibles');
    p.setSeccionSeleccionada(null);
  };
  const abrirNuevos = () => {
    p.setAlmacenSeleccionado('nuevos');
    p.setTabActivo('consumibles');
    p.setSeccionSeleccionada('todos');
    p.setCategoriaSeleccionada(null);
    p.setUbicacionSeleccionada(null);
  };
  const irAlInicio = () => { p.setAlmacenSeleccionado(null); p.setSeccionSeleccionada(null); };
  const cambiarAlmacen = (valor) => {
    if (valor === '__inicio') irAlInicio();
    else if (valor === 'nuevos') abrirNuevos();
    else {
      const alm = p.almacenesDisponibles.find((a) => String(a.id) === String(valor));
      if (alm) elegirAlmacen(alm);
    }
  };

  const tira = (
    <TiraCifras etiqueta="Cifras del inventario"
      cifras={[
        { id: 'bajo', valor: `${numero(nBajo)}${parcial ? '+' : ''}`, texto: 'Bajo mínimo', tono: nBajo ? 'aviso' : undefined,
          alElegir: verStockBajo ? () => navegar('/stock-bajo') : undefined, titulo: verStockBajo ? 'Ver la lista de stock bajo' : undefined },
        veNuevos && { id: 'nuevos', valor: nPorAutorizar, texto: 'Por autorizar', activa: nuevos, alElegir: abrirNuevos, titulo: 'Ver las claves nuevas por autorizar' },
        !enInicio && !nuevos && p.puedeCrearArticulos && {
          id: 'desactivados', valor: desactivadosAqui, texto: 'Desactivados', activa: p.mostrarDesactivados,
          alElegir: () => p.setMostrarDesactivados(!p.mostrarDesactivados), titulo: p.mostrarDesactivados ? 'Ver los artículos activos' : 'Ver los artículos desactivados',
        },
      ]}
      informativas={[{ valor: p.articulosEnConteo.size, texto: 'Contados en el ciclo del conteo' }]} />
  );

  // ───── Acciones del encabezado ─────
  const nuevoArticulo = p.puedeCrearArticulos ? { texto: p.esAlmacen ? 'Nueva clave' : 'Nuevo artículo', corto: p.esAlmacen ? 'Nueva' : 'Nuevo', icono: Plus, alHacer: p.handleNuevoArticulo } : null;
  const escanear = { texto: 'Escanear', corto: 'Escanear', icono: ScanLine, alHacer: () => p.setShowScanner(true) }; // en celular se ve solo el ícono (CSS), con su nombre para lectores
  let principal = null;
  let secundarias = [];
  const mas = [];
  if (!enInicio) {
    if (celular || !nuevoArticulo) {
      principal = escanear;
      if (nuevoArticulo) mas.push({ texto: nuevoArticulo.texto, icono: Plus, alHacer: nuevoArticulo.alHacer });
    } else {
      principal = nuevoArticulo;
      secundarias = [escanear];
    }
    if (p.puedeCrearArticulos) mas.push({ texto: 'Generar etiquetas', icono: Tags, alHacer: p.handleAbrirModalEtiquetas });
    if (p.puedeAjustarStock && !nuevos) {
      mas.push({ texto: p.modoAjusteStock ? 'Salir del ajuste de existencias' : 'Ajustar existencias', icono: SlidersHorizontal, deshabilitado: p.guardandoStocks,
        alHacer: () => (p.modoAjusteStock ? p.handleCancelarAjusteStock() : p.setModoAjusteStock(true)) });
    }
    if (p.esAdministrador) {
      mas.push({ texto: p.permisosAlmacenAbiertos ? 'Cerrar permisos de almacén' : 'Abrir permisos de almacén', icono: p.permisosAlmacenAbiertos ? Lock : Unlock,
        deshabilitado: p.cambiandoPermisosAlmacen, alHacer: p.togglePermisosAlmacen });
      mas.push({ texto: 'Gestionar almacenes', icono: Warehouse, alHacer: () => p.setModalAlmacenesOpen(true) });
    }
    if (!celular && !nuevos) mas.push({ texto: 'Restablecer columnas', icono: Columns3, alHacer: p.resetColWidths });
  } else if (p.esAdministrador) {
    // Fuera de un almacén «Gestionar almacenes» no abre (error de hoy): va desactivado con la nota de hoy
    mas.push({ texto: 'Gestionar almacenes', icono: Warehouse, deshabilitado: true, motivo: 'Entra a cualquier almacén y usa «Gestionar almacenes».' });
  }

  // ───── Acciones de cada renglón según el rol ─────
  const acciones = (item, { celular: enCelular } = {}) => {
    const botones = [];
    const menu = [];
    const herr = item.es_herramienta;
    const mueve = p.puedeGestionarInventario || p.puedeRegistrarSalida;
    const entrada = p.puedeGestionarInventario && { texto: 'Entrada', icono: PackagePlus, alHacer: () => p.handleAbrirEntrada(item), etiqueta: `Registrar entrada de ${item.nombre}` };
    const salida = p.puedeRegistrarSalida && { texto: 'Salida', icono: PackageMinus, alHacer: () => p.handleAbrirSalida(item), etiqueta: `Registrar salida de ${item.nombre}` };
    const agregar = p.puedeAgregarAlPedido && { texto: 'Agregar a la orden', icono: Plus, alHacer: () => p.handleAgregarAlPedido(item), etiqueta: `Agregar ${item.nombre} a la orden de salida` };
    if (p.mostrarDesactivados) {
      if (p.puedeEditarArticulos) botones.push({ texto: p.esAlmacen ? 'Pedir reactivar' : 'Reactivar', icono: RotateCcw, nivel: 'tonal', alHacer: () => p.handleReactivar(item) });
      for (const x of [entrada, salida, agregar]) if (x) menu.push({ texto: x.etiqueta, icono: x.icono, alHacer: x.alHacer });
    } else if (enCelular && herr) {
      botones.push({ texto: p.herramientasExpandidas[item.id] ? 'Ocultar unidades' : 'Ver unidades', icono: ChevronDown, nivel: 'fantasma',
        alHacer: (e) => p.handleToggleHerramienta(item.id, e), deshabilitado: p.loadingUnidades[item.id] });
      for (const x of [entrada, salida, agregar]) if (x) menu.push({ texto: x.etiqueta, icono: x.icono, alHacer: x.alHacer });
    } else {
      if (entrada) botones.push({ ...entrada, nivel: enCelular ? 'tonal' : 'fantasma' });
      if (salida) botones.push({ ...salida, nivel: enCelular ? 'tonal' : 'fantasma' });
      if (agregar) {
        if (mueve) menu.push({ texto: 'Agregar a la orden de salida', icono: Plus, alHacer: agregar.alHacer });
        else botones.push({ ...agregar, nivel: 'tonal' });
      }
    }
    menu.push({ texto: 'Ver detalle', icono: Eye, alHacer: () => p.handleVerDetalle(item) });
    if (p.puedeGestionarTaxonomia && !p.mostrarDesactivados) menu.push({ texto: 'Cambiar ubicación o categoría', icono: MapPin, alHacer: () => p.handleVerDetalle(item) });
    if (p.puedeEditarArticulos) {
      if (p.mostrarDesactivados) {
        if (p.esAdministrador) menu.push({ texto: 'Eliminar permanentemente', icono: Trash2, peligro: true, alHacer: () => p.handleEliminarPermanente(item) });
      } else {
        menu.push({ texto: p.esAlmacen ? 'Pedir que se desactive' : 'Desactivar artículo', icono: Ban, peligro: true, alHacer: () => p.handleEliminar(item) });
      }
    }
    return { botones, menu };
  };
  // Ancho de la columna de acciones (escritorio) según lo que el rol ve en cada renglón
  const muestra = acciones({ id: 0, nombre: '' });
  const anchoAcciones = muestra.botones.length >= 2 ? 232 : muestra.botones.some((b) => b.texto.length > 10) ? 228
    : muestra.botones.length === 1 ? 168 : 56;

  // ───── Filtros ─────
  const valorSeccion = p.seccionSeleccionada == null ? 'todos' : p.seccionSeleccionada;
  const articulosAqui = !enInicio && !nuevos ? p.articulos.filter((a) => a.activo !== false && delAlmacen(a, p.almacenSeleccionado)) : [];
  const filtrosPuestos = (p.categoriaSeleccionada ? 1 : 0) + (p.ubicacionSeleccionada ? 1 : 0)
    + (typeof p.seccionSeleccionada === 'number' ? 1 : 0) + (p.mostrarDesactivados ? 1 : 0);
  const quitarFiltros = () => {
    p.setCategoriaSeleccionada(null);
    p.setUbicacionSeleccionada(null);
    if (typeof p.seccionSeleccionada === 'number') p.setSeccionSeleccionada('todos');
    if (p.mostrarDesactivados) p.setMostrarDesactivados(false);
  };
  const puedeAdministrarCat = p.puedeGestionarTaxonomia || p.esAdministrador;

  const filtroAlmacen = (
    <FiltroMenu key="almacen" etiqueta="Almacén" valor={nuevos ? 'nuevos' : String(p.almacenSeleccionado)} alCambiar={cambiarAlmacen}
      opciones={[
        { valor: '__inicio', texto: 'Ver todos los almacenes' },
        ...p.almacenesDisponibles.map((a) => ({ valor: String(a.id), texto: a.nombre, cuenta: a.articulos_count })),
        ...(veNuevos ? [{ valor: 'nuevos', texto: 'Nuevos por autorizar', cuenta: nPorAutorizar }] : []),
      ]} />
  );
  const filtros = enInicio ? [] : [
    filtroAlmacen,
    !nuevos && (
      <FiltroMenu key="seccion" etiqueta="Sección" valor={valorSeccion}
        alCambiar={(v) => p.setSeccionSeleccionada(v === 'todos' ? 'todos' : Number(v))}
        opciones={[{ valor: 'todos', texto: 'Todas', cuenta: articulosAqui.length },
          ...p.secciones.map((s) => ({ valor: s.id, texto: s.nombre, cuenta: articulosAqui.filter((a) => a.seccion_id === s.id).length }))]}
        pie={p.esAdministrador ? { texto: 'Administrar secciones…', icono: Settings2, alHacer: () => setTaxonomia('seccion') } : undefined} />
    ),
    !nuevos && (
      <FiltroMenu key="categoria" etiqueta="Categoría" valor={p.categoriaSeleccionada ?? ''} alCambiar={(v) => p.setCategoriaSeleccionada(v === '' ? null : v)}
        opciones={[{ valor: '', texto: 'Todas' }, ...p.categoriasAlmacenSel.map((c) => ({ valor: c.id, texto: c.nombre }))]}
        pie={puedeAdministrarCat ? { texto: 'Administrar categorías…', icono: Settings2, alHacer: () => setTaxonomia('categoria') } : undefined} />
    ),
    !nuevos && (
      <FiltroMenu key="ubicacion" etiqueta="Ubicación" valor={p.ubicacionSeleccionada ?? ''} alCambiar={(v) => p.setUbicacionSeleccionada(v === '' ? null : v)}
        opciones={[{ valor: '', texto: 'Todas' }, ...p.ubicacionesAlmacenSel.map((u) => ({ valor: u.id, texto: u.codigo || u.nombre }))]}
        pie={puedeAdministrarCat ? { texto: 'Administrar ubicaciones…', icono: Settings2, alHacer: () => setTaxonomia('ubicacion') } : undefined} />
    ),
  ].filter(Boolean);
  const filtroOrden = !enInicio ? (
    <FiltroMenu etiqueta="Orden" valor={p.ordenamiento} alCambiar={p.setOrdenamiento} opciones={ORDENES} />
  ) : null;

  // ───── Encabezado: qué es y cuántos hay ─────
  const conteoTabla = p.filteredArticulos.length;
  let dato;
  if (enInicio) dato = `${numero(activos.length)}${parcial ? '+' : ''} artículos activos`;
  else if (p.buscandoGlobalActivo) dato = `${plural(conteoTabla, 'resultado', 'resultados')} en todos los almacenes`;
  else if (nuevos) dato = plural(conteoTabla, 'clave por revisar', 'claves por revisar');
  else dato = `${nombreAlmacen} · ${plural(conteoTabla, 'artículo', 'artículos')}${p.mostrarDesactivados ? ' desactivados' : ''}`;

  // ───── Cuerpo ─────
  let cuerpo;
  if (p.errorCargaR2 && !p.articulos.length) {
    cuerpo = <ErrorCarga mensaje="No se pudo cargar el inventario." motivo={motivoLegible(p.errorCargaR2)} alReintentar={() => p.fetchArticulos()} />;
  } else if (p.loading && !p.articulos.length) {
    cuerpo = <Cargando forma={celular ? 'lista' : 'tabla'} columnas={[3, 1, 1, 1, 1, 1]} filas={10} etiqueta="Cargando el inventario…" />;
  } else if (enInicio) {
    cuerpo = <Inicio p={p} celular={celular} elegirAlmacen={elegirAlmacen} abrirNuevos={abrirNuevos} veNuevos={veNuevos} nPorAutorizar={nPorAutorizar} />;
  } else if (nuevos) {
    cuerpo = (
      <NuevosPorAutorizar filas={p.filteredArticulos} p={p} celular={celular}
        vacio={p.searchTerm.trim() ? <Vacio sinResultados busqueda={p.searchTerm.trim()} alQuitar={() => p.setSearchTerm('')} /> : null} />
    );
  } else {
    const consumibles = p.filteredArticulos.filter((a) => !a.es_herramienta);
    const herramientas = p.filteredArticulos.filter((a) => a.es_herramienta);
    const nota = p.buscandoGlobalActivo ? 'Buscando en todos los almacenes, también los desactivados' : null;
    let vacio;
    if (p.searchTerm.trim()) vacio = <Vacio sinResultados busqueda={p.searchTerm.trim()} texto="La búsqueda revisa todos los almacenes." alQuitar={() => p.setSearchTerm('')} />;
    else if (filtrosPuestos) vacio = <Vacio sinResultados donde={nombreAlmacen} alQuitar={quitarFiltros} />;
    else {
      vacio = (
        <Vacio icono={Package} titulo={`${nombreAlmacen} no tiene artículos`}
          texto={nuevoArticulo ? `Da de alta el primero con «${nuevoArticulo.texto}».` : 'Cuando se den de alta artículos en este almacén aparecerán aquí.'}
          accion={nuevoArticulo ? { texto: nuevoArticulo.texto, icono: Plus, alHacer: nuevoArticulo.alHacer } : undefined} />
      );
    }
    cuerpo = (
      <TablaArticulos p={{ ...p, anchoAcciones }} acciones={acciones} celular={celular} tableta={tableta}
        abiertoId={p.modalDetalleOpen ? p.articuloSeleccionado?.id : null} vacio={vacio}
        grupos={[
          { id: 'consumibles', titulo: 'Consumibles', filas: consumibles, nota },
          { id: 'herramientas', titulo: 'Herramientas', filas: herramientas, nota: consumibles.length ? null : nota },
        ]} />
    );
  }

  const articuloFresco = p.articuloSeleccionado ? (p.articulos.find((a) => a.id === p.articuloSeleccionado.id) || p.articuloSeleccionado) : null;
  const ent = p.articuloParaEntrada;
  const sal = p.articuloParaSalida;
  const unidadDe = (a) => cantidad(2, a?.unidad || 'piezas').replace(/^\S+\s/, '');
  const previa = (a, cant, signo) => {
    if (!a || !cant || num(cant) <= 0) return null;
    const despues = num(a.stock_actual) + signo * num(cant);
    return { antes: numero(num(a.stock_actual)), despues: numero(despues), unidad: unidadDe(a), tono: despues < 0 ? 'mal' : null };
  };

  return (
    <Pagina titulo="Inventario" densidad="compacta" espacioInferior={ajuste} className="r2-inv r2-inv-inventario">
      <BarcodeScannerIndicator isScanning={p.isScanning} />
      <EncabezadoPagina titulo="Inventario" dato={dato} principal={principal} secundarias={secundarias} masAcciones={mas}
        extra={!celular ? <IndicadorPistola activa /> : null} />
      {p.esAdministrador && p.permisosAlmacenAbiertos && !enInicio && (
        <Nota tono="aviso" className="r2-inv-aviso-permisos">Permisos de almacén abiertos: Almacén puede crear y editar artículos por completo.</Nota>
      )}
      {tira}
      <BarraFiltros
        busqueda={enInicio
          ? { valor: p.busquedaInicio, alCambiar: p.setBusquedaInicio, texto: textoBusqueda, etiqueta: 'Buscar en todos los almacenes', autoFoco: true,
            alEnter: () => {
              if (!p.resultadosInicio.length) return;
              const q = p.busquedaInicio.trim().toLowerCase();
              const exacto = p.resultadosInicio.find((a) => a.sku?.toLowerCase() === q || a.codigo_ean13?.toLowerCase() === q);
              if (exacto || p.resultadosInicio.length === 1) p.abrirDesdeBusquedaInicio(exacto || p.resultadosInicio[0]);
            } }
          : { valor: p.searchTerm, alCambiar: p.setSearchTerm, texto: textoBusqueda, etiqueta: 'Buscar en todos los almacenes', autoFoco: true }}
        filtros={filtros} activos={enInicio ? 0 : filtrosPuestos} alQuitar={quitarFiltros} orden={filtroOrden}
        resultados={enInicio ? undefined : conteoTabla} />
      {cuerpo}

      {ajuste && (
        <BarraAccion
          resumen={p.cambiosStockPendientes.length ? plural(p.cambiosStockPendientes.length, 'cambio sin guardar', 'cambios sin guardar') : 'Ajuste de existencias'}
          falta={p.cambiosStockPendientes.length ? null : 'Escribe la existencia nueva en la tabla'}
          principal={{ texto: p.cambiosStockPendientes.length ? `Guardar ${plural(p.cambiosStockPendientes.length, 'ajuste', 'ajustes')}` : 'Guardar',
            alHacer: p.handleGuardarAjustesStock, cargando: p.guardandoStocks }}
          secundaria={{ texto: 'Cancelar', alHacer: p.handleCancelarAjusteStock }} />
      )}

      {/* Diálogos: los mismos de hoy, con el mismo estado de la página (fuera de un almacén no se pintan, como hoy) */}
      {!enInicio && (
        <>
          <ArticuloDetalleModal articulo={articuloFresco} isOpen={p.modalDetalleOpen} onClose={() => p.setModalDetalleOpen(false)}
            onEdit={p.handleEditar} canEdit={p.puedeEditarArticulos} onEntrada={p.handleAbrirEntrada} onSalida={p.handleAbrirSalida}
            puedeGestionarInventario={p.puedeGestionarInventario} puedeRegistrarSalida={p.puedeRegistrarSalida}
            r2={{
              onAgregar: p.puedeAgregarAlPedido ? p.handleAgregarAlPedido : null,
              onDesactivar: p.puedeEditarArticulos && !p.mostrarDesactivados ? p.handleEliminar : null,
              onReactivar: p.puedeEditarArticulos && p.mostrarDesactivados ? p.handleReactivar : null,
              onEliminarPermanente: p.esAdministrador && p.mostrarDesactivados ? p.handleEliminarPermanente : null,
              esAlmacen: p.esAlmacen,
              puedeCambiar: p.puedeGestionarTaxonomia,
              alCambiar: p.handleQuickUpdate,
              actualizando: articuloFresco ? p.actualizandoArt.has(articuloFresco.id) : false,
              categorias: articuloFresco ? p.categoriasParaArticulo(articuloFresco) : [],
              ubicaciones: articuloFresco ? p.ubicacionesParaArticulo(articuloFresco) : [],
              secciones: p.secciones,
              nombreAlmacen: articuloFresco ? p.nombreAlmacenDe(articuloFresco) : '',
              marcaLocal: articuloFresco ? p.getSeccionArticulo(articuloFresco) : 'stock',
              alCambiarMarcaLocal: p.esAlmacen ? null : p.setSeccionArticulo,
              enConteo: articuloFresco ? p.articulosEnConteo.has(articuloFresco.id) : false,
            }} />
          <ArticuloFormModal isOpen={p.modalFormOpen} onClose={p.handleCloseForm} onSuccess={p.handleFormSuccess} articulo={p.articuloAEditar}
            codigoInicial={p.codigoEscaneado} permisosAlmacenAbiertos={p.permisosAlmacenAbiertos} mantenerPendiente={p.modoNuevosRegistros} />
          <Modal isOpen={p.showScanner} onClose={() => p.setShowScanner(false)} title="Escanear código de barras" size="xl">
            <EAN13Scanner onClose={() => p.setShowScanner(false)} />
          </Modal>
          <DialogoCantidad abierto={p.modalEntradaOpen} alCerrar={p.handleCerrarEntrada} titulo="Registrar entrada" nombre={ent?.nombre}
            datos={ent ? [['Existencia', existencia(ent)], ['Ubicación', ubicacionDe(ent)]] : []}
            etiqueta="Cantidad que entra" valor={p.cantidadEntrada} alCambiar={p.cambiarCantidadEntradaR2}
            paso={p.unidadEsEntera(ent?.unidad) ? '1' : '0.01'} unidad={ent ? unidadDe(ent) : null} alEnter={p.handleGuardarEntrada}
            observaciones={p.observacionesEntrada} alCambiarObservaciones={p.setObservacionesEntrada} ejemploObservaciones="Por ejemplo: llegó de proveedor sin orden"
            previa={previa(ent, p.cantidadEntrada, 1)}
            nota={p.esAlmacen ? 'Si el ajuste directo está apagado, la entrada se manda a Dirección para que la apruebe.' : null}
            boton={{ texto: num(p.cantidadEntrada) > 0 && ent ? `Registrar entrada de ${cantidad(num(p.cantidadEntrada), ent.unidad)}` : 'Registrar entrada',
              alHacer: p.handleGuardarEntrada, cargando: p.loadingEntrada, deshabilitado: p.loadingEntrada || !p.cantidadEntrada || num(p.cantidadEntrada) <= 0,
              motivo: 'Escribe una cantidad mayor a 0' }} />
          <DialogoCantidad abierto={p.modalSalidaOpen} alCerrar={p.handleCerrarSalida} titulo="Registrar salida" nombre={sal?.nombre}
            datos={sal ? [['Existencia', existencia(sal)], ['Ubicación', ubicacionDe(sal)]] : []}
            etiqueta="Cantidad que sale" valor={p.cantidadSalida} alCambiar={p.cambiarCantidadSalidaR2}
            paso={p.unidadEsEntera(sal?.unidad) ? '1' : '0.01'} unidad={sal ? unidadDe(sal) : null} alEnter={p.handleGuardarSalida}
            observaciones={p.observacionesSalida} alCambiarObservaciones={p.setObservacionesSalida} ejemploObservaciones="Motivo de la salida"
            previa={(() => { const x = previa(sal, p.cantidadSalida, -1); return x && x.tono ? { ...x, aviso: `Quedaría en ${x.despues} ${x.unidad}: sale más de lo que hay` } : x; })()}
            nota={p.esAlmacen ? 'Si el ajuste directo está apagado, la salida se manda a Dirección para que la apruebe.' : null}
            boton={{ texto: num(p.cantidadSalida) > 0 && sal ? `Registrar salida de ${cantidad(num(p.cantidadSalida), sal.unidad)}` : 'Registrar salida',
              alHacer: p.handleGuardarSalida, cargando: p.loadingSalida, deshabilitado: p.loadingSalida || !p.cantidadSalida || num(p.cantidadSalida) <= 0,
              motivo: 'Escribe una cantidad mayor a 0' }} />
          <CajonEtiquetas p={p} />
          {p.modalUnidadOpen && p.unidadSeleccionada && p.tipoHerramientaSeleccionado && (
            <UnidadHerramientaDetalleModal unidad={p.unidadSeleccionada} tipoHerramienta={p.tipoHerramientaSeleccionado} isOpen={p.modalUnidadOpen}
              onClose={() => { p.setModalUnidadOpen(false); p.setUnidadSeleccionada(null); p.setTipoHerramientaSeleccionado(null); }} />
          )}
          <CajonAlmacenes p={p} />
          <CajonTaxonomia tipo={taxonomia} alCerrar={() => setTaxonomia(null)} p={p} nombreAlmacen={nombreAlmacen} />
          <DialogosTaxonomia p={p} />
        </>
      )}
    </Pagina>
  );
}

// Inicio: buscador global (resultados al vuelo) o la lista de almacenes con lo que hay en cada uno.
function Inicio({ p, celular, elegirAlmacen, abrirNuevos, veNuevos, nPorAutorizar }) {
  const q = p.busquedaInicio.trim();
  if (q) {
    const lista = p.resultadosInicio;
    return (
      <Tabla etiqueta="Resultados de la búsqueda" filas={lista} clave="id" densidad="compacta"
        alAbrir={(a) => p.abrirDesdeBusquedaInicio(a)} etiquetaAbrir={(a) => `Abrir ${a.nombre} en su almacén`}
        columnas={[
          {
            id: 'articulo', titulo: 'Artículo', celda: (a) => (
              <span className="r2-inv-articulo">
                <Miniatura src={a.imagen_url ? p.getImageUrl(a.imagen_url) : null} alt={a.nombre} tamano={40} ampliable={false} />
                <span className="r2-inv-articulo-texto">
                  <span className="r2-inv-nombre">{a.nombre}</span>
                  <span className="r2-inv-desc">{a.sku ? `Clave ${a.sku}` : a.codigo_ean13 || ''}</span>
                </span>
              </span>
            ),
          },
          { id: 'almacen', titulo: 'Almacén', ancho: '16%', celda: (a) => p.nombreAlmacenDe(a) },
          { id: 'ubicacion', titulo: 'Ubicación', ancho: '12%', celda: (a) => <span className="r2-num">{a.ubicacion?.codigo || '—'}</span> },
          {
            id: 'existencia', titulo: 'Existencia', ancho: '14%', alinear: 'der', celda: (a) => {
              const est = estadoExistencia(a);
              return (
                <span className="r2-inv-existencia">
                  <span className={est ? `r2-inv-existencia-valor r2-tono--${est.tono}` : 'r2-inv-existencia-valor'}>{existencia(a)}</span>
                  {est && <Estado tono={est.tono} texto={est.texto} sinPunto className="r2-inv-existencia-estado" />}
                </span>
              );
            },
          },
          {
            id: 'estado', titulo: 'Estado', ancho: '16%', ocultarEn: 'tableta', celda: (a) => (
              a.activo === false ? <Estado tono="neutro" texto="Desactivado" /> : a.pendiente_revision ? <Estado tono="info" texto="Nuevo por autorizar" /> : null
            ),
          },
        ]}
        filaCelular={(a) => {
          const est = estadoExistencia(a);
          return {
            inicio: <Miniatura src={a.imagen_url ? p.getImageUrl(a.imagen_url) : null} alt={a.nombre} tamano={40} ampliable={false} />,
            principal: a.nombre,
            secundario: [p.nombreAlmacenDe(a), a.ubicacion?.codigo].filter(Boolean).join(' · '),
            derecha: existencia(a),
            debajo: a.activo === false ? <Estado tono="neutro" texto="Desactivado" /> : a.pendiente_revision ? <Estado tono="info" texto="Nuevo" />
              : est ? <Estado tono={est.tono} texto={est.texto} sinPunto /> : null,
          };
        }}
        vacio={<Vacio sinResultados busqueda={q} texto="Revisa la clave o prueba con otra parte del nombre." alQuitar={() => p.setBusquedaInicio('')} />} />
    );
  }

  const conteos = (alm) => {
    const del = p.articulos.filter((a) => a.activo === true && !a.pendiente_revision && delAlmacen(a, alm.id));
    return { bajo: del.filter(bajoMinimo).length, agotados: del.filter((a) => !a.es_herramienta && num(a.stock_actual) <= 0).length };
  };
  const filas = [
    ...p.almacenesDisponibles.map((a) => ({ ...a, _tipo: 'almacen', ...conteos(a) })),
    ...(veNuevos ? [{ id: 'nuevos', nombre: 'Nuevos por autorizar', _tipo: 'nuevos', articulos_count: nPorAutorizar }] : []),
  ];
  const abrir = (f) => (f._tipo === 'nuevos' ? abrirNuevos() : elegirAlmacen(f));
  return (
    <Tabla etiqueta="Almacenes" filas={filas} clave="id" densidad="comoda" alAbrir={abrir}
      etiquetaAbrir={(f) => `Ver los artículos de ${f.nombre}`}
      columnas={[
        {
          id: 'nombre', titulo: 'Almacén', celda: (f) => (
            <span className="r2-inv-almacen-celda">
              {f._tipo === 'nuevos' ? <PackagePlus size={20} aria-hidden="true" /> : f.nombre === 'Herramientas' ? <Wrench size={20} aria-hidden="true" /> : <Warehouse size={20} aria-hidden="true" />}
              <span>{f.nombre}</span>
            </span>
          ),
        },
        { id: 'articulos', titulo: 'Artículos', alinear: 'der', ancho: '14%', celda: (f) => (typeof f.articulos_count === 'number' ? numero(f.articulos_count) : '—') },
        { id: 'bajo', titulo: 'Bajo mínimo', alinear: 'der', ancho: '14%', celda: (f) => (f._tipo === 'nuevos' ? '' : f.bajo ? <span className="r2-tono--aviso r2-inv-cifra">{numero(f.bajo)}</span> : '0') },
        { id: 'agotados', titulo: 'Agotados', alinear: 'der', ancho: '14%', ocultarEn: 'celular-ancho', celda: (f) => (f._tipo === 'nuevos' ? '' : f.agotados ? <span className="r2-tono--mal r2-inv-cifra">{numero(f.agotados)}</span> : '0') },
      ]}
      accion={celular ? undefined : (f) => <Boton nivel="fantasma" tamano="chico" alHacer={() => abrir(f)}>{f._tipo === 'nuevos' ? 'Revisar' : 'Ver artículos'}</Boton>}
      filaCelular={(f) => ({
        principal: f.nombre,
        secundario: f._tipo === 'nuevos' ? 'Claves que esperan a Dirección' : `${numero(f.bajo || 0)} bajo mínimo · ${plural(f.agotados || 0, 'agotado', 'agotados')}`,
        derecha: typeof f.articulos_count === 'number' ? numero(f.articulos_count) : '',
        debajo: <span className="r2-inv-desc">{f._tipo === 'nuevos' ? 'por revisar' : 'artículos'}</span>,
      })}
      vacio={<Vacio icono={Warehouse} titulo="No hay almacenes disponibles" texto={p.esAdministrador ? 'Entra a un almacén para gestionar almacenes.' : 'Pide a Dirección que dé de alta un almacén.'} />} />
  );
}
