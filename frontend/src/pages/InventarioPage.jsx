import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import articulosService from '../services/articulos.service';
import movimientosService from '../services/movimientos.service';
import solicitudesCambioService from '../services/solicitudesCambio.service';
import categoriasService from '../services/categorias.service';
import ubicacionesService from '../services/ubicaciones.service';
import seccionesService from '../services/secciones.service';
import almacenesService from '../services/almacenes.service';
import herramientasRentaService from '../services/herramientasRenta.service';
import conteosCiclicosService from '../services/conteosCiclicos.service';
import configuracionService from '../services/configuracion.service';
import toast from 'react-hot-toast';
import { usePedido } from '../context/PedidoContext';
import { useAuth } from '../context/AuthContext';
import { getImageUrl } from '../utils/imageUtils';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { rolPuedeVer } from '../components/layout/Sidebar';
import { confirmarG3 } from '../diseno-3g/dialogosG3';
import VistaInventario from '../rediseno2/inventario/VistaInventario';

/**
 * Formatea la cantidad según la unidad de medida
 * - kg, litros, metros, m², m³: muestra 2 decimales
 * - piezas, cajas, unidades: muestra sin decimales
 */
// Unidades que admiten decimales; cualquier otra (piezas, cajas, unidades…) es entera.
// Case-insensitive: la unidad se guarda en MAYÚSCULAS ("PIEZAS").
const UNIDADES_CON_DECIMALES = ['kg', 'litros', 'metros', 'm²', 'm³', 'gramos', 'ml', 'cm', 'mm'];
const unidadEsEntera = (unidad) => {
  const u = (unidad || '').toLowerCase();
  return !UNIDADES_CON_DECIMALES.some(x => u.includes(x));
};
// Quita los decimales de un texto numérico cuando la unidad es entera (piezas).
const sanitizarCantidad = (value, unidad) => {
  if (value === '' || value == null || !unidadEsEntera(unidad)) return value;
  return String(value).replace(/[.,].*$/, '');
};

const formatearCantidad = (cantidad, unidad) => {
  const valor = parseFloat(cantidad);
  // Para piezas y otras unidades enteras, sin decimales
  return unidadEsEntera(unidad) ? valor.toFixed(0) : valor.toFixed(2);
};
const DEFAULT_COL_WIDTHS = { articulo: 300, categoria: 140, ubicacion: 140, stockTotal: 100, seccion: 130, unidad: 80, acciones: 240 };
const STORAGE_KEY_COL_WIDTHS = 'inventario_col_widths_v3';
const STORAGE_KEY_EXTRAS = 'inventario_extras_v1';

const InventarioPage = () => {
  const [articulos, setArticulos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  // Valor de búsqueda diferido: el input se actualiza al instante (searchTerm) pero el
  // filtrado pesado usa este valor diferido, para que escribir no se sienta trabado.
  const deferredSearchTerm = React.useDeferredValue(searchTerm);
  // Buscador de la pantalla "¿Qué deseas consultar?": encuentra un SKU en
  // cualquier almacén sin tener que entrar a cada uno.
  const [busquedaInicio, setBusquedaInicio] = useState('');
  const busquedaInicioDiferida = React.useDeferredValue(busquedaInicio);
  const [articuloEncontradoPorCodigo, setArticuloEncontradoPorCodigo] = useState(null); // Guardar artículo encontrado por código
  const [herramientasEncontradasPorCodigo, setHerramientasEncontradasPorCodigo] = useState([]); // Herramientas encontradas por búsqueda parcial
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState(null);
  const [almacenSeleccionado, setAlmacenSeleccionado] = useState(null); // Filtro de almacén (ID o null = gate sin seleccionar)
  const [seccionSeleccionada, setSeccionSeleccionada] = useState(null); // 'stock' | 'extras' | null (gate)
  const [extrasIds, setExtrasIds] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EXTRAS);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [almacenesData, setAlmacenesData] = useState([]); // Almacenes desde la API
  const [todasCategorias, setTodasCategorias] = useState([]); // Todas las categorías (para edición rápida)
  const [todasUbicaciones, setTodasUbicaciones] = useState([]); // Todas las ubicaciones con su almacén (para edición rápida)
  const [actualizandoArt, setActualizandoArt] = useState(new Set()); // IDs siendo actualizados
  // NUEVOS REGISTROS: almacén elegido localmente por fila (filtra ubicación/sección
  // antes de autorizar) e IDs que se están autorizando.
  const [nuevosAlmacenSel, setNuevosAlmacenSel] = useState({}); // { [itemId]: almacenId }
  const [autorizandoNuevos, setAutorizandoNuevos] = useState(new Set());
  // Interruptor global "edición completa de almacén" (leído del backend)
  const [permisosAlmacenAbiertos, setPermisosAlmacenAbiertos] = useState(false);
  const [cambiandoPermisosAlmacen, setCambiandoPermisosAlmacen] = useState(false);
  const [modoAjusteStock, setModoAjusteStock] = useState(false); // Modo edición rápida de stocks (solo admin)
  const [stocksEditados, setStocksEditados] = useState({}); // id → nuevo valor (pendiente de guardar)
  const [guardandoStocks, setGuardandoStocks] = useState(false);
  const [recienActualizados, setRecienActualizados] = useState(new Set()); // IDs recién modificados (resaltado temporal)

  // Marca artículos como recién actualizados (resaltado verde) y limpia la marca tras unos segundos
  const marcarRecienActualizados = useCallback((ids) => {
    setRecienActualizados(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
    setTimeout(() => {
      setRecienActualizados(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    }, 10000);
  }, []);
  const [tabActivo, setTabActivo] = useState('consumibles'); // Nuevo: 'consumibles' o 'herramientas'
  const [mostrarDesactivados, setMostrarDesactivados] = useState(false);

  // Anchos de columna redimensionables (estilo Excel), persistidos en localStorage
  const [colWidths, setColWidths] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COL_WIDTHS);
      return saved ? { ...DEFAULT_COL_WIDTHS, ...JSON.parse(saved) } : DEFAULT_COL_WIDTHS;
    } catch { return DEFAULT_COL_WIDTHS; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_COL_WIDTHS, JSON.stringify(colWidths)); } catch {}
  }, [colWidths]);

  // Persistir IDs marcados como "Extras"
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_EXTRAS, JSON.stringify(Array.from(extrasIds))); } catch {}
  }, [extrasIds]);

  // Helpers para sección Stock / Extras
  const getSeccionArticulo = useCallback((item) => (
    extrasIds.has(item.id) ? 'extras' : 'stock'
  ), [extrasIds]);

  const setSeccionArticulo = useCallback((itemId, seccion) => {
    setExtrasIds(prev => {
      const next = new Set(prev);
      if (seccion === 'extras') next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }, []);

  const resetColWidths = useCallback(() => setColWidths(DEFAULT_COL_WIDTHS), []);
  const [ordenamiento, setOrdenamiento] = useState('nombre-asc');
  const [articuloSeleccionado, setArticuloSeleccionado] = useState(null);
  const [articuloAEditar, setArticuloAEditar] = useState(null);
  const [codigoEscaneado, setCodigoEscaneado] = useState(null);
  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [modalFormOpen, setModalFormOpen] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [modalEntradaOpen, setModalEntradaOpen] = useState(false);
  const [articuloParaEntrada, setArticuloParaEntrada] = useState(null);
  const [cantidadEntrada, setCantidadEntrada] = useState('');
  const [observacionesEntrada, setObservacionesEntrada] = useState('');
  const [loadingEntrada, setLoadingEntrada] = useState(false);
  const [modalSalidaOpen, setModalSalidaOpen] = useState(false);
  const [articuloParaSalida, setArticuloParaSalida] = useState(null);
  const [cantidadSalida, setCantidadSalida] = useState('');
  const [observacionesSalida, setObservacionesSalida] = useState('');
  const [loadingSalida, setLoadingSalida] = useState(false);

  // Estados para generación de etiquetas
  const [modalEtiquetasOpen, setModalEtiquetasOpen] = useState(false);
  const [articulosSeleccionadosEtiquetas, setArticulosSeleccionadosEtiquetas] = useState([]);
  const [unidadesSeleccionadasEtiquetas, setUnidadesSeleccionadasEtiquetas] = useState([]);
  const [busquedaEtiquetas, setBusquedaEtiquetas] = useState('');
  const [filtroTipoEtiquetas, setFiltroTipoEtiquetas] = useState('todos'); // 'todos', 'consumibles', 'herramientas'
  const [loadingEtiquetas, setLoadingEtiquetas] = useState(false);
  const [herramientasExpandidasEtiquetas, setHerramientasExpandidasEtiquetas] = useState({});
  const [unidadesCargadasEtiquetas, setUnidadesCargadasEtiquetas] = useState({});
  const [filtroUbicacionEtiquetas, setFiltroUbicacionEtiquetas] = useState('todos'); // Filtro por ubicación
  const [filtroEstadoEtiquetado, setFiltroEstadoEtiquetado] = useState('todos'); // 'todos', 'etiquetados', 'sin_etiquetar'

  // Estados para expansión de herramientas y sus unidades
  const [herramientasExpandidas, setHerramientasExpandidas] = useState({});
  const [unidadesHerramientas, setUnidadesHerramientas] = useState({});
  const [loadingUnidades, setLoadingUnidades] = useState({});

  // Estados para modal de detalle de unidad de herramienta
  const [unidadSeleccionada, setUnidadSeleccionada] = useState(null);
  const [tipoHerramientaSeleccionado, setTipoHerramientaSeleccionado] = useState(null);
  const [modalUnidadOpen, setModalUnidadOpen] = useState(false);

  // Estados para gestión de categorías
  const [modalCategoriaOpen, setModalCategoriaOpen] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState(null);
  const [nombreCategoria, setNombreCategoria] = useState('');
  const [loadingCategoria, setLoadingCategoria] = useState(false);
  const [categoriaDropdownOpen, setCategoriaDropdownOpen] = useState(false);
  const [categoriaEditMode, setCategoriaEditMode] = useState(false);
  const categoriaDropdownRef = useRef(null);

  // Estados para gestión de ubicaciones
  const [modalUbicacionOpen, setModalUbicacionOpen] = useState(false);
  const [ubicacionEditando, setUbicacionEditando] = useState(null);
  const [codigoUbicacion, setCodigoUbicacion] = useState('');
  const [almacenUbicacion, setAlmacenUbicacion] = useState('');
  const [pasilloUbicacion, setPasilloUbicacion] = useState('');
  const [estanteUbicacion, setEstanteUbicacion] = useState('');
  const [nivelUbicacion, setNivelUbicacion] = useState('');
  const [descripcionUbicacion, setDescripcionUbicacion] = useState('');
  const [loadingUbicacion, setLoadingUbicacion] = useState(false);
  const [ubicacionDropdownOpen, setUbicacionDropdownOpen] = useState(false);
  const [ubicacionEditMode, setUbicacionEditMode] = useState(false);
  const ubicacionDropdownRef = useRef(null);

  // Estados para gestión de secciones (solo almacén "Herramientas")
  const [secciones, setSecciones] = useState([]);
  const [todasSecciones, setTodasSecciones] = useState([]);
  const [modalSeccionOpen, setModalSeccionOpen] = useState(false);
  const [seccionEditando, setSeccionEditando] = useState(null);
  const [nombreSeccion, setNombreSeccion] = useState('');
  const [loadingSeccion, setLoadingSeccion] = useState(false);
  const [seccionDropdownOpen, setSeccionDropdownOpen] = useState(false);
  const [seccionEditMode, setSeccionEditMode] = useState(false);
  const seccionDropdownRef = useRef(null);
  const [almacenSeccionForm, setAlmacenSeccionForm] = useState(null); // almacén destino al crear sección en modo herramientas

  // Estados para gestión de almacenes
  const [modalAlmacenesOpen, setModalAlmacenesOpen] = useState(false);
  const [almacenEditando, setAlmacenEditando] = useState(null);
  const [nuevoNombreAlmacen, setNuevoNombreAlmacen] = useState('');
  const [loadingAlmacenes, setLoadingAlmacenes] = useState(false);
  const [almacenCategoriasExpandido, setAlmacenCategoriasExpandido] = useState(null); // ID del almacén con categorías expandidas
  const [todasLasCategorias, setTodasLasCategorias] = useState([]); // Todas las categorías del sistema
  const [loadingToggleCategoria, setLoadingToggleCategoria] = useState(false);

  const { agregarArticulo } = usePedido();
  const { user } = useAuth();
  const [errorCargaR2, setErrorCargaR2] = useState(null);

  // Verificar permisos según el rol
  const puedeCrearArticulos = ['administrador', 'encargado', 'almacen'].includes(user?.rol);
  const puedeEditarArticulos = ['administrador', 'encargado', 'almacen'].includes(user?.rol);
  const puedeAgregarAlPedido = ['administrador', 'diseñador'].includes(user?.rol);
  const puedeGestionarInventario = ['administrador', 'encargado', 'almacen'].includes(user?.rol);
  const puedeRegistrarSalida = ['administrador', 'almacen'].includes(user?.rol); // Almacén puede registrar salidas
  const esAdministrador = user?.rol === 'administrador';
  const esAlmacen = user?.rol === 'almacen';
  // Interruptor global (lo gestiona el admin): cuando está activo, almacén puede
  // editar los artículos por completo (categoría, ubicación, sección, stock, unidad,
  // proveedor, descripción, foto). Los SKUs nuevos siguen entrando a Nuevos Registros.
  const almacenConPermisos = esAlmacen && permisosAlmacenAbiertos;
  // Taxonomía (categorías, ubicaciones, secciones): admin/encargado siempre; almacén
  // solo cuando el admin le abre los permisos.
  const puedeGestionarTaxonomia = ['administrador', 'encargado'].includes(user?.rol) || almacenConPermisos;
  // Ajuste rápido de stock: admin siempre; almacén cuando tiene permisos abiertos.
  const puedeAjustarStock = esAdministrador || almacenConPermisos;

  // NUEVOS REGISTROS: SKUs creados por almacén pendientes de revisión del admin.
  // 'nuevos' es un valor centinela de almacenSeleccionado (no es un almacén real).
  const modoNuevosRegistros = almacenSeleccionado === 'nuevos';
  const articulosPendientesRevision = React.useMemo(
    () => articulos.filter(a => a.pendiente_revision === true && a.activo !== false),
    [articulos]
  );

  // Estado para artículos en conteo cíclico activo
  const [articulosEnConteo, setArticulosEnConteo] = useState(new Set());

  useEffect(() => {
    fetchArticulos();
    fetchAlmacenes();
    fetchCategorias();
    fetchUbicaciones();
    fetchArticulosConteo();
    fetchTodasCategorias();
    fetchTodasUbicaciones();
    fetchTodasSecciones();
  }, []);

  // Cerrar dropdowns de categorías/ubicaciones/secciones al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (categoriaDropdownRef.current && !categoriaDropdownRef.current.contains(e.target)) {
        setCategoriaDropdownOpen(false);
        setCategoriaEditMode(false);
      }
      if (ubicacionDropdownRef.current && !ubicacionDropdownRef.current.contains(e.target)) {
        setUbicacionDropdownOpen(false);
        setUbicacionEditMode(false);
      }
      if (seccionDropdownRef.current && !seccionDropdownRef.current.contains(e.target)) {
        setSeccionDropdownOpen(false);
        setSeccionEditMode(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-refresh: cada 30s y al volver a la pestaña (para que almacén
  // vea cambios que admin aplica desde su panel de solicitudes).
  // Silencioso — no parpadea el loader ni rompe el scroll.
  useEffect(() => {
    const refrescar = () => fetchArticulos({ silent: true });
    const interval = setInterval(refrescar, 30000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refrescar();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refrescar);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refrescar);
    };
  }, []);

  const fetchTodasCategorias = async () => {
    try {
      const data = await categoriasService.getAll();
      setTodasCategorias(Array.isArray(data) ? data : []);
    } catch (e) { console.error('Error cargando todas las categorías:', e); }
  };

  const fetchTodasUbicaciones = async () => {
    try {
      const data = await ubicacionesService.getAll();
      setTodasUbicaciones(Array.isArray(data) ? data : []);
    } catch (e) { console.error('Error cargando todas las ubicaciones:', e); }
  };

  const fetchTodasSecciones = async () => {
    try {
      const data = await seccionesService.getAll();
      setTodasSecciones(Array.isArray(data) ? data : []);
    } catch (e) { console.error('Error cargando secciones:', e); }
  };

  const fetchSecciones = async (almacenId = null) => {
    try {
      const data = await seccionesService.getAll(almacenId);
      setSecciones(Array.isArray(data) ? data : []);
    } catch (e) { console.error('Error cargando secciones del almacén:', e); }
  };

  const handleQuickUpdate = async (item, field, value, opts = {}) => {
    // mantenerPendiente: en "Nuevos Registros" el admin edita los campos sin que el
    // SKU se marque como revisado (y por tanto sin que desaparezca de la lista); se
    // autoriza aparte con el botón. Sin esta bandera, el backend marca revisado.
    const { mantenerPendiente = false } = opts;
    const parsed = value === '' ? null : Number(value);
    if (item[field] === parsed) return;

    // Almacén: cambio de ubicación requiere aprobación de admin, SALVO que el admin
    // le haya abierto los permisos (entonces lo aplica directo como cualquier edición).
    if (esAlmacen && !permisosAlmacenAbiertos && field === 'ubicacion_id') {
      try {
        await solicitudesCambioService.crear({
          tipo: 'cambio_ubicacion',
          articulo_id: item.id,
          payload: { ubicacion_id: parsed }
        });
        toast.success('Solicitud de cambio de ubicación enviada al administrador');
      } catch (err) {
        console.error(err);
        toast.error(err.response?.data?.message || 'Error al enviar solicitud');
      }
      return;
    }

    setActualizandoArt(prev => new Set(prev).add(item.id));
    try {
      const resp = await articulosService.update(item.id, { [field]: parsed, ...(mantenerPendiente && { mantener_pendiente: true }) });
      // El backend devuelve el artículo ya hidratado (con su categoría/ubicación).
      // Lo usamos como fuente de verdad para que el cambio se refleje al instante,
      // incluso si la categoría se acaba de crear y aún no está en la caché local.
      const art = resp?.articulo || resp || null;
      // Actualizar localmente sin refetch completo
      setArticulos(prev => prev.map(a => {
        if (a.id !== item.id) return a;
        const updated = { ...a, [field]: parsed, updatedAt: new Date().toISOString() };
        if (field === 'categoria_id') {
          updated.categoria = art?.categoria
            || todasCategorias.find(c => String(c.id) === String(parsed)) || null;
        } else if (field === 'ubicacion_id') {
          // Se usa la caché local (trae almacen_id, necesario para derivar el almacén
          // del artículo); la respuesta del backend no incluye esa relación anidada.
          updated.ubicacion = todasUbicaciones.find(u => String(u.id) === String(parsed)) || null;
        } else if (field === 'seccion_id') {
          updated.seccion = todasSecciones.find(s => String(s.id) === String(parsed)) || null;
        }
        return updated;
      }));
      marcarRecienActualizados([item.id]);
      toast.success('Artículo actualizado');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Error al actualizar');
    } finally {
      setActualizandoArt(prev => { const n = new Set(prev); n.delete(item.id); return n; });
    }
  };

  // ============ PERMISOS DE ALMACÉN (interruptor global, solo admin) ============
  // Todos los usuarios leen el flag (almacén necesita saber si tiene permisos abiertos).
  useEffect(() => {
    let cancelado = false;
    configuracionService.obtener()
      .then(res => { if (!cancelado) setPermisosAlmacenAbiertos(!!res?.data?.almacen_edicion_completa); })
      .catch(() => {});
    return () => { cancelado = true; };
  }, []);

  const togglePermisosAlmacen = async () => {
    const nuevo = !permisosAlmacenAbiertos;
    if (nuevo) {
      if (!(await confirmarG3({
        titulo: '¿Abrir permisos de almacén?',
        aviso: 'Almacén podrá crear y editar artículos por completo: categoría, ubicación, sección, stock, unidad, proveedor, descripción y foto.',
        pasa: ['Las claves nuevas seguirán pasando por «Nuevos registros».'],
        confirmar: 'Abrir permisos', cancelar: 'No abrir',
      }))) return;
    }
    try {
      setCambiandoPermisosAlmacen(true);
      const res = await configuracionService.setEdicionAlmacen(nuevo);
      setPermisosAlmacenAbiertos(!!res?.data?.almacen_edicion_completa);
      toast.success(res?.message || (nuevo ? 'Permisos de almacén abiertos' : 'Permisos de almacén restringidos'));
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'No se pudo cambiar la configuración');
    } finally {
      setCambiandoPermisosAlmacen(false);
    }
  };

  // ============ NUEVOS REGISTROS: autorizar (cargar al inventario) ============
  // Helpers para el almacén elegido por fila y las opciones filtradas.
  const almacenNuevoDe = (item) => (
    nuevosAlmacenSel[item.id] ?? item.ubicacion?.almacen_id ?? item.ubicacion?.almacen_ref?.id ?? ''
  );
  const ubicacionesDeAlmacen = (almacenId) => (
    !almacenId ? [] : todasUbicaciones.filter(u => String(u.almacen_id) === String(almacenId))
  );
  const seccionesDeAlmacen = (almacenId) => (
    !almacenId ? [] : todasSecciones.filter(s => String(s.almacen_id) === String(almacenId))
  );

  // Al elegir almacén: guardar selección local (re-scopea ubicación/sección).
  const handleNuevoAlmacenChange = (item, value) => {
    setNuevosAlmacenSel(prev => ({ ...prev, [item.id]: value === '' ? null : Number(value) }));
  };

  // Autorizar: valida ubicación + sección y marca el SKU como revisado (sale de la lista).
  const handleAutorizarNuevo = async (item) => {
    if (!item.ubicacion_id) {
      toast.error('Asigna una ubicación antes de autorizar');
      return;
    }
    if (!item.seccion_id) {
      toast.error('Asigna una sección antes de autorizar');
      return;
    }
    setAutorizandoNuevos(prev => new Set(prev).add(item.id));
    try {
      await articulosService.update(item.id, { pendiente_revision: false });
      // Sale de "Nuevos Registros" (el filtro exige pendiente_revision === true)
      setArticulos(prev => prev.map(a =>
        a.id === item.id ? { ...a, pendiente_revision: false, updatedAt: new Date().toISOString() } : a
      ));
      setNuevosAlmacenSel(prev => { const n = { ...prev }; delete n[item.id]; return n; });
      toast.success(`"${item.nombre}" cargado al inventario`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Error al autorizar el artículo');
    } finally {
      setAutorizandoNuevos(prev => { const n = new Set(prev); n.delete(item.id); return n; });
    }
  };

  // ============ AJUSTE RÁPIDO DE STOCKS (solo admin, guardado en lote) ============
  // Los cambios se acumulan localmente y se guardan todos juntos al presionar "Guardar"

  const handleStockEditChange = (item, value) => {
    // Piezas (unidad entera): no permitir decimales al escribir.
    const limpio = sanitizarCantidad(value, item.unidad);
    setStocksEditados(prev => {
      const next = { ...prev };
      // Si el valor vuelve a ser el original, descartar el cambio pendiente
      if (limpio !== '' && parseFloat(limpio) === parseFloat(item.stock_actual)) {
        delete next[item.id];
      } else {
        next[item.id] = limpio;
      }
      return next;
    });
  };

  // Cambios válidos pendientes de guardar (con delta ≠ 0)
  const cambiosStockPendientes = React.useMemo(() => {
    return Object.entries(stocksEditados)
      .map(([id, valor]) => {
        const art = articulos.find(a => a.id === Number(id));
        if (!art || valor === '') return null;
        const nuevo = parseFloat(valor);
        if (isNaN(nuevo) || nuevo < 0) return null;
        const delta = nuevo - parseFloat(art.stock_actual);
        if (delta === 0) return null;
        return { articulo: art, nuevo, delta };
      })
      .filter(Boolean);
  }, [stocksEditados, articulos]);

  const handleCancelarAjusteStock = () => {
    // Diseño 3G encendido: vista previa con la lista de cambios que se pierden (no manda nada al servidor).
    if (cambiosStockPendientes.length > 0) {
      const pendientes = cambiosStockPendientes;
      confirmarG3({
        titulo: `¿Descartar ${pendientes.length} cambio${pendientes.length !== 1 ? 's' : ''} sin guardar?`,
        texto: 'Los stocks que escribiste no se guardan; el inventario queda como está.',
        cambios: pendientes.slice(0, 12).map((c) => ({ campo: c.articulo.nombre, antes: String(parseFloat(c.articulo.stock_actual)), despues: String(c.nuevo) })),
        datos: pendientes.length > 12 ? [['Y además', `${pendientes.length - 12} cambio${pendientes.length - 12 !== 1 ? 's' : ''} más`]] : undefined,
        confirmar: 'Descartar cambios', cancelar: 'Seguir editando', peligro: true,
      }).then((si) => {
        if (!si) return;
        setModoAjusteStock(false);
        setStocksEditados({});
      });
      return;
    }
    if (cambiosStockPendientes.length > 0 &&
      !window.confirm(`Hay ${cambiosStockPendientes.length} cambio(s) sin guardar. ¿Descartar?`)) {
      return;
    }
    setModoAjusteStock(false);
    setStocksEditados({});
  };

  const handleGuardarAjustesStock = async () => {
    if (cambiosStockPendientes.length === 0) {
      setModoAjusteStock(false);
      setStocksEditados({});
      return;
    }

    setGuardandoStocks(true);
    try {
      const entradas = cambiosStockPendientes.filter(c => c.delta > 0);
      const salidas = cambiosStockPendientes.filter(c => c.delta < 0);

      // Registrar como movimientos de ajuste para mantener el historial
      if (entradas.length > 0) {
        await movimientosService.create({
          tipo: 'ajuste_entrada',
          articulos: entradas.map(c => ({
            articulo_id: c.articulo.id,
            cantidad: c.delta,
            observaciones: `Ajuste rápido: ${formatearCantidad(c.articulo.stock_actual, c.articulo.unidad)} → ${formatearCantidad(c.nuevo, c.articulo.unidad)}`
          })),
          observaciones: 'Ajuste rápido de stocks desde inventario'
        });
      }
      if (salidas.length > 0) {
        await movimientosService.create({
          tipo: 'ajuste_salida',
          articulos: salidas.map(c => ({
            articulo_id: c.articulo.id,
            cantidad: Math.abs(c.delta),
            observaciones: `Ajuste rápido: ${formatearCantidad(c.articulo.stock_actual, c.articulo.unidad)} → ${formatearCantidad(c.nuevo, c.articulo.unidad)}`
          })),
          observaciones: 'Ajuste rápido de stocks desde inventario'
        });
      }

      // Actualizar localmente sin refetch completo
      const nuevosPorId = Object.fromEntries(cambiosStockPendientes.map(c => [c.articulo.id, c.nuevo]));
      const ahoraISO = new Date().toISOString();
      setArticulos(prev => prev.map(a =>
        nuevosPorId[a.id] !== undefined ? { ...a, stock_actual: nuevosPorId[a.id], updatedAt: ahoraISO } : a
      ));
      marcarRecienActualizados(Object.keys(nuevosPorId).map(Number));

      toast.success(`${cambiosStockPendientes.length} stock(s) ajustado(s) correctamente`);
      setModoAjusteStock(false);
      setStocksEditados({});
    } catch (error) {
      console.error('Error al guardar ajustes de stock:', error);
      toast.error(error.response?.data?.message || 'Error al guardar los ajustes de stock');
      // Re-sincronizar por si algún movimiento sí alcanzó a aplicarse
      fetchArticulos({ silent: true });
    } finally {
      setGuardandoStocks(false);
    }
  };

  // Ubicaciones agrupadas por almacén para el dropdown
  // Aislamiento por almacén: cada almacén tiene SUS propias categorías y ubicaciones.
  // Los filtros de la barra superior muestran solo las del almacén seleccionado
  // (cuando hay uno concreto); si no, caen a la lista completa como respaldo.
  const categoriasAlmacenSel = React.useMemo(() => (
    typeof almacenSeleccionado === 'number'
      ? todasCategorias.filter(c => String(c.almacen_id) === String(almacenSeleccionado))
      : todasCategorias
  ), [todasCategorias, almacenSeleccionado]);
  const ubicacionesAlmacenSel = React.useMemo(() => (
    typeof almacenSeleccionado === 'number'
      ? todasUbicaciones.filter(u => String(u.almacen_id) === String(almacenSeleccionado))
      : todasUbicaciones
  ), [todasUbicaciones, almacenSeleccionado]);

  // Helper: hay un almacén seleccionado donde aplican las secciones
  const esAlmacenConSecciones = React.useMemo(() => {
    return typeof almacenSeleccionado === 'number';
  }, [almacenSeleccionado]);

  // Secciones del almacén del artículo (para select inline)
  const seccionesParaArticulo = (item) => {
    const almacenId = item?.ubicacion?.almacen_id
      ?? item?.ubicacion?.almacen_ref?.id
      ?? (typeof almacenSeleccionado === 'number' ? almacenSeleccionado : null);
    if (!almacenId) return [];
    return todasSecciones.filter(s => s.almacen_id === almacenId);
  };

  // Categorías de un almacén concreto (para "Nuevos Registros", donde cada fila
  // puede pertenecer a un almacén distinto). Espejo de ubicacionesDeAlmacen/seccionesDeAlmacen.
  const categoriasDeAlmacen = (almacenId) => (
    !almacenId ? [] : todasCategorias.filter(c => String(c.almacen_id) === String(almacenId))
  );

  // Categorías del almacén del artículo (para select inline). Deriva el almacén del
  // propio artículo y cae al almacén seleccionado, igual que seccionesParaArticulo.
  const categoriasParaArticulo = (item) => {
    const almacenId = item?.ubicacion?.almacen_id
      ?? item?.ubicacion?.almacen_ref?.id
      ?? (typeof almacenSeleccionado === 'number' ? almacenSeleccionado : null);
    // Base: categorías del almacén del artículo. Si el almacén no se puede derivar
    // (SKU sin ubicación asignada), NO dejar el selector vacío: mostrar todas.
    const base = almacenId
      ? todasCategorias.filter(c => String(c.almacen_id) === String(almacenId))
      : todasCategorias;
    // Garantizar SIEMPRE que la categoría actual del SKU esté presente, aunque
    // pertenezca a otro almacén (datos legacy / mismatch tras el aislamiento).
    // Sin esto el selector aparece en blanco y "no se puede actualizar".
    if (item?.categoria_id && !base.some(c => String(c.id) === String(item.categoria_id))) {
      const actual = todasCategorias.find(c => String(c.id) === String(item.categoria_id));
      if (actual) return [actual, ...base];
    }
    return base;
  };

  // Ubicaciones del almacén del artículo (para select inline).
  const ubicacionesParaArticulo = (item) => {
    const almacenId = item?.ubicacion?.almacen_id
      ?? item?.ubicacion?.almacen_ref?.id
      ?? (typeof almacenSeleccionado === 'number' ? almacenSeleccionado : null);
    if (!almacenId) return [];
    return todasUbicaciones.filter(u => String(u.almacen_id) === String(almacenId));
  };

  // Cuando cambia el almacén seleccionado, recargar categorías, ubicaciones y secciones filtradas
  useEffect(() => {
    if (almacenSeleccionado === null) return; // Gate activo, no fetchear
    if (almacenSeleccionado === 'nuevos') return; // NUEVOS REGISTROS no es un almacén real
    fetchCategorias(almacenSeleccionado);
    fetchUbicaciones(almacenSeleccionado);
    fetchSecciones(almacenSeleccionado);
    // Limpiar filtros al cambiar almacén
    setCategoriaSeleccionada(null);
    setUbicacionSeleccionada(null);
  }, [almacenSeleccionado]);

  const fetchArticulos = async (opts = {}) => {
    const { silent = false } = opts;
    try {
      if (!silent) setLoading(true);
      const data = await articulosService.getAll();
      setArticulos(Array.isArray(data) ? data : []);
      setErrorCargaR2(null);
    } catch (error) {
      console.error('Error al cargar artículos:', error);
      if (!silent) setErrorCargaR2(error?.message || 'Error al cargar el inventario');
      if (!silent) toast.error('Error al cargar el inventario');
      if (!silent) setArticulos([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchAlmacenes = async () => {
    try {
      const data = await almacenesService.getAll();
      setAlmacenesData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error al cargar almacenes:', error);
    }
  };

  const fetchCategorias = async (almacenId = null) => {
    try {
      const data = await categoriasService.getAll(almacenId);
      setCategorias(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error al cargar categorías:', error);
    }
  };

  const fetchUbicaciones = async (almacenId = null) => {
    try {
      const data = await ubicacionesService.getAll(almacenId);
      setUbicaciones(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error al cargar ubicaciones:', error);
    }
  };

  // Cargar IDs de artículos en el conteo cíclico activo
  const fetchArticulosConteo = async () => {
    try {
      const response = await conteosCiclicosService.getArticulosEnConteoActivo();
      if (response.success && response.data?.articulo_ids) {
        setArticulosEnConteo(new Set(response.data.articulo_ids));
      }
    } catch (error) {
      // Silencioso - no bloquea la funcionalidad principal
      console.log('Conteo cíclico no disponible');
    }
  };

  // Lista de almacenes disponibles (desde la API)
  const almacenesDisponibles = React.useMemo(() => {
    return almacenesData.filter(a => a.activo !== false);
  }, [almacenesData]);

  // Buscar herramienta por código único cuando se detecta el patrón
  useEffect(() => {
    const buscarHerramientaPorCodigo = async () => {
      // Detectar si el searchTerm tiene formato de código de herramienta
      // Ahora acepta prefijos alfanuméricos como PP2-, AD1-, LL-, LC-, etc.
      const patronCodigoCompleto = /^[A-Z0-9]{2,4}-\d{1,4}$/i;
      const patronCodigoParcial = /^[A-Z0-9]{2,4}-/i;

      // Normalizar el código: convertir apóstrofes y caracteres similares a guión
      // El lector QR a veces lee ' en lugar de -
      const codigo = searchTerm.trim().toUpperCase().replace(/['`´]/g, '-');

      // Si no es un código de herramienta, limpiar resultados
      if (!codigo || !patronCodigoParcial.test(codigo)) {
        setHerramientasEncontradasPorCodigo([]);
        setArticuloEncontradoPorCodigo(null);
        return;
      }

      // Cambiar al tab de herramientas cuando detecta el patrón
      if (tabActivo !== 'herramientas') {
        setTabActivo('herramientas');
      }

      // Hacer búsqueda parcial mientras el usuario escribe
      try {
        const response = await api.get(`/articulos/buscar-herramienta/${codigo}?partial=true`);

        if (response.data.success && response.data.data.articulos) {
          const articulosEncontrados = response.data.data.articulos;

          // Guardar los artículos encontrados
          setHerramientasEncontradasPorCodigo(articulosEncontrados);

          // Si el código está completo y solo hay 1 resultado, resaltarlo
          if (patronCodigoCompleto.test(codigo) && articulosEncontrados.length > 0) {
            // Buscar la coincidencia exacta
            const coincidenciaExacta = articulosEncontrados.find(art =>
              art.unidades_coincidentes?.some(u => u.codigo_unico.toUpperCase() === codigo)
            );

            if (coincidenciaExacta) {
              setArticuloEncontradoPorCodigo(coincidenciaExacta.id);
              const unidadExacta = coincidenciaExacta.unidades_coincidentes.find(
                u => u.codigo_unico.toUpperCase() === codigo
              );
              toast.success(
                `Herramienta encontrada: ${unidadExacta.codigo_unico} - ${coincidenciaExacta.nombre} (${unidadExacta.estado})`
              );
            }
          }
        }
      } catch (error) {
        console.log('Error en búsqueda parcial:', error);
        setHerramientasEncontradasPorCodigo([]);
      }
    };

    // Debounce para no hacer búsquedas en cada tecla
    const timer = setTimeout(() => {
      buscarHerramientaPorCodigo();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, tabActivo]);

  // Limpiar artículo encontrado cuando se cambian filtros
  useEffect(() => {
    setArticuloEncontradoPorCodigo(null);
  }, [categoriaSeleccionada, ubicacionSeleccionada, almacenSeleccionado]);

  // Limpiar resaltado después de 5 segundos
  useEffect(() => {
    if (articuloEncontradoPorCodigo) {
      const timer = setTimeout(() => {
        setArticuloEncontradoPorCodigo(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [articuloEncontradoPorCodigo]);

  const filteredArticulos = React.useMemo(() => {
    // Si hay búsqueda por código de herramienta, usar solo esos resultados
    // Ahora acepta prefijos alfanuméricos como PP2-, AD1-, LL-, LC-, etc.
    const patronCodigoParcial = /^[A-Z0-9]{2,4}-/i;
    // Normalizar: convertir apóstrofes a guión (el lector QR a veces lee ' en lugar de -)
    const codigo = deferredSearchTerm.trim().toUpperCase().replace(/['`´]/g, '-');

    if (almacenSeleccionado !== 'nuevos' && codigo && patronCodigoParcial.test(codigo) && herramientasEncontradasPorCodigo.length > 0) {
      // Filtrar las herramientas encontradas por los demás filtros
      return herramientasEncontradasPorCodigo
        .filter((item) => {
          const isActive = item.activo !== false;
          const matchesActiveFilter = mostrarDesactivados ? !isActive : isActive;
          const matchesCategoria = !categoriaSeleccionada || item.categoria_id === categoriaSeleccionada;
          const matchesUbicacion = !ubicacionSeleccionada || item.ubicacion_id === ubicacionSeleccionada;
          const matchesAlmacen = item.ubicacion && (item.ubicacion.almacen_id == almacenSeleccionado || item.ubicacion.almacen_ref?.id == almacenSeleccionado);
          // matchesSeccion: filtra por seccion_id si es número; 'todos' = sin filtro;
          // legacy 'stock'/'extras' usa extrasIds local
          const matchesSeccion = !seccionSeleccionada || seccionSeleccionada === 'todos'
            || (typeof seccionSeleccionada === 'number'
              ? item.seccion_id === seccionSeleccionada
              : getSeccionArticulo(item) === seccionSeleccionada);

          // Ocultar SKUs pendientes de revisión: viven solo en NUEVOS REGISTROS
          return !item.pendiente_revision && matchesActiveFilter && matchesCategoria && matchesUbicacion && matchesAlmacen && matchesSeccion;
        })
        .sort((a, b) => {
          // Ordenar según la opción seleccionada
          switch (ordenamiento) {
            case 'nombre-asc':
              return a.nombre.localeCompare(b.nombre);
            case 'nombre-desc':
              return b.nombre.localeCompare(a.nombre);
            case 'stock-bajo':
              const aBajoStock = parseFloat(a.stock_actual) <= parseFloat(a.stock_minimo);
              const bBajoStock = parseFloat(b.stock_actual) <= parseFloat(b.stock_minimo);
              if (aBajoStock && !bBajoStock) return -1;
              if (!aBajoStock && bBajoStock) return 1;
              return parseFloat(a.stock_actual) - parseFloat(b.stock_actual);
            case 'stock-asc':
              return parseFloat(a.stock_actual) - parseFloat(b.stock_actual);
            case 'stock-desc':
              return parseFloat(b.stock_actual) - parseFloat(a.stock_actual);
            case 'costo-asc':
              return parseFloat(a.costo_unitario || 0) - parseFloat(b.costo_unitario || 0);
            case 'costo-desc':
              return parseFloat(b.costo_unitario || 0) - parseFloat(a.costo_unitario || 0);
            case 'categoria':
              return (a.categoria?.nombre || '').localeCompare(b.categoria?.nombre || '');
            default:
              return 0;
          }
        });
    }

    // Búsqueda normal
    return articulos
      .filter((item) => {
        // Cuando hay texto en el buscador, la búsqueda abarca TODOS los almacenes:
        // se ignoran los filtros de ubicación (almacén/sección/categoría/ubicación)
        // y también se incluyen los SKU desactivados, para que el mismo SKU aparezca
        // aunque esté dado de alta en otro almacén o esté desactivado y así evitar
        // crear duplicados.
        const buscandoGlobal = deferredSearchTerm.trim() !== '';

        // Filtrar por estado activo/desactivado (en búsqueda global se muestran ambos)
        const isActive = item.activo !== false;
        const matchesActiveFilter = buscandoGlobal || (mostrarDesactivados ? !isActive : isActive);

        const matchesSearch =
          item.nombre?.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
          item.sku?.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
          item.codigo_ean13?.includes(deferredSearchTerm) ||
          item.categoria?.nombre?.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
          // También busca dentro de la descripción/comentarios del artículo
          item.descripcion?.toLowerCase().includes(deferredSearchTerm.toLowerCase());

        // Modo NUEVOS REGISTROS: solo SKUs pendientes de revisión (creados por
        // almacén), sin filtrar por almacén/sección porque aún no se les asigna.
        if (almacenSeleccionado === 'nuevos') {
          return item.pendiente_revision === true && isActive && matchesSearch;
        }

        const matchesCategoria = buscandoGlobal || !categoriaSeleccionada || item.categoria_id === categoriaSeleccionada;
        const matchesUbicacion = buscandoGlobal || !ubicacionSeleccionada || item.ubicacion_id === ubicacionSeleccionada;

        // Filtrar por almacén
        const matchesAlmacen = buscandoGlobal || (item.ubicacion && (item.ubicacion.almacen_id == almacenSeleccionado || item.ubicacion.almacen_ref?.id == almacenSeleccionado));

        // Filtrar por sección — número (BD), 'todos' (sin filtro), o legacy stock/extras
        const matchesSeccion = buscandoGlobal || !seccionSeleccionada || seccionSeleccionada === 'todos'
          || (typeof seccionSeleccionada === 'number'
            ? item.seccion_id === seccionSeleccionada
            : getSeccionArticulo(item) === seccionSeleccionada);

        // Ocultar SKUs pendientes de revisión: viven solo en NUEVOS REGISTROS
        return !item.pendiente_revision && matchesActiveFilter && matchesSearch && matchesCategoria && matchesUbicacion && matchesAlmacen && matchesSeccion;
      })
      .sort((a, b) => {
        // Ordenar según la opción seleccionada
        switch (ordenamiento) {
          case 'nombre-asc':
            return a.nombre.localeCompare(b.nombre);
          case 'nombre-desc':
            return b.nombre.localeCompare(a.nombre);
          case 'stock-bajo':
            // Calcular si está bajo stock (stock_actual <= stock_minimo)
            const aBajoStock = parseFloat(a.stock_actual) <= parseFloat(a.stock_minimo);
            const bBajoStock = parseFloat(b.stock_actual) <= parseFloat(b.stock_minimo);
            if (aBajoStock && !bBajoStock) return -1;
            if (!aBajoStock && bBajoStock) return 1;
            // Si ambos están bajos o ambos están bien, ordenar por cantidad de stock (menor primero)
            return parseFloat(a.stock_actual) - parseFloat(b.stock_actual);
          case 'stock-asc':
            return parseFloat(a.stock_actual) - parseFloat(b.stock_actual);
          case 'stock-desc':
            return parseFloat(b.stock_actual) - parseFloat(a.stock_actual);
          case 'costo-asc':
            return parseFloat(a.costo_unitario) - parseFloat(b.costo_unitario);
          case 'costo-desc':
            return parseFloat(b.costo_unitario) - parseFloat(a.costo_unitario);
          case 'categoria':
            return a.categoria?.nombre.localeCompare(b.categoria?.nombre);
          default:
            return 0;
        }
      });
  }, [
    articulos,
    deferredSearchTerm,
    almacenSeleccionado,
    herramientasEncontradasPorCodigo,
    mostrarDesactivados,
    categoriaSeleccionada,
    ubicacionSeleccionada,
    seccionSeleccionada,
    ordenamiento,
    getSeccionArticulo,
  ]);

  // Búsqueda global activa: hay texto en el buscador (la lista abarca todos los
  // almacenes). Sirve para marcar los SKU que viven en otro almacén distinto al
  // seleccionado y evitar que se den de alta duplicados.
  const buscandoGlobalActivo = deferredSearchTerm.trim() !== '';
  const esDeOtroAlmacen = (item) => {
    if (!buscandoGlobalActivo || typeof almacenSeleccionado !== 'number') return false;
    const almacenItemId = item?.ubicacion?.almacen_id ?? item?.ubicacion?.almacen_ref?.id ?? null;
    return almacenItemId != null && almacenItemId != almacenSeleccionado;
  };

  const handleAgregarAlPedido = (articulo) => {
    agregarArticulo(articulo, 1);
    toast.success(`${articulo.nombre} agregado al pedido`);
  };

  const handleVerDetalle = (articulo) => {
    setArticuloSeleccionado(articulo);
    setModalDetalleOpen(true);
  };

  const resultadosInicio = React.useMemo(() => {
    const q = busquedaInicioDiferida.trim().toLowerCase();
    if (!q) return [];
    return articulos
      .filter(a =>
        a.nombre?.toLowerCase().includes(q) ||
        a.sku?.toLowerCase().includes(q) ||
        a.codigo_ean13?.toLowerCase().includes(q)
      )
      // Primero coincidencias exactas de SKU/código, luego activos, luego por nombre
      .sort((a, b) => {
        const exacto = x => (x.sku?.toLowerCase() === q || x.codigo_ean13?.toLowerCase() === q) ? 0 : 1;
        return exacto(a) - exacto(b)
          || (a.activo === false) - (b.activo === false)
          || (a.nombre || '').localeCompare(b.nombre || '');
      })
      .slice(0, 50);
  }, [articulos, busquedaInicioDiferida]);

  const nombreAlmacenDe = (articulo) => {
    const id = articulo.ubicacion?.almacen_ref?.id ?? articulo.ubicacion?.almacen_id;
    return articulo.ubicacion?.almacen_ref?.nombre
      || almacenesDisponibles.find(a => a.id == id)?.nombre
      || articulo.ubicacion?.almacen
      || 'Sin almacén';
  };

  // Entra al almacén del SKU (con la búsqueda ya puesta) y abre su detalle
  const abrirDesdeBusquedaInicio = (articulo) => {
    const termino = busquedaInicio.trim();
    setBusquedaInicio('');
    if (articulo.pendiente_revision && (esAdministrador || esAlmacen)) {
      setAlmacenSeleccionado('nuevos');
    } else {
      const almacenId = articulo.ubicacion?.almacen_ref?.id ?? articulo.ubicacion?.almacen_id ?? almacenesDisponibles[0]?.id;
      if (almacenId === null || almacenId === undefined) return;
      setAlmacenSeleccionado(almacenId);
    }
    setTabActivo(articulo.es_herramienta ? 'herramientas' : 'consumibles');
    setSeccionSeleccionada('todos');
    setCategoriaSeleccionada(null);
    setUbicacionSeleccionada(null);
    setSearchTerm(termino);
    handleVerDetalle(articulo);
  };

  // Función para expandir/colapsar unidades de herramientas
  const handleToggleHerramienta = async (articuloId, e) => {
    e.stopPropagation(); // Prevenir que se abra el modal de detalle

    // Verificar que el artículo sea una herramienta
    const articulo = articulos.find(a => a.id === articuloId);
    if (!articulo || !articulo.es_herramienta) {
      console.warn(`Artículo ${articuloId} no es una herramienta de renta`);
      return;
    }

    // Si ya está expandida, solo colapsarla
    if (herramientasExpandidas[articuloId]) {
      setHerramientasExpandidas(prev => ({
        ...prev,
        [articuloId]: false
      }));
      return;
    }

    // Si no está expandida, cargar las unidades y expandir
    setLoadingUnidades(prev => ({ ...prev, [articuloId]: true }));

    try {
      // Llamar al nuevo endpoint que busca por articulo_id
      const data = await herramientasRentaService.obtenerUnidadesPorArticulo(articuloId);

      setUnidadesHerramientas(prev => ({
        ...prev,
        [articuloId]: data.unidades || []
      }));

      setHerramientasExpandidas(prev => ({
        ...prev,
        [articuloId]: true
      }));
    } catch (error) {
      console.error('Error al cargar unidades:', error);
      toast.error(error.message || 'Error al cargar las unidades de la herramienta');
    } finally {
      setLoadingUnidades(prev => ({ ...prev, [articuloId]: false }));
    }
  };

  // Función para abrir modal de detalle de unidad
  const handleVerDetalleUnidad = async (unidad, articuloId, e) => {
    e.stopPropagation(); // Prevenir propagación de eventos

    try {
      // Obtener el tipo de herramienta desde las unidades cargadas
      // Si ya tenemos las unidades cargadas, podemos obtener el tipo del artículo
      const articulo = articulos.find(a => a.id === articuloId);

      if (!articulo) {
        toast.error('No se encontró el artículo');
        return;
      }

      // Crear un objeto tipo herramienta simplificado desde el artículo
      const tipoHerramienta = {
        id: articuloId,
        nombre: articulo.nombre,
        descripcion: articulo.descripcion,
        prefijo_codigo: unidad.codigo_unico.split('-')[0] // Extraer prefijo del código
      };

      setUnidadSeleccionada(unidad);
      setTipoHerramientaSeleccionado(tipoHerramienta);
      setModalUnidadOpen(true);
    } catch (error) {
      console.error('Error al abrir detalle de unidad:', error);
      toast.error('Error al abrir el detalle de la unidad');
    }
  };

  // Función para descargar código de barras de una unidad
  const handleDescargarCodigoBarras = async (unidadId, codigoUnico) => {
    try {
      // Usar axios con autenticación incluida
      const response = await api.get(`/herramientas-renta/unidades/${unidadId}/barcode`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'image/png' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `codigo-barras-${codigoUnico}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Código de barras descargado');
    } catch (error) {
      console.error('Error al descargar código de barras:', error);
      toast.error('Error al descargar el código de barras');
    }
  };

  // Función para imprimir código de barras de una unidad
  const handleImprimirCodigoBarras = async (unidadId, codigoUnico, nombreHerramienta) => {
    try {
      // Obtener la imagen con autenticación
      const response = await api.get(`/herramientas-renta/unidades/${unidadId}/barcode`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'image/png' });
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });

      // Abrir ventana de impresión con la imagen como data URL
      const printWindow = window.open('', '', 'width=600,height=400');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Código de Barras - ${codigoUnico}</title>
            <style>
              body {
                margin: 0;
                padding: 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-family: Arial, sans-serif;
              }
              h2 {
                margin: 0 0 10px 0;
                font-size: 18px;
                color: #333;
              }
              .codigo {
                font-family: monospace;
                font-size: 24px;
                font-weight: bold;
                color: #dc2626;
                margin: 10px 0;
              }
              img {
                max-width: 100%;
                height: auto;
              }
              @media print {
                body {
                  padding: 10px;
                }
              }
            </style>
          </head>
          <body>
            <h2>${nombreHerramienta}</h2>
            <div class="codigo">${codigoUnico}</div>
            <img src="${dataUrl}" alt="Código de barras ${codigoUnico}" onload="window.print(); window.close();" />
        </body>
      </html>
    `);
      printWindow.document.close();
    } catch (error) {
      console.error('Error al imprimir código de barras:', error);
      toast.error('Error al imprimir el código de barras');
    }
  };

  // Función para manejar escaneo desde pistola automática en Inventario
  // Usar useCallback para evitar que se recree en cada render
  const handleBarcodeScanInventario = useCallback(async (codigo) => {
    try {
      let articuloEncontrado = null;

      // Estrategia 1: Intentar buscar por código EAN-13 si tiene 13 dígitos
      if (codigo.length === 13 && /^\d+$/.test(codigo)) {
        try {
          const response = await articulosService.getByEAN13(codigo);
          if (response && response.id) {
            articuloEncontrado = response;
          }
        } catch (error) {
          // No encontrado como EAN-13, continuar con búsqueda general
        }
      }

      // Estrategia 2: Si no se encontró, buscar en todos los artículos por código
      if (!articuloEncontrado) {
        const todosLosArticulos = await articulosService.getAll();

        // Buscar por código_ean13 exacto (cualquier longitud)
        articuloEncontrado = todosLosArticulos.find(art =>
          art.codigo_ean13 === codigo
        );

        // Si aún no se encuentra, buscar por código que contenga el escaneado
        if (!articuloEncontrado) {
          articuloEncontrado = todosLosArticulos.find(art =>
            art.codigo_ean13?.includes(codigo)
          );
        }
      }

      if (articuloEncontrado && articuloEncontrado.id) {
        // Abrir modal de detalle del artículo
        setArticuloSeleccionado(articuloEncontrado);
        setModalDetalleOpen(true);

        // Mostrar toast de confirmación
        toast.success(articuloEncontrado.nombre, {
          icon: undefined,
          duration: 2000,
        });
      } else {
        // Si no existe, abrir modal de nuevo artículo con el código pre-llenado
        setArticuloAEditar(null); // NO es edición, es creación
        setCodigoEscaneado(codigo); // Guardar código escaneado
        setModalFormOpen(true);

        // Mostrar toast informativo
        toast.success(`Nuevo artículo · código ${codigo}`, {
          icon: undefined,
          duration: 3000,
        });
      }
    } catch (error) {
      toast.error('Error al buscar el artículo', {
        duration: 3000,
      });
    }
  }, []); // Array vacío porque no depende de ningún estado

  // Activar detección automática de pistola de códigos en Inventario
  const { isScanning } = useBarcodeScanner(handleBarcodeScanInventario, {
    enabled: true, // Siempre activa en la página de inventario
    minLength: 6, // Códigos mínimos de 6 caracteres
    timeout: 200, // 200ms entre caracteres para capturar todos
  });

  const handleNuevoArticulo = () => {
    setArticuloAEditar(null); // Limpiar artículo a editar
    setCodigoEscaneado(null); // Limpiar código escaneado
    setModalFormOpen(true);
  };

  const handleEditar = (articulo) => {
    setArticuloAEditar(articulo);
    setCodigoEscaneado(null); // Limpiar código escaneado cuando es edición
    setModalFormOpen(true);
  };

  const handleFormSuccess = () => {
    fetchArticulos(); // Recargar la lista
    setArticuloAEditar(null); // Limpiar artículo a editar
    setCodigoEscaneado(null); // Limpiar código escaneado
  };

  const handleCloseForm = () => {
    setModalFormOpen(false);
    setArticuloAEditar(null); // Limpiar artículo a editar
    setCodigoEscaneado(null); // Limpiar código escaneado
  };

  const handleEliminar = async (articulo) => {
    // Almacén: solicitar al administrador
    if (esAlmacen) {
      if (!(await confirmarG3({
        titulo: 'Pedir que se desactive el artículo',
        datos: [['Artículo', articulo.nombre], ...(articulo.sku ? [['Clave', articulo.sku]] : [])],
        pasa: [`Se enviará al administrador una solicitud para desactivar «${articulo.nombre}».`],
        confirmar: 'Enviar solicitud', cancelar: 'No enviar',
      }))) return;
      try {
        await solicitudesCambioService.crear({
          tipo: 'desactivar_articulo',
          articulo_id: articulo.id,
          payload: {}
        });
        toast.success('Solicitud de desactivación enviada al administrador');
      } catch (error) {
        console.error(error);
        toast.error(error.response?.data?.message || 'Error al enviar solicitud');
      }
      return;
    }

    if (!(await confirmarG3({
      titulo: `¿Desactivar «${articulo.nombre}»?`,
      datos: [['Artículo', articulo.nombre], ...(articulo.sku ? [['Clave', articulo.sku]] : []), ['Stock', `${articulo.stock_actual ?? '—'} ${articulo.unidad || ''}`.trim()]],
      pasa: ['Esta acción desactivará el artículo.'],
      confirmar: 'Desactivar artículo', cancelar: 'No desactivar', peligro: true,
    }))) return;

    try {
      await articulosService.delete(articulo.id);
      // Actualización local — sin refetch ni perder scroll
      setArticulos(prev => prev.map(a => a.id === articulo.id ? { ...a, activo: false } : a));
      toast.success('Artículo desactivado');
    } catch (error) {
      console.error('Error al eliminar artículo:', error);
      toast.error(error.message || 'Error al eliminar artículo');
    }
  };

  const handleReactivar = async (articulo) => {
    // Almacén: no puede reactivar directo, envía solicitud (la resuelve admin o compras)
    if (esAlmacen) {
      if (!(await confirmarG3({
        titulo: 'Pedir que se reactive el artículo',
        datos: [['Artículo', articulo.nombre], ...(articulo.sku ? [['Clave', articulo.sku]] : [])],
        pasa: [`Se enviará una solicitud para reactivar «${articulo.nombre}».`],
        confirmar: 'Enviar solicitud', cancelar: 'No enviar',
      }))) return;
      try {
        await solicitudesCambioService.crear({
          tipo: 'reactivar_articulo',
          articulo_id: articulo.id,
          payload: {}
        });
        toast.success('Solicitud de reactivación enviada');
      } catch (error) {
        console.error(error);
        toast.error(error.response?.data?.message || 'Error al enviar solicitud');
      }
      return;
    }

    if (!(await confirmarG3({
      titulo: `¿Reactivar «${articulo.nombre}»?`,
      datos: [['Artículo', articulo.nombre], ...(articulo.sku ? [['Clave', articulo.sku]] : [])],
      confirmar: 'Reactivar artículo', cancelar: 'No reactivar',
    }))) return;

    try {
      await articulosService.update(articulo.id, { activo: true });
      // Actualización local — sin refetch ni perder scroll
      setArticulos(prev => prev.map(a => a.id === articulo.id ? { ...a, activo: true } : a));
      toast.success('Artículo reactivado');
    } catch (error) {
      console.error('Error al reactivar artículo:', error);
      toast.error(error.message || 'Error al reactivar artículo');
    }
  };

  const handleEliminarPermanente = async (articulo) => {
    // Las dos confirmaciones de siempre en una sola vista previa que pide escribir ELIMINAR.
    if (!(await confirmarG3({
      titulo: `¿Eliminar permanentemente «${articulo.nombre}»?`,
      aviso: 'Esta acción no se puede deshacer y borrará el artículo de la base de datos.',
      datos: [['Artículo', articulo.nombre], ...(articulo.sku ? [['Clave', articulo.sku]] : [])],
      escribir: 'ELIMINAR', confirmar: 'Eliminar permanentemente', cancelar: 'No eliminar', peligro: true,
    }))) return;

    try {
      await articulosService.deletePermanente(articulo.id);
      // Actualización local — quitar de la lista sin refetch
      setArticulos(prev => prev.filter(a => a.id !== articulo.id));
      toast.success('Artículo eliminado permanentemente');
    } catch (error) {
      console.error('Error al eliminar artículo permanentemente:', error);
      toast.error(error.message || 'Error al eliminar artículo permanentemente');
    }
  };

  const handleAbrirEntrada = (articulo) => {
    setArticuloParaEntrada(articulo);
    setCantidadEntrada('');
    setObservacionesEntrada('');
    setModalEntradaOpen(true);
  };

  const handleCerrarEntrada = () => {
    setModalEntradaOpen(false);
    setArticuloParaEntrada(null);
    setCantidadEntrada('');
    setObservacionesEntrada('');
  };

  const handleGuardarEntrada = async () => {
    if (!cantidadEntrada || parseFloat(cantidadEntrada) <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    try {
      setLoadingEntrada(true);

      // Almacén: solicita aprobación, salvo que el admin haya activado el ajuste directo.
      if (esAlmacen) {
        const resp = await solicitudesCambioService.crear({
          tipo: 'entrada_stock',
          articulo_id: articuloParaEntrada.id,
          payload: {
            cantidad: parseFloat(cantidadEntrada),
            observaciones: observacionesEntrada || null
          }
        });
        if (resp?.aplicada) {
          marcarRecienActualizados([articuloParaEntrada.id]);
          toast.success(resp.message || 'Entrada aplicada al inventario');
        } else {
          toast.success('Solicitud de entrada enviada al administrador');
        }
      } else {
        await movimientosService.create({
          tipo: 'ajuste_entrada',
          articulos: [
            {
              articulo_id: articuloParaEntrada.id,
              cantidad: parseFloat(cantidadEntrada),
              observaciones: observacionesEntrada || null
            }
          ],
          observaciones: `Entrada de inventario: ${articuloParaEntrada.nombre}`
        });
        marcarRecienActualizados([articuloParaEntrada.id]);
        toast.success('Entrada registrada exitosamente');
      }

      handleCerrarEntrada();
      fetchArticulos();
    } catch (error) {
      console.error('Error al registrar entrada:', error);
      toast.error(error.response?.data?.message || error.message || 'Error al registrar entrada');
    } finally {
      setLoadingEntrada(false);
    }
  };

  const handleAbrirSalida = (articulo) => {
    setArticuloParaSalida(articulo);
    setCantidadSalida('');
    setObservacionesSalida('');
    setModalSalidaOpen(true);
  };

  const handleCerrarSalida = () => {
    setModalSalidaOpen(false);
    setArticuloParaSalida(null);
    setCantidadSalida('');
    setObservacionesSalida('');
  };

  const handleGuardarSalida = async () => {
    if (!cantidadSalida || parseFloat(cantidadSalida) <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    try {
      setLoadingSalida(true);

      // Almacén: solicita aprobación, salvo que el admin haya activado el ajuste directo.
      if (esAlmacen) {
        const resp = await solicitudesCambioService.crear({
          tipo: 'salida_stock',
          articulo_id: articuloParaSalida.id,
          payload: {
            cantidad: parseFloat(cantidadSalida),
            observaciones: observacionesSalida || null
          }
        });
        if (resp?.aplicada) {
          marcarRecienActualizados([articuloParaSalida.id]);
          toast.success(resp.message || 'Salida aplicada al inventario');
        } else {
          toast.success('Solicitud de salida enviada al administrador');
        }
      } else {
        await movimientosService.create({
          tipo: 'ajuste_salida',
          articulos: [
            {
              articulo_id: articuloParaSalida.id,
              cantidad: parseFloat(cantidadSalida),
              observaciones: observacionesSalida || null
            }
          ],
          observaciones: `Salida de inventario: ${articuloParaSalida.nombre}`
        });
        marcarRecienActualizados([articuloParaSalida.id]);
        toast.success('Salida registrada exitosamente');
      }

      handleCerrarSalida();
      fetchArticulos();
    } catch (error) {
      console.error('Error al registrar salida:', error);
      toast.error(error.response?.data?.message || error.message || 'Error al registrar salida');
    } finally {
      setLoadingSalida(false);
    }
  };

  // ============ GESTIÓN DE CATEGORÍAS ============
  const handleAbrirModalCategoria = (categoria = null) => {
    if (categoria) {
      setCategoriaEditando(categoria);
      setNombreCategoria(categoria.nombre);
    } else {
      setCategoriaEditando(null);
      setNombreCategoria('');
    }
    setModalCategoriaOpen(true);
  };

  const handleCerrarModalCategoria = () => {
    setModalCategoriaOpen(false);
    setCategoriaEditando(null);
    setNombreCategoria('');
  };

  const handleGuardarCategoria = async () => {
    if (!nombreCategoria.trim()) {
      toast.error('El nombre de la categoría es requerido');
      return;
    }
    if (!categoriaEditando && !almacenSeleccionado) {
      toast.error('Selecciona un almacén antes de crear una categoría');
      return;
    }

    try {
      setLoadingCategoria(true);
      if (categoriaEditando) {
        await categoriasService.update(categoriaEditando.id, { nombre: nombreCategoria.trim() });
        toast.success('Categoría actualizada exitosamente');
      } else {
        await categoriasService.create({
          nombre: nombreCategoria.trim(),
          almacen_id: almacenSeleccionado
        });
        toast.success('Categoría creada exitosamente');
      }
      handleCerrarModalCategoria();
      fetchCategorias(almacenSeleccionado);
      fetchTodasCategorias();
    } catch (error) {
      console.error('Error al guardar categoría:', error);
      toast.error(error.message || 'Error al guardar categoría');
    } finally {
      setLoadingCategoria(false);
    }
  };

  const handleEliminarCategoria = async (categoria) => {
    try {
      // Primer intento: verificar si hay artículos asociados
      await categoriasService.delete(categoria.id, false);

      // Si no hay artículos, se elimina directamente
      toast.success('Categoría eliminada exitosamente');
      fetchCategorias(almacenSeleccionado);
      fetchTodasCategorias();
      if (categoriaSeleccionada === categoria.id) {
        setCategoriaSeleccionada(null);
      }
    } catch (error) {
      console.error('Error al eliminar categoría:', error);

      // Si requiere confirmación (hay artículos asociados)
      if (error.requiresConfirmation) {
        const confirmar = await confirmarG3({
            titulo: `¿Eliminar la categoría «${categoria.nombre}»?`,
            aviso: error.message,
            pasa: ['Los artículos se moverán a la categoría «Sin Categoría».'],
            confirmar: 'Eliminar y mover artículos', cancelar: 'No eliminar', peligro: true,
          });

        if (confirmar) {
          try {
            // Segundo intento: forzar eliminación
            await categoriasService.delete(categoria.id, true);
            toast.success('Categoría eliminada exitosamente');
            fetchCategorias(almacenSeleccionado);
            fetchTodasCategorias();
            fetchArticulos(); // Recargar artículos para reflejar el cambio
            if (categoriaSeleccionada === categoria.id) {
              setCategoriaSeleccionada(null);
            }
          } catch (error2) {
            console.error('Error al forzar eliminación:', error2);
            toast.error(error2.message || 'Error al eliminar categoría');
          }
        }
      } else {
        // Error diferente
        toast.error(error.message || 'Error al eliminar categoría');
      }
    }
  };

  // ============ GESTIÓN DE UBICACIONES ============
  const handleAbrirModalUbicacion = (ubicacion = null) => {
    if (ubicacion) {
      setUbicacionEditando(ubicacion);
      setCodigoUbicacion(ubicacion.codigo || '');
      setAlmacenUbicacion(ubicacion.almacen || '');
      setPasilloUbicacion(ubicacion.pasillo || '');
      setEstanteUbicacion(ubicacion.estante || '');
      setNivelUbicacion(ubicacion.nivel || '');
      setDescripcionUbicacion(ubicacion.descripcion || '');
    } else {
      setUbicacionEditando(null);
      setCodigoUbicacion('');
      setAlmacenUbicacion('');
      setPasilloUbicacion('');
      setEstanteUbicacion('');
      setNivelUbicacion('');
      setDescripcionUbicacion('');
    }
    setModalUbicacionOpen(true);
  };

  const handleCerrarModalUbicacion = () => {
    setModalUbicacionOpen(false);
    setUbicacionEditando(null);
    setCodigoUbicacion('');
    setAlmacenUbicacion('');
    setPasilloUbicacion('');
    setEstanteUbicacion('');
    setNivelUbicacion('');
    setDescripcionUbicacion('');
  };

  const handleGuardarUbicacion = async () => {
    if (!codigoUbicacion.trim()) {
      toast.error('El código de ubicación es requerido');
      return;
    }
    if (!ubicacionEditando && !almacenSeleccionado) {
      toast.error('Selecciona un almacén antes de crear una ubicación');
      return;
    }

    try {
      setLoadingUbicacion(true);
      const ubicacionData = {
        codigo: codigoUbicacion.trim(),
        almacen: almacenUbicacion.trim() || null,
        almacen_id: ubicacionEditando ? ubicacionEditando.almacen_id : almacenSeleccionado,
        pasillo: pasilloUbicacion.trim() || null,
        estante: estanteUbicacion.trim() || null,
        nivel: nivelUbicacion ? parseInt(nivelUbicacion) : null,
        descripcion: descripcionUbicacion.trim() || null
      };

      if (ubicacionEditando) {
        await ubicacionesService.update(ubicacionEditando.id, ubicacionData);
        toast.success('Ubicación actualizada exitosamente');
      } else {
        await ubicacionesService.create(ubicacionData);
        toast.success('Ubicación creada exitosamente');
      }
      handleCerrarModalUbicacion();
      fetchUbicaciones(almacenSeleccionado);
      fetchTodasUbicaciones();
    } catch (error) {
      console.error('Error al guardar ubicación:', error);
      toast.error(error.message || 'Error al guardar ubicación');
    } finally {
      setLoadingUbicacion(false);
    }
  };

  const handleEliminarUbicacion = async (ubicacion) => {
    try {
      // Primer intento: verificar si hay artículos asociados
      await ubicacionesService.delete(ubicacion.id, false);

      // Si no hay artículos, se elimina directamente
      toast.success('Ubicación eliminada exitosamente');
      fetchUbicaciones(almacenSeleccionado);
      fetchTodasUbicaciones();
      if (ubicacionSeleccionada === ubicacion.id) {
        setUbicacionSeleccionada(null);
      }
    } catch (error) {
      console.error('Error al eliminar ubicación:', error);

      // Si requiere confirmación (hay artículos asociados)
      if (error.requiresConfirmation) {
        const confirmar = await confirmarG3({
            titulo: `¿Eliminar la ubicación «${ubicacion.codigo || ubicacion.nombre}»?`,
            aviso: error.message,
            pasa: ['Los artículos se moverán a la ubicación «Sin Asignar».'],
            confirmar: 'Eliminar y mover artículos', cancelar: 'No eliminar', peligro: true,
          });

        if (confirmar) {
          try {
            // Segundo intento: forzar eliminación
            await ubicacionesService.delete(ubicacion.id, true);
            toast.success('Ubicación eliminada exitosamente');
            fetchUbicaciones(almacenSeleccionado);
            fetchTodasUbicaciones();
            fetchArticulos(); // Recargar artículos para reflejar el cambio
            if (ubicacionSeleccionada === ubicacion.id) {
              setUbicacionSeleccionada(null);
            }
          } catch (error2) {
            console.error('Error al forzar eliminación:', error2);
            toast.error(error2.message || 'Error al eliminar ubicación');
          }
        }
      } else {
        // Error diferente
        toast.error(error.message || 'Error al eliminar ubicación');
      }
    }
  };

  // ============ GESTIÓN DE SECCIONES (solo almacén "Herramientas") ============
  const handleAbrirModalSeccion = (seccion = null) => {
    if (seccion) {
      setSeccionEditando(seccion);
      setNombreSeccion(seccion.nombre);
      setAlmacenSeccionForm(seccion.almacen_id);
    } else {
      setSeccionEditando(null);
      setNombreSeccion('');
      // Pre-seleccionar almacén destino: si hay número en almacenSeleccionado, usarlo;
      // si es modo 'herramientas', dejar al usuario elegir (null).
      setAlmacenSeccionForm(typeof almacenSeleccionado === 'number' ? almacenSeleccionado : null);
    }
    setModalSeccionOpen(true);
  };

  const handleCerrarModalSeccion = () => {
    setModalSeccionOpen(false);
    setSeccionEditando(null);
    setNombreSeccion('');
    setAlmacenSeccionForm(null);
  };

  const handleGuardarSeccion = async () => {
    if (!nombreSeccion.trim()) {
      toast.error('El nombre de la sección es requerido');
      return;
    }
    // Almacén destino: si edita, conserva el de la sección; si crea, usa el del form
    const almacenDestino = seccionEditando ? seccionEditando.almacen_id : almacenSeccionForm;
    if (!seccionEditando && !almacenDestino) {
      toast.error('Selecciona un almacén para la nueva sección');
      return;
    }

    try {
      setLoadingSeccion(true);
      if (seccionEditando) {
        const actualizada = await seccionesService.update(seccionEditando.id, { nombre: nombreSeccion.trim() });
        // Actualización optimista local
        const updateFn = (s) => s.id === seccionEditando.id ? { ...s, nombre: nombreSeccion.trim() } : s;
        setSecciones(prev => prev.map(updateFn));
        setTodasSecciones(prev => prev.map(updateFn));
        toast.success('Sección actualizada');
      } else {
        const nueva = await seccionesService.create({ nombre: nombreSeccion.trim(), almacen_id: almacenDestino });
        // Actualización optimista local
        if (nueva && nueva.id) {
          if (typeof almacenSeleccionado === 'number' && almacenSeleccionado === almacenDestino) {
            setSecciones(prev => [...prev, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre)));
          }
          setTodasSecciones(prev => [...prev, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        }
        toast.success('Sección creada');
      }
      handleCerrarModalSeccion();
      // Resincronizar con el backend en segundo plano
      if (typeof almacenSeleccionado === 'number') {
        fetchSecciones(almacenSeleccionado);
      } else {
        fetchSecciones();
      }
      fetchTodasSecciones();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Error al guardar sección');
    } finally {
      setLoadingSeccion(false);
    }
  };

  const handleEliminarSeccion = async (seccion) => {
    const removeFn = (prev) => prev.filter(s => s.id !== seccion.id);
    try {
      await seccionesService.delete(seccion.id, false);
      toast.success('Sección eliminada');
      // Actualización optimista local
      setSecciones(removeFn);
      setTodasSecciones(removeFn);
      fetchSecciones(almacenSeleccionado);
      fetchTodasSecciones();
      if (seccionSeleccionada === seccion.id) setSeccionSeleccionada(null);
    } catch (error) {
      if (error.requiresConfirmation) {
        if (await confirmarG3({
            titulo: `¿Eliminar la sección «${seccion.nombre}»?`,
            aviso: error.message,
            confirmar: 'Eliminar sección', cancelar: 'No eliminar', peligro: true,
          })) {
          try {
            await seccionesService.delete(seccion.id, true);
            toast.success('Sección eliminada');
            setSecciones(removeFn);
            setTodasSecciones(removeFn);
            fetchSecciones(almacenSeleccionado);
            fetchTodasSecciones();
            fetchArticulos();
            if (seccionSeleccionada === seccion.id) setSeccionSeleccionada(null);
          } catch (e2) {
            toast.error(e2.message || 'Error al eliminar sección');
          }
        }
      } else {
        toast.error(error.message || 'Error al eliminar sección');
      }
    }
  };

  // Funciones para generación de etiquetas
  const handleAbrirModalEtiquetas = () => {
    setModalEtiquetasOpen(true);
    setArticulosSeleccionadosEtiquetas([]);
    setBusquedaEtiquetas('');
    setFiltroUbicacionEtiquetas('todos'); // Reset filtro de ubicación
  };

  // ========== GESTIÓN DE ALMACENES ==========

  const handleCrearAlmacen = async () => {
    if (!nuevoNombreAlmacen.trim()) {
      toast.error('El nombre del almacén no puede estar vacío');
      return;
    }

    try {
      setLoadingAlmacenes(true);
      await almacenesService.create({
        nombre: nuevoNombreAlmacen.trim(),
        descripcion: `Almacén ${nuevoNombreAlmacen.trim()}`
      });

      toast.success(`Almacén "${nuevoNombreAlmacen.trim()}" creado exitosamente`);
      setNuevoNombreAlmacen('');
      await fetchAlmacenes();
    } catch (error) {
      console.error('Error al crear almacén:', error);
      toast.error(error.message || 'Error al crear el almacén');
    } finally {
      setLoadingAlmacenes(false);
    }
  };

  const handleRenombrarAlmacen = async (almacenObj) => {
    if (!nuevoNombreAlmacen.trim()) {
      toast.error('El nombre del almacén no puede estar vacío');
      return;
    }

    if (almacenObj.nombre === nuevoNombreAlmacen.trim()) {
      toast.error('El nuevo nombre es igual al actual');
      return;
    }

    try {
      setLoadingAlmacenes(true);
      await almacenesService.update(almacenObj.id, {
        nombre: nuevoNombreAlmacen.trim()
      });

      toast.success(`Almacén renombrado de "${almacenObj.nombre}" a "${nuevoNombreAlmacen.trim()}"`);
      setAlmacenEditando(null);
      setNuevoNombreAlmacen('');
      await fetchAlmacenes();
      await fetchUbicaciones();
    } catch (error) {
      console.error('Error al renombrar almacén:', error);
      toast.error(error.message || 'Error al renombrar el almacén');
    } finally {
      setLoadingAlmacenes(false);
    }
  };

  const handleEliminarAlmacen = async (almacenObj) => {
    if (!(await confirmarG3({
      titulo: `¿Eliminar el almacén «${almacenObj.nombre}»?`,
      pasa: ['Esto desvinculará todas las ubicaciones de este almacén.'],
      confirmar: 'Eliminar almacén', cancelar: 'No eliminar', peligro: true,
    }))) return;

    try {
      setLoadingAlmacenes(true);
      await almacenesService.delete(almacenObj.id, true);

      toast.success(`Almacén "${almacenObj.nombre}" eliminado exitosamente`);
      await fetchAlmacenes();
      await fetchUbicaciones();
    } catch (error) {
      console.error('Error al eliminar almacén:', error);
      toast.error(error.message || 'Error al eliminar el almacén');
    } finally {
      setLoadingAlmacenes(false);
    }
  };

  const handleSeleccionarTodosEtiquetas = () => {
    // Filtrar artículos activos
    let articulosActivos = articulos.filter(a => a.activo);

    // Aplicar filtro de tipo
    if (filtroTipoEtiquetas === 'consumibles') {
      articulosActivos = articulosActivos.filter(a => !a.es_herramienta);
    } else if (filtroTipoEtiquetas === 'herramientas') {
      articulosActivos = articulosActivos.filter(a => a.es_herramienta);
    }

    // Aplicar filtro de ubicación
    if (filtroUbicacionEtiquetas !== 'todos') {
      articulosActivos = articulosActivos.filter(a => a.ubicacion_id === parseInt(filtroUbicacionEtiquetas));
    }

    // Aplicar filtro de estado etiquetado
    if (filtroEstadoEtiquetado === 'etiquetados') {
      articulosActivos = articulosActivos.filter(a => a.etiquetado === true);
    } else if (filtroEstadoEtiquetado === 'sin_etiquetar') {
      articulosActivos = articulosActivos.filter(a => !a.etiquetado);
    }

    // Aplicar filtro de búsqueda
    const articulosFiltrados = busquedaEtiquetas.length > 0
      ? articulosActivos.filter(a =>
        a.nombre.toLowerCase().includes(busquedaEtiquetas.toLowerCase()) ||
        a.codigo_ean13?.toLowerCase().includes(busquedaEtiquetas.toLowerCase())
      )
      : articulosActivos;

    const todosSeleccionados = articulosFiltrados.every(a =>
      articulosSeleccionadosEtiquetas.includes(a.id)
    );

    if (todosSeleccionados) {
      // Deseleccionar todos los filtrados
      setArticulosSeleccionadosEtiquetas(prev =>
        prev.filter(id => !articulosFiltrados.find(a => a.id === id))
      );
    } else {
      // Seleccionar todos los filtrados
      const nuevosIds = articulosFiltrados.map(a => a.id);
      setArticulosSeleccionadosEtiquetas(prev => {
        const conjunto = new Set([...prev, ...nuevosIds]);
        return Array.from(conjunto);
      });
    }
  };

  const handleToggleArticuloEtiqueta = (articuloId) => {
    setArticulosSeleccionadosEtiquetas(prev => {
      if (prev.includes(articuloId)) {
        return prev.filter(id => id !== articuloId);
      } else {
        return [...prev, articuloId];
      }
    });
  };

  // Toggle expansión de herramienta en modal de etiquetas
  const handleToggleHerramientaEtiquetas = async (articuloId) => {
    // Verificar que el artículo sea una herramienta
    const articulo = articulos.find(a => a.id === articuloId);
    if (!articulo || !articulo.es_herramienta) {
      console.warn(`Artículo ${articuloId} no es una herramienta de renta`);
      return;
    }

    // Si ya está expandida, solo colapsarla
    if (herramientasExpandidasEtiquetas[articuloId]) {
      setHerramientasExpandidasEtiquetas(prev => ({
        ...prev,
        [articuloId]: false
      }));
      return;
    }

    // Si no está expandida, cargar las unidades y expandir
    if (!unidadesCargadasEtiquetas[articuloId]) {
      try {
        const data = await herramientasRentaService.obtenerUnidadesPorArticulo(articuloId);
        setUnidadesCargadasEtiquetas(prev => ({
          ...prev,
          [articuloId]: data.unidades || []
        }));
      } catch (error) {
        console.error('Error al cargar unidades:', error);
        toast.error('Error al cargar las unidades de la herramienta');
        return;
      }
    }

    setHerramientasExpandidasEtiquetas(prev => ({
      ...prev,
      [articuloId]: true
    }));
  };

  // Toggle selección de unidad
  const handleToggleUnidadEtiqueta = (unidadId) => {
    setUnidadesSeleccionadasEtiquetas(prev => {
      if (prev.includes(unidadId)) {
        return prev.filter(id => id !== unidadId);
      } else {
        return [...prev, unidadId];
      }
    });
  };

  // Seleccionar/deseleccionar todas las unidades de una herramienta
  const handleSeleccionarTodasUnidades = (articuloId) => {
    const unidades = unidadesCargadasEtiquetas[articuloId] || [];
    if (unidades.length === 0) return;

    const idsUnidades = unidades.map(u => u.id);
    const todasSeleccionadas = idsUnidades.every(id => unidadesSeleccionadasEtiquetas.includes(id));

    if (todasSeleccionadas) {
      // Deseleccionar todas
      setUnidadesSeleccionadasEtiquetas(prev => prev.filter(id => !idsUnidades.includes(id)));
    } else {
      // Seleccionar todas
      setUnidadesSeleccionadasEtiquetas(prev => {
        const conjunto = new Set([...prev, ...idsUnidades]);
        return Array.from(conjunto);
      });
    }
  };

  const handleGenerarEtiquetas = async () => {
    if (articulosSeleccionadosEtiquetas.length === 0 && unidadesSeleccionadasEtiquetas.length === 0) {
      toast.error('Debes seleccionar al menos un artículo o unidad de herramienta');
      return;
    }

    try {
      setLoadingEtiquetas(true);
      console.log('Generando etiquetas para artículos:', articulosSeleccionadosEtiquetas);
      console.log('Generando etiquetas para unidades:', unidadesSeleccionadasEtiquetas);

      await articulosService.generarEtiquetasMixtas(
        articulosSeleccionadosEtiquetas,
        unidadesSeleccionadasEtiquetas
      );

      const totalItems = articulosSeleccionadosEtiquetas.length + unidadesSeleccionadasEtiquetas.length;
      toast.success(`PDF con ${totalItems} etiquetas generado correctamente`);

      // Recargar artículos para actualizar el estado de etiquetado
      await fetchArticulos();

      setModalEtiquetasOpen(false);
      setArticulosSeleccionadosEtiquetas([]);
      setUnidadesSeleccionadasEtiquetas([]);
      setHerramientasExpandidasEtiquetas({});
      setUnidadesCargadasEtiquetas({});
    } catch (error) {
      console.error('Error completo al generar etiquetas:', error);
      const errorMsg = error.message || error.toString() || 'Error desconocido al generar las etiquetas';
      toast.error(errorMsg);
    } finally {
      setLoadingEtiquetas(false);
    }
  };

  // Las mismas acciones que hoy viven en el JSX (cantidad sin decimales en piezas; categorías por almacén), con nombre
  const cambiarCantidadEntradaR2 = (v) => setCantidadEntrada(sanitizarCantidad(v, articuloParaEntrada?.unidad));
  const cambiarCantidadSalidaR2 = (v) => setCantidadSalida(sanitizarCantidad(v, articuloParaSalida?.unidad));
  const alternarCategoriasAlmacenR2 = async (almacen) => {
    if (almacenCategoriasExpandido === almacen.id) {
      setAlmacenCategoriasExpandido(null);
    } else {
      // Cargar todas las categorías del sistema si no se han cargado
      if (todasLasCategorias.length === 0) {
        try {
          const data = await categoriasService.getAll();
          setTodasLasCategorias(Array.isArray(data) ? data : []);
        } catch (e) { console.error(e); }
      }
      setAlmacenCategoriasExpandido(almacen.id);
    }
  };
  const cambiarCategoriaDeAlmacenR2 = async (almacen, cat, isAssigned) => {
    setLoadingToggleCategoria(true);
    try {
      if (isAssigned) {
        await almacenesService.desasignarCategoria(almacen.id, cat.id);
      } else {
        await almacenesService.asignarCategoria(almacen.id, cat.id);
      }
      // Recargar almacenes para reflejar cambio
      await fetchAlmacenes();
    } catch (err) {
      toast.error(err.message || 'Error al actualizar categoría');
    } finally {
      setLoadingToggleCategoria(false);
    }
  };
  return (
    <VistaInventario p={{
      // datos
      articulos, loading, errorCargaR2, fetchArticulos, almacenesDisponibles, filteredArticulos, resultadosInicio, articulosPendientesRevision,
      articulosEnConteo, secciones, todasSecciones, todasCategorias, todasUbicaciones, categoriasAlmacenSel, ubicacionesAlmacenSel,
      // navegación y filtros
      almacenSeleccionado, setAlmacenSeleccionado, seccionSeleccionada, setSeccionSeleccionada, setTabActivo,
      categoriaSeleccionada, setCategoriaSeleccionada, ubicacionSeleccionada, setUbicacionSeleccionada,
      searchTerm, setSearchTerm, busquedaInicio, setBusquedaInicio, ordenamiento, setOrdenamiento,
      mostrarDesactivados, setMostrarDesactivados, modoNuevosRegistros, buscandoGlobalActivo, esDeOtroAlmacen, nombreAlmacenDe,
      abrirDesdeBusquedaInicio, isScanning,
      // permisos
      user, rolPuedeVer, esAdministrador, esAlmacen, puedeCrearArticulos, puedeEditarArticulos, puedeAgregarAlPedido, puedeGestionarInventario,
      puedeRegistrarSalida, puedeGestionarTaxonomia, puedeAjustarStock, permisosAlmacenAbiertos, cambiandoPermisosAlmacen, togglePermisosAlmacen,
      // tabla
      getImageUrl, colWidths, setColWidths, colWidthsPorOmision: DEFAULT_COL_WIDTHS, resetColWidths, recienActualizados, articuloEncontradoPorCodigo,
      herramientasExpandidas, unidadesHerramientas, loadingUnidades, handleToggleHerramienta, handleVerDetalleUnidad,
      handleDescargarCodigoBarras, handleImprimirCodigoBarras,
      // ajuste rápido
      modoAjusteStock, setModoAjusteStock, stocksEditados, handleStockEditChange, guardandoStocks, cambiosStockPendientes,
      handleGuardarAjustesStock, handleCancelarAjusteStock, unidadEsEntera,
      // acciones del artículo
      handleVerDetalle, handleAgregarAlPedido, handleAbrirEntrada, handleAbrirSalida, handleEliminar, handleReactivar, handleEliminarPermanente,
      handleNuevoArticulo, handleEditar, handleQuickUpdate, actualizandoArt, categoriasParaArticulo, ubicacionesParaArticulo,
      getSeccionArticulo, setSeccionArticulo,
      // detalle, formulario y escáner
      articuloSeleccionado, modalDetalleOpen, setModalDetalleOpen, modalFormOpen, handleCloseForm, handleFormSuccess, articuloAEditar, codigoEscaneado,
      showScanner, setShowScanner,
      // entrada y salida
      modalEntradaOpen, articuloParaEntrada, cantidadEntrada, cambiarCantidadEntradaR2, observacionesEntrada, setObservacionesEntrada,
      loadingEntrada, handleCerrarEntrada, handleGuardarEntrada,
      modalSalidaOpen, articuloParaSalida, cantidadSalida, cambiarCantidadSalidaR2, observacionesSalida, setObservacionesSalida,
      loadingSalida, handleCerrarSalida, handleGuardarSalida,
      // nuevos por autorizar
      almacenNuevoDe, ubicacionesDeAlmacen, seccionesDeAlmacen, categoriasDeAlmacen, handleNuevoAlmacenChange, setNuevosAlmacenSel,
      handleAutorizarNuevo, autorizandoNuevos,
      // etiquetas
      modalEtiquetasOpen, setModalEtiquetasOpen, handleAbrirModalEtiquetas, busquedaEtiquetas, setBusquedaEtiquetas,
      filtroTipoEtiquetas, setFiltroTipoEtiquetas, filtroUbicacionEtiquetas, setFiltroUbicacionEtiquetas, filtroEstadoEtiquetado, setFiltroEstadoEtiquetado,
      articulosSeleccionadosEtiquetas, unidadesSeleccionadasEtiquetas, herramientasExpandidasEtiquetas, unidadesCargadasEtiquetas, loadingEtiquetas,
      handleSeleccionarTodosEtiquetas, handleToggleArticuloEtiqueta, handleToggleHerramientaEtiquetas, handleToggleUnidadEtiqueta,
      handleSeleccionarTodasUnidades, handleGenerarEtiquetas,
      // unidad de herramienta
      modalUnidadOpen, setModalUnidadOpen, unidadSeleccionada, setUnidadSeleccionada, tipoHerramientaSeleccionado, setTipoHerramientaSeleccionado,
      // almacenes
      modalAlmacenesOpen, setModalAlmacenesOpen, almacenEditando, setAlmacenEditando, nuevoNombreAlmacen, setNuevoNombreAlmacen, loadingAlmacenes,
      handleCrearAlmacen, handleRenombrarAlmacen, handleEliminarAlmacen, almacenCategoriasExpandido, todasLasCategorias, loadingToggleCategoria,
      alternarCategoriasAlmacenR2, cambiarCategoriaDeAlmacenR2,
      // categorías, ubicaciones y secciones
      modalCategoriaOpen, categoriaEditando, nombreCategoria, setNombreCategoria, loadingCategoria,
      handleAbrirModalCategoria, handleCerrarModalCategoria, handleGuardarCategoria, handleEliminarCategoria,
      modalUbicacionOpen, ubicacionEditando, codigoUbicacion, setCodigoUbicacion, almacenUbicacion, setAlmacenUbicacion,
      pasilloUbicacion, setPasilloUbicacion, estanteUbicacion, setEstanteUbicacion, nivelUbicacion, setNivelUbicacion,
      descripcionUbicacion, setDescripcionUbicacion, loadingUbicacion,
      handleAbrirModalUbicacion, handleCerrarModalUbicacion, handleGuardarUbicacion, handleEliminarUbicacion,
      modalSeccionOpen, seccionEditando, nombreSeccion, setNombreSeccion, loadingSeccion, almacenSeccionForm,
      handleAbrirModalSeccion, handleCerrarModalSeccion, handleGuardarSeccion, handleEliminarSeccion,
    }} />
  );
};

export default InventarioPage;
