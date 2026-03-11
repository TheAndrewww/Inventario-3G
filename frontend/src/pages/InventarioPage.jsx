import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Package, Eye, Barcode, QrCode, Trash2, PackagePlus, PackageMinus, ArrowUpDown, MapPin, Edit2, X, ChevronDown, ChevronUp, Download, Printer, Wrench } from 'lucide-react';
import api from '../services/api';
import articulosService from '../services/articulos.service';
import movimientosService from '../services/movimientos.service';
import categoriasService from '../services/categorias.service';
import ubicacionesService from '../services/ubicaciones.service';
import almacenesService from '../services/almacenes.service';
import herramientasRentaService from '../services/herramientasRenta.service';
import conteosCiclicosService from '../services/conteosCiclicos.service';
import { Loader, Modal, AuthenticatedImage } from '../components/common';
import ArticuloDetalleModal from '../components/articulos/ArticuloDetalleModal';
import ArticuloFormModal from '../components/articulos/ArticuloFormModal';
import UnidadHerramientaDetalleModal from '../components/articulos/UnidadHerramientaDetalleModal';
import EAN13Scanner from '../components/scanner/EAN13Scanner';
import toast from 'react-hot-toast';
import { usePedido } from '../context/PedidoContext';
import { useAuth } from '../context/AuthContext';
import { getImageUrl } from '../utils/imageUtils';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import BarcodeScannerIndicator from '../components/scanner/BarcodeScannerIndicator';

/**
 * Formatea la cantidad según la unidad de medida
 * - kg, litros, metros, m², m³: muestra 2 decimales
 * - piezas, cajas, unidades: muestra sin decimales
 */
const formatearCantidad = (cantidad, unidad) => {
  const valor = parseFloat(cantidad);
  const unidadLower = (unidad || '').toLowerCase();

  // Unidades que requieren decimales
  const unidadesConDecimales = ['kg', 'litros', 'metros', 'm²', 'm³', 'gramos', 'ml', 'cm', 'mm'];

  if (unidadesConDecimales.some(u => unidadLower.includes(u))) {
    return valor.toFixed(2);
  }

  // Para piezas y otras unidades, sin decimales
  return valor.toFixed(0);
};

const InventarioPage = () => {
  const [articulos, setArticulos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [articuloEncontradoPorCodigo, setArticuloEncontradoPorCodigo] = useState(null); // Guardar artículo encontrado por código
  const [herramientasEncontradasPorCodigo, setHerramientasEncontradasPorCodigo] = useState([]); // Herramientas encontradas por búsqueda parcial
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState(null);
  const [almacenSeleccionado, setAlmacenSeleccionado] = useState('todos'); // Filtro de almacén (ID o 'todos')
  const [almacenesData, setAlmacenesData] = useState([]); // Almacenes desde la API
  const [tabActivo, setTabActivo] = useState('consumibles'); // Nuevo: 'consumibles' o 'herramientas'
  const [mostrarCategorias, setMostrarCategorias] = useState(false);
  const [mostrarUbicaciones, setMostrarUbicaciones] = useState(false);
  const [mostrarDesactivados, setMostrarDesactivados] = useState(false);
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

  // Verificar permisos según el rol
  const puedeCrearArticulos = ['administrador', 'encargado', 'almacen'].includes(user?.rol);
  const puedeEditarArticulos = ['administrador', 'encargado', 'almacen'].includes(user?.rol);
  const puedeAgregarAlPedido = ['administrador', 'diseñador'].includes(user?.rol);
  const puedeGestionarInventario = ['administrador', 'encargado', 'almacen'].includes(user?.rol);
  const puedeRegistrarSalida = ['administrador', 'almacen'].includes(user?.rol); // Almacén puede registrar salidas
  const esAdministrador = user?.rol === 'administrador';
  const esAlmacen = user?.rol === 'almacen';

  // Estado para artículos en conteo cíclico activo
  const [articulosEnConteo, setArticulosEnConteo] = useState(new Set());

  useEffect(() => {
    fetchArticulos();
    fetchAlmacenes();
    fetchCategorias();
    fetchUbicaciones();
    fetchArticulosConteo();
  }, []);

  // Cuando cambia el almacén seleccionado, recargar categorías y ubicaciones filtradas
  useEffect(() => {
    if (almacenSeleccionado !== 'todos') {
      fetchCategorias(almacenSeleccionado);
      fetchUbicaciones(almacenSeleccionado);
    } else {
      fetchCategorias();
      fetchUbicaciones();
    }
    // Limpiar filtros de categoría y ubicación al cambiar almacén
    setCategoriaSeleccionada(null);
    setUbicacionSeleccionada(null);
  }, [almacenSeleccionado]);

  const fetchArticulos = async () => {
    try {
      setLoading(true);
      const data = await articulosService.getAll();
      console.log('Artículos recibidos:', data);
      setArticulos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error al cargar artículos:', error);
      toast.error('Error al cargar el inventario');
      setArticulos([]);
    } finally {
      setLoading(false);
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

  const filteredArticulos = (() => {
    // Si hay búsqueda por código de herramienta, usar solo esos resultados
    // Ahora acepta prefijos alfanuméricos como PP2-, AD1-, LL-, LC-, etc.
    const patronCodigoParcial = /^[A-Z0-9]{2,4}-/i;
    // Normalizar: convertir apóstrofes a guión (el lector QR a veces lee ' en lugar de -)
    const codigo = searchTerm.trim().toUpperCase().replace(/['`´]/g, '-');

    if (codigo && patronCodigoParcial.test(codigo) && herramientasEncontradasPorCodigo.length > 0) {
      // Filtrar las herramientas encontradas por los demás filtros
      return herramientasEncontradasPorCodigo
        .filter((item) => {
          const isActive = item.activo !== false;
          const matchesActiveFilter = mostrarDesactivados ? !isActive : isActive;
          const matchesCategoria = !categoriaSeleccionada || item.categoria_id === categoriaSeleccionada;
          const matchesUbicacion = !ubicacionSeleccionada || item.ubicacion_id === ubicacionSeleccionada;
          const matchesAlmacen = almacenSeleccionado === 'todos' ||
            (item.ubicacion && (item.ubicacion.almacen_id == almacenSeleccionado || item.ubicacion.almacen_ref?.id == almacenSeleccionado));

          return matchesActiveFilter && matchesCategoria && matchesUbicacion && matchesAlmacen;
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
        // Filtrar por estado activo/desactivado
        const isActive = item.activo !== false;
        const matchesActiveFilter = mostrarDesactivados ? !isActive : isActive;

        const matchesSearch =
          item.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.codigo_ean13?.includes(searchTerm) ||
          item.categoria?.nombre?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategoria = !categoriaSeleccionada || item.categoria_id === categoriaSeleccionada;
        const matchesUbicacion = !ubicacionSeleccionada || item.ubicacion_id === ubicacionSeleccionada;

        // Filtrar por almacén
        const matchesAlmacen = almacenSeleccionado === 'todos' ||
          (item.ubicacion && (item.ubicacion.almacen_id == almacenSeleccionado || item.ubicacion.almacen_ref?.id == almacenSeleccionado));

        // Filtrar por tipo según el tab activo
        const estaEnTabCorrecto = tabActivo === 'consumibles'
          ? !item.es_herramienta  // Consumibles: artículos que NO son herramientas
          : item.es_herramienta;  // Herramientas: artículos que SÍ son herramientas

        return matchesActiveFilter && matchesSearch && matchesCategoria && matchesUbicacion && matchesAlmacen && estaEnTabCorrecto;
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
  })();

  const handleAgregarAlPedido = (articulo) => {
    agregarArticulo(articulo, 1);
    toast.success(`${articulo.nombre} agregado al pedido`);
  };

  const handleVerDetalle = (articulo) => {
    setArticuloSeleccionado(articulo);
    setModalDetalleOpen(true);
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
        toast.success(`✓ ${articuloEncontrado.nombre}`, {
          icon: '🔍',
          duration: 2000,
        });
      } else {
        // Si no existe, abrir modal de nuevo artículo con el código pre-llenado
        setArticuloAEditar(null); // NO es edición, es creación
        setCodigoEscaneado(codigo); // Guardar código escaneado
        setModalFormOpen(true);

        // Mostrar toast informativo
        toast.success(`📦 Nuevo artículo - Código: ${codigo}`, {
          icon: '✨',
          duration: 3000,
        });
      }
    } catch (error) {
      toast.error(`❌ Error al buscar artículo`, {
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
    if (!window.confirm(`¿Estás seguro de eliminar "${articulo.nombre}"? Esta acción desactivará el artículo.`)) {
      return;
    }

    try {
      await articulosService.delete(articulo.id);
      toast.success('Artículo desactivado exitosamente');
      fetchArticulos();
    } catch (error) {
      console.error('Error al eliminar artículo:', error);
      toast.error(error.message || 'Error al eliminar artículo');
    }
  };

  const handleReactivar = async (articulo) => {
    if (!window.confirm(`¿Deseas reactivar "${articulo.nombre}"?`)) {
      return;
    }

    try {
      await articulosService.update(articulo.id, { activo: true });
      toast.success('Artículo reactivado exitosamente');
      fetchArticulos();
    } catch (error) {
      console.error('Error al reactivar artículo:', error);
      toast.error(error.message || 'Error al reactivar artículo');
    }
  };

  const handleEliminarPermanente = async (articulo) => {
    if (!window.confirm(`¿Estás seguro de ELIMINAR PERMANENTEMENTE "${articulo.nombre}"?\n\nEsta acción NO se puede deshacer y borrará el artículo de la base de datos.`)) {
      return;
    }

    // Segunda confirmación para mayor seguridad
    if (!window.confirm(`CONFIRMAR: Eliminar permanentemente "${articulo.nombre}"`)) {
      return;
    }

    try {
      await articulosService.deletePermanente(articulo.id);
      toast.success('Artículo eliminado permanentemente');
      fetchArticulos();
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

      toast.success('Entrada registrada exitosamente');
      handleCerrarEntrada();
      fetchArticulos();
    } catch (error) {
      console.error('Error al registrar entrada:', error);
      toast.error(error.message || 'Error al registrar entrada');
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

      toast.success('Salida registrada exitosamente');
      handleCerrarSalida();
      fetchArticulos();
    } catch (error) {
      console.error('Error al registrar salida:', error);
      toast.error(error.message || 'Error al registrar salida');
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

    try {
      setLoadingCategoria(true);
      if (categoriaEditando) {
        await categoriasService.update(categoriaEditando.id, { nombre: nombreCategoria.trim() });
        toast.success('Categoría actualizada exitosamente');
      } else {
        await categoriasService.create({ nombre: nombreCategoria.trim() });
        toast.success('Categoría creada exitosamente');
      }
      handleCerrarModalCategoria();
      fetchCategorias();
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
      fetchCategorias();
      if (categoriaSeleccionada === categoria.id) {
        setCategoriaSeleccionada(null);
      }
    } catch (error) {
      console.error('Error al eliminar categoría:', error);

      // Si requiere confirmación (hay artículos asociados)
      if (error.requiresConfirmation) {
        const confirmar = window.confirm(
          `⚠️ ADVERTENCIA\n\n${error.message}\n\n¿Deseas continuar? Los artículos se moverán a la categoría "Sin Categoría".`
        );

        if (confirmar) {
          try {
            // Segundo intento: forzar eliminación
            await categoriasService.delete(categoria.id, true);
            toast.success('Categoría eliminada exitosamente');
            fetchCategorias();
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

    try {
      setLoadingUbicacion(true);
      const ubicacionData = {
        codigo: codigoUbicacion.trim(),
        almacen: almacenUbicacion.trim() || null,
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
      fetchUbicaciones();
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
      fetchUbicaciones();
      if (ubicacionSeleccionada === ubicacion.id) {
        setUbicacionSeleccionada(null);
      }
    } catch (error) {
      console.error('Error al eliminar ubicación:', error);

      // Si requiere confirmación (hay artículos asociados)
      if (error.requiresConfirmation) {
        const confirmar = window.confirm(
          `⚠️ ADVERTENCIA\n\n${error.message}\n\n¿Deseas continuar? Los artículos se moverán a la ubicación "Sin Asignar".`
        );

        if (confirmar) {
          try {
            // Segundo intento: forzar eliminación
            await ubicacionesService.delete(ubicacion.id, true);
            toast.success('Ubicación eliminada exitosamente');
            fetchUbicaciones();
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
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el almacén "${almacenObj.nombre}"?\n\nEsto desvinculará todas las ubicaciones de este almacén.`)) {
      return;
    }

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

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <div className="p-4 md:p-6">
      {/* Indicador de escaneo activo */}
      <BarcodeScannerIndicator isScanning={isScanning} />

      {/* Barra de búsqueda y acciones */}
      <div className="mb-4 md:mb-6 space-y-3 md:space-y-4">
        {/* Búsqueda y botón escanear */}
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar artículos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 md:py-3 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            />
          </div>
          <button
            onClick={() => setShowScanner(true)}
            className="flex items-center gap-2 px-3 md:px-4 py-2.5 md:py-3 bg-red-700 text-white rounded-lg hover:bg-red-800 transition-colors"
          >
            <QrCode size={18} />
            <span className="font-medium hidden sm:inline">Escanear</span>
          </button>
        </div>

        {/* Selector de Almacén y Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Selector de Almacén con botón de gestión */}
          <div className="flex gap-2 flex-shrink-0">
            <select
              value={almacenSeleccionado}
              onChange={(e) => setAlmacenSeleccionado(e.target.value)}
              className="flex-1 sm:w-auto px-4 py-2.5 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700 bg-white cursor-pointer hover:bg-gray-50"
            >
              <option value="todos">📦 Todos los almacenes</option>
              {almacenesDisponibles.map((almacen) => (
                <option key={almacen.id} value={almacen.id}>
                  🏢 {almacen.nombre}
                </option>
              ))}
            </select>
            {esAdministrador && (
              <button
                onClick={() => setModalAlmacenesOpen(true)}
                className="px-3 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
                title="Gestionar almacenes"
              >
                <Plus size={18} />
                <span className="hidden md:inline text-sm">Gestionar</span>
              </button>
            )}
          </div>

          {/* Tabs: Consumibles / Herramientas */}
          <div className="flex bg-gray-100 rounded-lg p-1 flex-1 sm:flex-initial">
            <button
              onClick={() => setTabActivo('consumibles')}
              className={`flex-1 sm:flex-initial px-4 md:px-6 py-2 text-sm md:text-base font-medium rounded-md transition-all ${tabActivo === 'consumibles'
                ? 'bg-white text-red-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              📦 Consumibles
            </button>
            <button
              onClick={() => setTabActivo('herramientas')}
              className={`flex-1 sm:flex-initial px-4 md:px-6 py-2 text-sm md:text-base font-medium rounded-md transition-all ${tabActivo === 'herramientas'
                ? 'bg-white text-red-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              🔧 Herramientas
            </button>
          </div>
        </div>

        {/* Botones de acción - wrapeables en móvil */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Desplegable de ordenamiento */}
          <div className="relative">
            <select
              value={ordenamiento}
              onChange={(e) => setOrdenamiento(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 md:py-3 text-sm md:text-base border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-700 cursor-pointer bg-white"
            >
              <option value="nombre-asc">Nombre (A-Z)</option>
              <option value="nombre-desc">Nombre (Z-A)</option>
              <option value="stock-bajo">⚠️ Stock Bajo Primero</option>
              <option value="stock-asc">Stock (Menor a Mayor)</option>
              <option value="stock-desc">Stock (Mayor a Menor)</option>
              <option value="costo-asc">Precio (Menor a Mayor)</option>
              <option value="costo-desc">Precio (Mayor a Menor)</option>
              <option value="categoria">Por Categoría</option>
            </select>
            <ArrowUpDown size={16} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          <button
            onClick={() => setMostrarCategorias(!mostrarCategorias)}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border rounded-lg transition-colors ${mostrarCategorias
              ? 'bg-red-700 text-white border-red-700 hover:bg-red-800'
              : 'border-gray-300 hover:bg-gray-50'
              }`}
          >
            <Package size={18} />
            <span className="hidden sm:inline">Categorías</span>
          </button>
          <button
            onClick={() => setMostrarUbicaciones(!mostrarUbicaciones)}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border rounded-lg transition-colors ${mostrarUbicaciones
              ? 'bg-red-700 text-white border-red-700 hover:bg-red-800'
              : 'border-gray-300 hover:bg-gray-50'
              }`}
          >
            <MapPin size={18} />
            <span className="hidden sm:inline">Ubicaciones</span>
          </button>
          {puedeCrearArticulos && (
            <>
              <button
                onClick={() => setMostrarDesactivados(!mostrarDesactivados)}
                className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 text-sm md:text-base rounded-lg transition-colors ${mostrarDesactivados
                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                title={mostrarDesactivados ? 'Ver artículos activos' : 'Ver artículos desactivados'}
              >
                <Trash2 size={18} />
                <span className="hidden sm:inline">{mostrarDesactivados ? 'Ver Activos' : 'Ver Desactivados'}</span>
              </button>
              <button
                onClick={handleAbrirModalEtiquetas}
                className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 text-sm md:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                title="Generar etiquetas para imprimir"
              >
                <Barcode size={18} />
                <span className="hidden sm:inline">Generar Etiquetas</span>
              </button>
              {user?.rol !== 'almacen' && (
                <button
                  onClick={handleNuevoArticulo}
                  className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 text-sm md:text-base bg-red-700 text-white rounded-lg hover:bg-red-800"
                >
                  <Plus size={18} />
                  <span className="hidden sm:inline">Nuevo Artículo</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Filtros de categorías */}
        {mostrarCategorias && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-gray-600" />
                <h3 className="font-medium text-gray-900">Filtrar por categoría</h3>
              </div>
              {puedeCrearArticulos && (
                <button
                  onClick={() => handleAbrirModalCategoria()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-700 text-white text-sm rounded-lg hover:bg-red-800 transition-colors"
                >
                  <Plus size={16} />
                  Nueva
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategoriaSeleccionada(null)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${categoriaSeleccionada === null
                  ? 'bg-red-700 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Todas
              </button>
              {categorias.map((categoria) => (
                <div key={categoria.id} className="relative group">
                  <button
                    onClick={() => setCategoriaSeleccionada(categoria.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${categoriaSeleccionada === categoria.id
                      ? 'bg-red-700 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      } ${puedeCrearArticulos ? 'pr-8' : ''}`}
                  >
                    {categoria.nombre}
                  </button>
                  {puedeCrearArticulos && (
                    <div className="absolute top-0 right-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAbrirModalCategoria(categoria);
                        }}
                        className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                        title="Editar"
                      >
                        <Edit2 size={10} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEliminarCategoria(categoria);
                        }}
                        className="p-1.5 bg-red-600 text-white rounded hover:bg-red-700"
                        title="Eliminar"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filtros de ubicaciones */}
        {mostrarUbicaciones && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-gray-600" />
                <h3 className="font-medium text-gray-900">Filtrar por ubicación</h3>
              </div>
              {puedeCrearArticulos && (
                <button
                  onClick={() => handleAbrirModalUbicacion()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-700 text-white text-sm rounded-lg hover:bg-red-800 transition-colors"
                >
                  <Plus size={16} />
                  Nueva
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setUbicacionSeleccionada(null)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${ubicacionSeleccionada === null
                  ? 'bg-red-700 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Todas
              </button>
              {ubicaciones.map((ubicacion) => (
                <div key={ubicacion.id} className="relative group">
                  <button
                    onClick={() => setUbicacionSeleccionada(ubicacion.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${ubicacionSeleccionada === ubicacion.id
                      ? 'bg-red-700 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      } ${puedeCrearArticulos ? 'pr-8' : ''}`}
                  >
                    {ubicacion.codigo || ubicacion.nombre}
                  </button>
                  {puedeCrearArticulos && (
                    <div className="absolute top-0 right-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAbrirModalUbicacion(ubicacion);
                        }}
                        className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                        title="Editar"
                      >
                        <Edit2 size={10} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEliminarUbicacion(ubicacion);
                        }}
                        className="p-1.5 bg-red-600 text-white rounded hover:bg-red-700"
                        title="Eliminar"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sección Unificada: Artículos (Consumibles + Herramientas) */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-orange-50 border-b border-gray-200 px-4 md:px-6 py-3">
          <h2 className="text-base md:text-lg font-semibold text-gray-900 flex items-center gap-2">
            📦 Inventario
            <span className="text-xs md:text-sm font-normal text-gray-700">
              ({filteredArticulos.length} artículos total)
            </span>
          </h2>
        </div>

        {/* Vista Desktop: Tabla */}
        <div className="hidden md:block overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artículo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicación</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Disponible</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidad</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Sección: Consumibles */}
              {filteredArticulos.filter(item => !item.es_herramienta).length > 0 && (
                <>
                  <tr className="bg-blue-50 sticky top-[49px] z-20 border-b border-blue-200 shadow-sm">
                    <td colSpan="7" className="px-6 py-3">
                      <div className="flex items-center gap-2 font-semibold text-blue-900">
                        📦 Consumibles
                        <span className="text-xs font-normal text-blue-700">
                          ({filteredArticulos.filter(item => !item.es_herramienta).length})
                        </span>
                      </div>
                    </td>
                  </tr>
                  {filteredArticulos.filter(item => !item.es_herramienta).map((item) => {
                    const imagenUrl = item.imagen_url
                      ? getImageUrl(item.imagen_url)
                      : null;

                    // Detectar si la ubicación es "REVISAR"
                    const esUbicacionRevisar = item.ubicacion?.codigo?.toUpperCase() === 'REVISAR' ||
                      item.ubicacion?.nombre?.toUpperCase() === 'REVISAR';

                    // Detectar si el artículo está pendiente de revisión (creado por almacén)
                    const esPendienteRevision = item.pendiente_revision === true;

                    // Detectar si el artículo está en el conteo cíclico activo
                    const esEnConteo = articulosEnConteo.has(item.id);

                    return (
                      <tr
                        key={item.id}
                        onClick={() => handleVerDetalle(item)}
                        className={`transition-colors cursor-pointer ${esPendienteRevision
                          ? 'bg-orange-100 hover:bg-orange-200 border-l-4 border-orange-500'
                          : esUbicacionRevisar
                            ? 'bg-yellow-100 hover:bg-yellow-200 border-l-4 border-yellow-500'
                            : esEnConteo
                              ? 'bg-blue-50 hover:bg-blue-100 border-l-4 border-blue-400'
                              : 'hover:bg-gray-50'
                          }`}
                      >
                        {/* Artículo con imagen */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {imagenUrl ? (
                              <img
                                src={imagenUrl}
                                alt={item.nombre}
                                className="w-10 h-10 object-cover rounded-lg"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">
                                📦
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-gray-900">{item.nombre}</div>
                              <div className="text-sm text-gray-500">{item.descripcion}</div>
                            </div>
                          </div>
                        </td>

                        {/* Categoría */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {item.categoria?.nombre || 'Sin categoría'}
                          </span>
                        </td>

                        {/* Ubicación */}
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          {esUbicacionRevisar ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-200 text-yellow-900 font-bold rounded border-2 border-yellow-400">
                              ⚠️ {item.ubicacion?.codigo || item.ubicacion?.nombre}
                            </span>
                          ) : (
                            <span className="text-gray-500">{item.ubicacion?.codigo || item.ubicacion?.nombre || 'N/A'}</span>
                          )}
                        </td>

                        {/* Stock Total (para consumibles es stock actual) */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`font-medium ${parseFloat(item.stock_actual) <= parseFloat(item.stock_minimo) ? 'text-red-600' : 'text-gray-900'}`}>
                            {formatearCantidad(item.stock_actual, item.unidad)}
                          </span>
                        </td>

                        {/* Stock Disponible (no aplica para consumibles) */}
                        <td className="px-4 py-4 whitespace-nowrap text-center text-gray-400 text-sm">
                          -
                        </td>

                        {/* Unidad */}
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 uppercase">
                          {item.unidad}
                        </td>

                        {/* Acciones */}
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            {puedeGestionarInventario && (
                              <button
                                onClick={() => handleAbrirEntrada(item)}
                                className="inline-flex items-center gap-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                                title="Registrar entrada de inventario"
                              >
                                <PackagePlus size={16} />
                                Entrada
                              </button>
                            )}
                            {puedeRegistrarSalida && (
                              <button
                                onClick={() => handleAbrirSalida(item)}
                                className="inline-flex items-center gap-1 px-3 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700"
                                title="Registrar salida de inventario"
                              >
                                <PackageMinus size={16} />
                                Salida
                              </button>
                            )}
                            {puedeAgregarAlPedido && (
                              <button
                                onClick={() => handleAgregarAlPedido(item)}
                                className="inline-flex items-center gap-1 px-3 py-2 bg-red-700 text-white text-sm rounded-lg hover:bg-red-800"
                              >
                                <Plus size={16} />
                                Agregar
                              </button>
                            )}
                            {puedeEditarArticulos && (
                              mostrarDesactivados ? (
                                <>
                                  <button
                                    onClick={() => handleReactivar(item)}
                                    className="inline-flex items-center gap-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                                    title="Reactivar artículo"
                                  >
                                    <Plus size={16} />
                                    Reactivar
                                  </button>
                                  {esAdministrador && (
                                    <button
                                      onClick={() => handleEliminarPermanente(item)}
                                      className="inline-flex items-center gap-1 px-3 py-2 bg-red-800 text-white text-sm rounded-lg hover:bg-red-900"
                                      title="Eliminar permanentemente"
                                    >
                                      <Trash2 size={16} />
                                      Eliminar
                                    </button>
                                  )}
                                </>
                              ) : (
                                <button
                                  onClick={() => handleEliminar(item)}
                                  className="inline-flex items-center gap-1 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                                  title="Desactivar artículo"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </>
              )}

              {/* Sección: Herramientas */}
              {filteredArticulos.filter(item => item.es_herramienta).length > 0 && (
                <>
                  <tr className="bg-orange-50 sticky top-[49px] z-20 border-b border-orange-200 shadow-sm">
                    <td colSpan="7" className="px-6 py-3">
                      <div className="flex items-center gap-2 font-semibold text-orange-900">
                        🔧 Herramientas
                        <span className="text-xs font-normal text-orange-700">
                          ({filteredArticulos.filter(item => item.es_herramienta).length})
                        </span>
                      </div>
                    </td>
                  </tr>
                  {filteredArticulos.filter(item => item.es_herramienta).map((item) => {
                    const imagenUrl = item.imagen_url
                      ? getImageUrl(item.imagen_url)
                      : null;

                    // Detectar si la ubicación es "REVISAR"
                    const esUbicacionRevisar = item.ubicacion?.codigo?.toUpperCase() === 'REVISAR' ||
                      item.ubicacion?.nombre?.toUpperCase() === 'REVISAR';

                    // Detectar si el artículo está pendiente de revisión (creado por almacén)
                    const esPendienteRevision = item.pendiente_revision === true;

                    const estaExpandida = herramientasExpandidas[item.id];
                    const unidades = unidadesHerramientas[item.id] || [];
                    const cargandoUnidades = loadingUnidades[item.id];

                    // Detectar si es el artículo encontrado por código
                    const esArticuloEncontrado = articuloEncontradoPorCodigo === item.id;

                    // Detectar si el artículo está en el conteo cíclico activo
                    const esEnConteo = articulosEnConteo.has(item.id);

                    return (
                      <React.Fragment key={item.id}>
                        <tr
                          className={`transition-colors ${esArticuloEncontrado
                            ? 'bg-green-100 hover:bg-green-200 border-l-4 border-green-600 shadow-lg'
                            : esPendienteRevision
                              ? 'bg-orange-100 hover:bg-orange-200 border-l-4 border-orange-500'
                              : esUbicacionRevisar
                                ? 'bg-yellow-100 hover:bg-yellow-200 border-l-4 border-yellow-500'
                                : esEnConteo
                                  ? 'bg-blue-50 hover:bg-blue-100 border-l-4 border-blue-400'
                                  : 'hover:bg-gray-50'
                            }`}
                        >
                          {/* Artículo con imagen y botón expandir */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={(e) => handleToggleHerramienta(item.id, e)}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                                disabled={cargandoUnidades}
                              >
                                {cargandoUnidades ? (
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
                                ) : estaExpandida ? (
                                  <ChevronUp size={20} />
                                ) : (
                                  <ChevronDown size={20} />
                                )}
                              </button>
                              <div
                                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => handleVerDetalle(item)}
                              >
                                {imagenUrl ? (
                                  <img
                                    src={imagenUrl}
                                    alt={item.nombre}
                                    className="w-10 h-10 object-cover rounded-lg"
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">
                                    🔧
                                  </div>
                                )}
                                <div>
                                  <div className="font-medium text-gray-900">{item.nombre}</div>
                                  <div className="text-sm text-gray-500">{item.descripcion}</div>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Categoría */}
                          <td className="px-4 py-4 whitespace-nowrap cursor-pointer" onClick={() => handleVerDetalle(item)}>
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              {item.categoria?.nombre || 'Sin categoría'}
                            </span>
                          </td>

                          {/* Ubicación */}
                          <td className="px-4 py-4 whitespace-nowrap text-sm cursor-pointer" onClick={() => handleVerDetalle(item)}>
                            {esUbicacionRevisar ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-200 text-yellow-900 font-bold rounded border-2 border-yellow-400">
                                ⚠️ {item.ubicacion?.codigo || item.ubicacion?.nombre}
                              </span>
                            ) : (
                              <span className="text-gray-500">{item.ubicacion?.codigo || item.ubicacion?.nombre || 'N/A'}</span>
                            )}
                          </td>

                          {/* Stock Total */}
                          <td className="px-4 py-4 whitespace-nowrap cursor-pointer" onClick={() => handleVerDetalle(item)}>
                            <span className="font-medium text-gray-900">
                              {item.tipo_herramienta_migrado?.total_unidades || 0}
                            </span>
                          </td>

                          {/* Stock Disponible */}
                          <td className="px-4 py-4 whitespace-nowrap cursor-pointer" onClick={() => handleVerDetalle(item)}>
                            <span className={`font-medium ${(item.tipo_herramienta_migrado?.unidades_disponibles || 0) === 0
                              ? 'text-red-600'
                              : 'text-green-600'
                              }`}>
                              {item.tipo_herramienta_migrado?.unidades_disponibles || 0}
                            </span>
                          </td>

                          {/* Unidad */}
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 uppercase cursor-pointer" onClick={() => handleVerDetalle(item)}>
                            unidades
                          </td>

                          {/* Acciones */}
                          <td className="px-4 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              {puedeGestionarInventario && (
                                <button
                                  onClick={() => handleAbrirEntrada(item)}
                                  className="inline-flex items-center gap-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                                  title="Registrar entrada de inventario"
                                >
                                  <PackagePlus size={16} />
                                  Entrada
                                </button>
                              )}
                              {puedeRegistrarSalida && (
                                <button
                                  onClick={() => handleAbrirSalida(item)}
                                  className="inline-flex items-center gap-1 px-3 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700"
                                  title="Registrar salida de inventario"
                                >
                                  <PackageMinus size={16} />
                                  Salida
                                </button>
                              )}
                              {puedeAgregarAlPedido && (
                                <button
                                  onClick={() => handleAgregarAlPedido(item)}
                                  className="inline-flex items-center gap-1 px-3 py-2 bg-red-700 text-white text-sm rounded-lg hover:bg-red-800"
                                >
                                  <Plus size={16} />
                                  Agregar
                                </button>
                              )}
                              {puedeEditarArticulos && (
                                mostrarDesactivados ? (
                                  <>
                                    <button
                                      onClick={() => handleReactivar(item)}
                                      className="inline-flex items-center gap-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                                      title="Reactivar artículo"
                                    >
                                      <Plus size={16} />
                                      Reactivar
                                    </button>
                                    {esAdministrador && (
                                      <button
                                        onClick={() => handleEliminarPermanente(item)}
                                        className="inline-flex items-center gap-1 px-3 py-2 bg-red-800 text-white text-sm rounded-lg hover:bg-red-900"
                                        title="Eliminar permanentemente"
                                      >
                                        <Trash2 size={16} />
                                        Eliminar
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleEliminar(item)}
                                    className="inline-flex items-center gap-1 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                                    title="Desactivar artículo"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Filas de unidades expandidas */}
                        {estaExpandida && unidades.length > 0 && unidades.map((unidad) => (
                          <tr key={`unidad-${unidad.id}`} className="bg-gray-50">
                            <td colSpan="6" className="px-4 py-3">
                              <div
                                onClick={(e) => handleVerDetalleUnidad(unidad, item.id, e)}
                                className="ml-12 flex items-center gap-6 p-3 bg-white rounded-lg border-2 border-gray-200 hover:border-red-400 hover:shadow-md transition-all cursor-pointer group"
                              >
                                {/* ID de la unidad */}
                                <div className="text-sm">
                                  <span className="text-gray-500">ID:</span>
                                  <p className="font-bold text-gray-900">#{unidad.id}</p>
                                </div>

                                {/* Código de barras */}
                                <div className="flex items-center gap-4">
                                  <AuthenticatedImage
                                    src={`/herramientas-renta/unidades/${unidad.id}/barcode`}
                                    alt={`Código de barras ${unidad.codigo_unico}`}
                                    className="h-16"
                                    placeholderClassName="w-32 h-16 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400"
                                  />
                                </div>

                                {/* Información de la unidad */}
                                <div className="flex-1 grid grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-500">Código Único:</span>
                                    <p className="font-mono font-bold text-red-700">{unidad.codigo_unico}</p>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Estado:</span>
                                    <p className={`font-medium ${unidad.estado === 'buen_estado' || unidad.estado === 'disponible' ? 'text-green-600' :
                                      unidad.estado === 'estado_regular' || unidad.estado === 'en_reparacion' ? 'text-yellow-600' :
                                        unidad.estado === 'mal_estado' || unidad.estado === 'perdida' || unidad.estado === 'baja' ? 'text-red-600' :
                                          unidad.estado === 'asignada' ? 'text-blue-600' :
                                            'text-gray-600'
                                      }`}>
                                      {unidad.estado === 'buen_estado' ? '🟢 Buen estado' :
                                        unidad.estado === 'estado_regular' ? '🟡 Estado regular' :
                                          unidad.estado === 'mal_estado' ? '🔴 Mal estado' :
                                            unidad.estado === 'disponible' ? '🟢 Buen estado' :
                                              unidad.estado === 'asignada' ? '📍 Asignada' :
                                                unidad.estado === 'en_reparacion' ? '🟡 Estado regular' :
                                                  unidad.estado === 'perdida' || unidad.estado === 'baja' ? '🔴 Mal estado' :
                                                    unidad.estado}
                                    </p>
                                  </div>
                                </div>

                                {/* Botones de acción */}
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleVerDetalleUnidad(unidad, item.id, e);
                                    }}
                                    className="inline-flex items-center gap-1 px-3 py-2 bg-red-700 text-white text-sm rounded-lg hover:bg-red-800 transition-colors"
                                    title="Ver detalles completos"
                                  >
                                    <Eye size={16} />
                                    Ver Detalles
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDescargarCodigoBarras(unidad.id, unidad.codigo_unico);
                                    }}
                                    className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                                    title="Descargar código de barras"
                                  >
                                    <Download size={16} />
                                    Descargar
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleImprimirCodigoBarras(unidad.id, unidad.codigo_unico, item.nombre);
                                    }}
                                    className="inline-flex items-center gap-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                                    title="Imprimir código de barras"
                                  >
                                    <Printer size={16} />
                                    Imprimir
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}

                        {/* Mensaje si no hay unidades */}
                        {estaExpandida && unidades.length === 0 && (
                          <tr className="bg-gray-50">
                            <td colSpan="11" className="px-4 py-3">
                              <div className="ml-12 p-4 text-center text-gray-500 bg-white rounded-lg border border-gray-200">
                                No hay unidades registradas para esta herramienta
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </>
              )}

              {/* Mensaje si no hay artículos */}
              {filteredArticulos.length === 0 && (
                <tr>
                  <td colSpan="11" className="px-6 py-8 text-center text-gray-500">
                    No se encontraron artículos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Vista Móvil: Cards unificadas */}
        <div className="md:hidden divide-y divide-gray-200 max-h-[calc(100vh-300px)] overflow-y-auto">
          {/* Sección: Consumibles */}
          {filteredArticulos.filter(item => !item.es_herramienta).length > 0 && (
            <>
              <div className="bg-blue-50 px-4 py-3 sticky top-0 z-20 border-b border-blue-200 shadow-sm">
                <div className="flex items-center gap-2 font-semibold text-blue-900">
                  📦 Consumibles
                  <span className="text-xs font-normal text-blue-700">
                    ({filteredArticulos.filter(item => !item.es_herramienta).length})
                  </span>
                </div>
              </div>
              {filteredArticulos.filter(item => !item.es_herramienta).map((item) => {
                const imagenUrl = item.imagen_url
                  ? getImageUrl(item.imagen_url)
                  : null;

                // Detectar si la ubicación es "REVISAR"
                const esUbicacionRevisar = item.ubicacion?.codigo?.toUpperCase() === 'REVISAR' ||
                  item.ubicacion?.nombre?.toUpperCase() === 'REVISAR';

                // Detectar si el artículo está pendiente de revisión (creado por almacén)
                const esPendienteRevision = item.pendiente_revision === true;

                // Detectar si el artículo está en el conteo cíclico activo
                const esEnConteo = articulosEnConteo.has(item.id);

                return (
                  <div
                    key={`consumible-${item.id}`}
                    onClick={() => handleVerDetalle(item)}
                    className={`p-3 transition-colors cursor-pointer ${esPendienteRevision
                      ? 'bg-orange-100 hover:bg-orange-200 border-l-4 border-orange-500'
                      : esUbicacionRevisar
                        ? 'bg-yellow-100 hover:bg-yellow-200 border-l-4 border-yellow-500'
                        : esEnConteo
                          ? 'bg-blue-50 hover:bg-blue-100 border-l-4 border-blue-400'
                          : 'hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex gap-3">
                      {/* Imagen */}
                      {imagenUrl ? (
                        <img
                          src={imagenUrl}
                          alt={item.nombre}
                          className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                          📦
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm mb-0.5 line-clamp-1">{item.nombre}</h3>
                        <p className="text-xs text-gray-500 mb-2 line-clamp-2">{item.descripcion}</p>

                        {/* Badge de categoría */}
                        <div className="mb-2">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 font-medium">
                            {item.categoria?.nombre || 'Sin categoría'}
                          </span>
                        </div>

                        {/* Ubicación y Stock en una línea */}
                        <div className="flex items-center gap-3 text-xs mb-2">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">📍</span>
                            {esUbicacionRevisar ? (
                              <span className="text-yellow-900 font-bold">
                                ⚠️ {item.ubicacion?.codigo || item.ubicacion?.nombre}
                              </span>
                            ) : (
                              <span className="text-gray-700 font-medium">{item.ubicacion?.codigo || 'N/A'}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">📦</span>
                            <span className={`font-bold ${parseFloat(item.stock_actual) <= parseFloat(item.stock_minimo) ? 'text-red-600' : 'text-gray-900'}`}>
                              {formatearCantidad(item.stock_actual, item.unidad)}
                            </span>
                            <span className="text-gray-400 text-[10px] uppercase">{item.unidad}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Botones de acción */}
                    <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                      {puedeGestionarInventario && (
                        <button
                          onClick={() => handleAbrirEntrada(item)}
                          className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700"
                        >
                          <PackagePlus size={14} />
                          Entrada
                        </button>
                      )}
                      {puedeRegistrarSalida && (
                        <button
                          onClick={() => handleAbrirSalida(item)}
                          className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1 px-3 py-2 bg-orange-600 text-white text-xs rounded-lg hover:bg-orange-700"
                        >
                          <PackageMinus size={14} />
                          Salida
                        </button>
                      )}
                      {puedeAgregarAlPedido && (
                        <button
                          onClick={() => handleAgregarAlPedido(item)}
                          className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1 px-3 py-2 bg-red-700 text-white text-xs rounded-lg hover:bg-red-800"
                        >
                          <Plus size={14} />
                          Agregar
                        </button>
                      )}
                      {puedeEditarArticulos && (
                        mostrarDesactivados ? (
                          <>
                            <button
                              onClick={() => handleReactivar(item)}
                              className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700"
                            >
                              <Plus size={14} />
                              Reactivar
                            </button>
                            {esAdministrador && (
                              <button
                                onClick={() => handleEliminarPermanente(item)}
                                className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1 px-3 py-2 bg-red-800 text-white text-xs rounded-lg hover:bg-red-900"
                              >
                                <Trash2 size={14} />
                                Eliminar
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={() => handleEliminar(item)}
                            className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1 px-3 py-2 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700"
                          >
                            <Trash2 size={14} />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Sección: Herramientas */}
          {filteredArticulos.filter(item => item.es_herramienta).length > 0 && (
            <>
              <div className="bg-orange-50 px-4 py-3 sticky top-0 z-20 border-b border-orange-200 shadow-sm">
                <div className="flex items-center gap-2 font-semibold text-orange-900">
                  🔧 Herramientas
                  <span className="text-xs font-normal text-orange-700">
                    ({filteredArticulos.filter(item => item.es_herramienta).length})
                  </span>
                </div>
              </div>

              {filteredArticulos.filter(item => item.es_herramienta).map((item) => {
                const imagenUrl = item.imagen_url
                  ? getImageUrl(item.imagen_url)
                  : null;

                // Detectar si la ubicación es "REVISAR"
                const esUbicacionRevisar = item.ubicacion?.codigo?.toUpperCase() === 'REVISAR' ||
                  item.ubicacion?.nombre?.toUpperCase() === 'REVISAR';

                // Detectar si el artículo está pendiente de revisión (creado por almacén)
                const esPendienteRevision = item.pendiente_revision === true;

                const estaExpandida = herramientasExpandidas[item.id];
                const unidades = unidadesHerramientas[item.id] || [];
                const cargandoUnidades = loadingUnidades[item.id];

                // Detectar si es el artículo encontrado por código
                const esArticuloEncontrado = articuloEncontradoPorCodigo === item.id;

                return (
                  <React.Fragment key={`herramienta-${item.id}`}>
                    <div
                      className={`p-3 transition-colors ${esArticuloEncontrado
                        ? 'bg-green-100 hover:bg-green-200 border-l-4 border-green-600 shadow-lg'
                        : esPendienteRevision
                          ? 'bg-orange-100 hover:bg-orange-200 border-l-4 border-orange-500'
                          : esUbicacionRevisar
                            ? 'bg-yellow-100 hover:bg-yellow-200 border-l-4 border-yellow-500'
                            : 'hover:bg-gray-50'
                        }`}
                    >
                      {/* Header con botón expandir */}
                      <div className="flex items-center gap-2 mb-2">
                        <button
                          onClick={(e) => handleToggleHerramienta(item.id, e)}
                          className="text-gray-400 hover:text-gray-600 transition-colors p-1 flex-shrink-0"
                          disabled={cargandoUnidades}
                        >
                          {cargandoUnidades ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                          ) : estaExpandida ? (
                            <ChevronUp size={18} />
                          ) : (
                            <ChevronDown size={18} />
                          )}
                        </button>
                        <h3
                          className="font-semibold text-gray-900 text-sm cursor-pointer hover:text-red-700 transition-colors flex-1 line-clamp-1"
                          onClick={() => handleVerDetalle(item)}
                        >
                          {item.nombre}
                        </h3>
                      </div>

                      <div className="flex gap-3 cursor-pointer ml-7" onClick={() => handleVerDetalle(item)}>
                        {/* Imagen */}
                        {imagenUrl ? (
                          <img
                            src={imagenUrl}
                            alt={item.nombre}
                            className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                            🔧
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 mb-2 line-clamp-2">{item.descripcion}</p>

                          {/* Badge de categoría */}
                          <div className="mb-2">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 font-medium">
                              {item.categoria?.nombre || 'Sin categoría'}
                            </span>
                          </div>

                          {/* Ubicación */}
                          <div className="flex items-center gap-3 text-xs mb-1">
                            <div className="flex items-center gap-1">
                              <span className="text-gray-500">📍</span>
                              {esUbicacionRevisar ? (
                                <span className="text-yellow-900 font-bold">
                                  ⚠️ {item.ubicacion?.codigo || item.ubicacion?.nombre}
                                </span>
                              ) : (
                                <span className="text-gray-700 font-medium">{item.ubicacion?.codigo || 'N/A'}</span>
                              )}
                            </div>
                          </div>

                          {/* Stock Total y Disponible */}
                          <div className="flex items-center gap-3 text-xs mb-2">
                            <div className="flex items-center gap-1">
                              <span className="text-gray-500 text-[10px]">Total:</span>
                              <span className="font-bold text-gray-900">
                                {item.tipo_herramienta_migrado?.total_unidades || 0}
                              </span>
                              <span className="text-gray-400 text-[10px]">unidades</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-gray-500 text-[10px]">Disponible:</span>
                              <span className={`font-bold ${(item.tipo_herramienta_migrado?.unidades_disponibles || 0) === 0
                                ? 'text-red-600'
                                : 'text-green-600'
                                }`}>
                                {item.tipo_herramienta_migrado?.unidades_disponibles || 0}
                              </span>
                              <span className="text-gray-400 text-[10px]">unidades</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                        {puedeGestionarInventario && (
                          <button
                            onClick={() => handleAbrirEntrada(item)}
                            className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700"
                          >
                            <PackagePlus size={14} />
                            Entrada
                          </button>
                        )}
                        {puedeRegistrarSalida && (
                          <button
                            onClick={() => handleAbrirSalida(item)}
                            className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1 px-3 py-2 bg-orange-600 text-white text-xs rounded-lg hover:bg-orange-700"
                          >
                            <PackageMinus size={14} />
                            Salida
                          </button>
                        )}
                        {puedeAgregarAlPedido && (
                          <button
                            onClick={() => handleAgregarAlPedido(item)}
                            className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1 px-3 py-2 bg-red-700 text-white text-xs rounded-lg hover:bg-red-800"
                          >
                            <Plus size={14} />
                            Agregar
                          </button>
                        )}
                        {puedeEditarArticulos && (
                          mostrarDesactivados ? (
                            <>
                              <button
                                onClick={() => handleReactivar(item)}
                                className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700"
                              >
                                <Plus size={14} />
                                Reactivar
                              </button>
                              {esAdministrador && (
                                <button
                                  onClick={() => handleEliminarPermanente(item)}
                                  className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1 px-3 py-2 bg-red-800 text-white text-xs rounded-lg hover:bg-red-900"
                                >
                                  <Trash2 size={14} />
                                  Eliminar
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={() => handleEliminar(item)}
                              className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1 px-3 py-2 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700"
                            >
                              <Trash2 size={14} />
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Unidades expandidas - Vista móvil */}
                    {estaExpandida && (
                      <div className="mt-2 ml-8 space-y-2">
                        {unidades.length > 0 ? (
                          unidades.map((unidad) => (
                            <div key={`unidad-mobile-${unidad.id}`} className="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
                              {/* ID y Código de barras */}
                              <div className="flex items-center gap-3">
                                <div className="text-xs">
                                  <span className="text-gray-500">ID:</span>
                                  <span className="ml-1 font-bold text-gray-900">#{unidad.id}</span>
                                </div>
                                <AuthenticatedImage
                                  src={`/herramientas-renta/unidades/${unidad.id}/barcode`}
                                  alt={`Código ${unidad.codigo_unico}`}
                                  className="h-12 flex-shrink-0"
                                  placeholderClassName="w-24 h-12 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400"
                                />
                              </div>

                              {/* Info de la unidad */}
                              <div className="text-xs space-y-1">
                                <div>
                                  <span className="text-gray-500">Código:</span>
                                  <span className="ml-1 font-mono font-bold text-red-700">{unidad.codigo_unico}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Estado:</span>
                                  <span className={`ml-1 font-medium ${unidad.estado === 'buen_estado' || unidad.estado === 'disponible' ? 'text-green-600' :
                                    unidad.estado === 'estado_regular' || unidad.estado === 'en_reparacion' ? 'text-yellow-600' :
                                      unidad.estado === 'mal_estado' || unidad.estado === 'perdida' || unidad.estado === 'baja' ? 'text-red-600' :
                                        unidad.estado === 'asignada' ? 'text-blue-600' :
                                          'text-gray-600'
                                    }`}>
                                    {unidad.estado === 'buen_estado' ? '🟢 Buen estado' :
                                      unidad.estado === 'estado_regular' ? '🟡 Estado regular' :
                                        unidad.estado === 'mal_estado' ? '🔴 Mal estado' :
                                          unidad.estado === 'disponible' ? '🟢 Buen estado' :
                                            unidad.estado === 'asignada' ? '📍 Asignada' :
                                              unidad.estado === 'en_reparacion' ? '🟡 Estado regular' :
                                                unidad.estado === 'perdida' || unidad.estado === 'baja' ? '🔴 Mal estado' :
                                                  unidad.estado}
                                  </span>
                                </div>
                              </div>

                              {/* Botones de acción */}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleDescargarCodigoBarras(unidad.id, unidad.codigo_unico)}
                                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                  <Download size={14} />
                                  Descargar
                                </button>
                                <button
                                  onClick={() => handleImprimirCodigoBarras(unidad.id, unidad.codigo_unico, item.nombre)}
                                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors"
                                >
                                  <Printer size={14} />
                                  Imprimir
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center text-gray-500 text-sm">
                            No hay unidades registradas
                          </div>
                        )}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </>
          )}

          {/* Mensaje si no hay artículos */}
          {filteredArticulos.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500">
              No se encontraron artículos
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalles con código de barras */}
      <ArticuloDetalleModal
        articulo={articuloSeleccionado}
        isOpen={modalDetalleOpen}
        onClose={() => setModalDetalleOpen(false)}
        onEdit={handleEditar}
        canEdit={puedeEditarArticulos}
        onEntrada={handleAbrirEntrada}
        onSalida={handleAbrirSalida}
        puedeGestionarInventario={puedeGestionarInventario}
        puedeRegistrarSalida={puedeRegistrarSalida}
      />

      {/* Modal de formulario para crear/editar */}
      <ArticuloFormModal
        isOpen={modalFormOpen}
        onClose={handleCloseForm}
        onSuccess={handleFormSuccess}
        articulo={articuloAEditar}
        codigoInicial={codigoEscaneado}
      />

      {/* Modal del Scanner de Códigos de Barras */}
      <Modal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        title="Escanear Código de Barras EAN-13"
        size="xl"
      >
        <EAN13Scanner onClose={() => setShowScanner(false)} />
      </Modal>

      {/* Modal de Entrada de Inventario */}
      <Modal
        isOpen={modalEntradaOpen}
        onClose={handleCerrarEntrada}
        title={`Entrada de Inventario: ${articuloParaEntrada?.nombre || ''}`}
      >
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Stock actual:</span>
                <span className="ml-2 font-semibold text-gray-900">
                  {articuloParaEntrada ? formatearCantidad(articuloParaEntrada.stock_actual, articuloParaEntrada.unidad) : '0'} {articuloParaEntrada?.unidad}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Ubicación:</span>
                <span className="ml-2 font-semibold text-gray-900">
                  {articuloParaEntrada?.ubicacion?.codigo || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cantidad a ingresar <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              value={cantidadEntrada}
              onChange={(e) => setCantidadEntrada(e.target.value)}
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              placeholder="Ej: 100"
              disabled={loadingEntrada}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones
            </label>
            <textarea
              value={observacionesEntrada}
              onChange={(e) => setObservacionesEntrada(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              placeholder="Notas adicionales sobre la entrada..."
              disabled={loadingEntrada}
            />
          </div>

          {cantidadEntrada && parseFloat(cantidadEntrada) > 0 && articuloParaEntrada && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">
                Nuevo stock: <span className="font-semibold">
                  {formatearCantidad(parseFloat(articuloParaEntrada.stock_actual) + parseFloat(cantidadEntrada), articuloParaEntrada.unidad)} {articuloParaEntrada.unidad}
                </span>
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleCerrarEntrada}
              disabled={loadingEntrada}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGuardarEntrada}
              disabled={loadingEntrada || !cantidadEntrada || parseFloat(cantidadEntrada) <= 0}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loadingEntrada ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <PackagePlus size={18} />
                  Registrar Entrada
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de Salida de Inventario */}
      <Modal
        isOpen={modalSalidaOpen}
        onClose={handleCerrarSalida}
        title={`Salida de Inventario: ${articuloParaSalida?.nombre || ''}`}
      >
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Stock actual:</span>
                <span className="ml-2 font-semibold text-gray-900">
                  {articuloParaSalida ? formatearCantidad(articuloParaSalida.stock_actual, articuloParaSalida.unidad) : '0'} {articuloParaSalida?.unidad}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Ubicación:</span>
                <span className="ml-2 font-semibold text-gray-900">
                  {articuloParaSalida?.ubicacion?.codigo || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cantidad a retirar <span className="text-red-600">*</span>
            </label>
            <input
              type="number"
              value={cantidadSalida}
              onChange={(e) => setCantidadSalida(e.target.value)}
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"
              placeholder="Ej: 50"
              disabled={loadingSalida}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones
            </label>
            <textarea
              value={observacionesSalida}
              onChange={(e) => setObservacionesSalida(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-600"
              placeholder="Motivo de la salida..."
              disabled={loadingSalida}
            />
          </div>

          {cantidadSalida && parseFloat(cantidadSalida) > 0 && articuloParaSalida && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-sm text-orange-800">
                Nuevo stock: <span className="font-semibold">
                  {formatearCantidad(parseFloat(articuloParaSalida.stock_actual) - parseFloat(cantidadSalida), articuloParaSalida.unidad)} {articuloParaSalida.unidad}
                </span>
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleCerrarSalida}
              disabled={loadingSalida}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGuardarSalida}
              disabled={loadingSalida || !cantidadSalida || parseFloat(cantidadSalida) <= 0}
              className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loadingSalida ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <PackageMinus size={18} />
                  Registrar Salida
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de Categoría */}
      <Modal
        isOpen={modalCategoriaOpen}
        onClose={handleCerrarModalCategoria}
        title={categoriaEditando ? 'Editar Categoría' : 'Nueva Categoría'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la categoría <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={nombreCategoria}
              onChange={(e) => setNombreCategoria(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
              placeholder="Ej: Tornillos, Tuercas, etc."
              disabled={loadingCategoria}
              autoFocus
            />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleCerrarModalCategoria}
              disabled={loadingCategoria}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGuardarCategoria}
              disabled={loadingCategoria || !nombreCategoria.trim()}
              className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loadingCategoria ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  {categoriaEditando ? 'Actualizar' : 'Crear'} Categoría
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de Ubicación */}
      <Modal
        isOpen={modalUbicacionOpen}
        onClose={handleCerrarModalUbicacion}
        title={ubicacionEditando ? 'Editar Ubicación' : 'Nueva Ubicación'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={codigoUbicacion}
                onChange={(e) => setCodigoUbicacion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                placeholder="Ej: A-01, B-02, etc."
                disabled={loadingUbicacion}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Almacén
              </label>
              <input
                type="text"
                value={almacenUbicacion}
                onChange={(e) => setAlmacenUbicacion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                placeholder="Ej: Principal, Secundario"
                disabled={loadingUbicacion}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pasillo
              </label>
              <input
                type="text"
                value={pasilloUbicacion}
                onChange={(e) => setPasilloUbicacion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                placeholder="Ej: A, B, C"
                disabled={loadingUbicacion}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estante
              </label>
              <input
                type="text"
                value={estanteUbicacion}
                onChange={(e) => setEstanteUbicacion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                placeholder="Ej: 01, 02, 03"
                disabled={loadingUbicacion}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nivel
              </label>
              <input
                type="number"
                value={nivelUbicacion}
                onChange={(e) => setNivelUbicacion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                placeholder="Ej: 1, 2, 3"
                min="1"
                disabled={loadingUbicacion}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <textarea
                value={descripcionUbicacion}
                onChange={(e) => setDescripcionUbicacion(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                placeholder="Descripción adicional de la ubicación..."
                disabled={loadingUbicacion}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleCerrarModalUbicacion}
              disabled={loadingUbicacion}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGuardarUbicacion}
              disabled={loadingUbicacion || !codigoUbicacion.trim()}
              className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loadingUbicacion ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  {ubicacionEditando ? 'Actualizar' : 'Crear'} Ubicación
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de generación de etiquetas */}
      <Modal
        isOpen={modalEtiquetasOpen}
        onClose={() => setModalEtiquetasOpen(false)}
        title="Generar Etiquetas"
        size="xl"
      >
        <div className="space-y-4">
          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar artículos por nombre o código..."
              value={busquedaEtiquetas}
              onChange={(e) => setBusquedaEtiquetas(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Filtro de tipo de artículo */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setFiltroTipoEtiquetas('todos')}
              className={`flex-1 px-4 py-2 rounded-md font-medium text-sm transition-all ${filtroTipoEtiquetas === 'todos'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltroTipoEtiquetas('consumibles')}
              className={`flex-1 px-4 py-2 rounded-md font-medium text-sm transition-all flex items-center justify-center gap-1.5 ${filtroTipoEtiquetas === 'consumibles'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <Package size={16} />
              Consumibles
            </button>
            <button
              onClick={() => setFiltroTipoEtiquetas('herramientas')}
              className={`flex-1 px-4 py-2 rounded-md font-medium text-sm transition-all flex items-center justify-center gap-1.5 ${filtroTipoEtiquetas === 'herramientas'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <Wrench size={16} />
              Herramientas
            </button>
          </div>

          {/* Filtro por ubicación */}
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-gray-400" />
            <select
              value={filtroUbicacionEtiquetas}
              onChange={(e) => setFiltroUbicacionEtiquetas(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
            >
              <option value="todos">Todas las ubicaciones</option>
              {ubicaciones.filter(u => u.activo !== false).map(ubicacion => (
                <option key={ubicacion.id} value={ubicacion.id}>
                  {ubicacion.codigo} - {ubicacion.almacen}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por estado de etiquetado */}
          <div className="flex items-center gap-2 bg-yellow-50 rounded-lg p-1 border border-yellow-200">
            <button
              onClick={() => setFiltroEstadoEtiquetado('todos')}
              className={`flex-1 px-3 py-1.5 rounded-md font-medium text-xs transition-all ${filtroEstadoEtiquetado === 'todos'
                ? 'bg-white text-yellow-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltroEstadoEtiquetado('sin_etiquetar')}
              className={`flex-1 px-3 py-1.5 rounded-md font-medium text-xs transition-all ${filtroEstadoEtiquetado === 'sin_etiquetar'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              🏷️ Sin etiquetar
            </button>
            <button
              onClick={() => setFiltroEstadoEtiquetado('etiquetados')}
              className={`flex-1 px-3 py-1.5 rounded-md font-medium text-xs transition-all ${filtroEstadoEtiquetado === 'etiquetados'
                ? 'bg-white text-green-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              ✓ Ya etiquetados
            </button>
          </div>

          {/* Contador y botón seleccionar todos */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {articulosSeleccionadosEtiquetas.length} artículo(s) + {unidadesSeleccionadasEtiquetas.length} unidad(es) seleccionada(s)
            </span>
            <button
              onClick={handleSeleccionarTodosEtiquetas}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {(() => {
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

                // Aplicar filtro de búsqueda
                const articulosFiltrados = busquedaEtiquetas.length > 0
                  ? articulosActivos.filter(a =>
                    a.nombre.toLowerCase().includes(busquedaEtiquetas.toLowerCase()) ||
                    a.codigo_ean13?.toLowerCase().includes(busquedaEtiquetas.toLowerCase())
                  )
                  : articulosActivos;

                const todosSeleccionados = articulosFiltrados.length > 0 &&
                  articulosFiltrados.every(a => articulosSeleccionadosEtiquetas.includes(a.id));

                return todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos';
              })()}
            </button>
          </div>

          {/* Lista de artículos con checkboxes */}
          <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
            <div className="divide-y divide-gray-200">
              {(() => {
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

                if (articulosFiltrados.length === 0) {
                  return (
                    <div className="p-8 text-center text-gray-500">
                      <Package size={48} className="mx-auto mb-3 text-gray-300" />
                      <p>No se encontraron artículos</p>
                    </div>
                  );
                }

                return articulosFiltrados.map((articulo) => {
                  const esHerramienta = articulo.es_herramienta;
                  const estaExpandida = herramientasExpandidasEtiquetas[articulo.id];
                  const unidades = unidadesCargadasEtiquetas[articulo.id] || [];

                  // Detectar si la ubicación es "REVISAR"
                  const esUbicacionRevisar = articulo.ubicacion?.codigo?.toUpperCase() === 'REVISAR' ||
                    articulo.ubicacion?.nombre?.toUpperCase() === 'REVISAR';

                  // Detectar si el artículo está pendiente de revisión (creado por almacén)
                  const esPendienteRevision = articulo.pendiente_revision === true;

                  // Obtener URL de la imagen
                  const imagenUrl = articulo.imagen_url
                    ? getImageUrl(articulo.imagen_url)
                    : null;

                  return (
                    <React.Fragment key={articulo.id}>
                      <div className={`flex items-center gap-4 p-4 transition-colors ${esPendienteRevision
                        ? 'bg-orange-100 hover:bg-orange-200 border-l-4 border-orange-500'
                        : esUbicacionRevisar
                          ? 'bg-yellow-100 hover:bg-yellow-200 border-l-4 border-yellow-500'
                          : 'hover:bg-gray-50'
                        }`}>
                        {/* Checkbox para artículos consumibles */}
                        {!esHerramienta && (
                          <input
                            type="checkbox"
                            checked={articulosSeleccionadosEtiquetas.includes(articulo.id)}
                            onChange={() => handleToggleArticuloEtiqueta(articulo.id)}
                            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        )}

                        {/* Para herramientas, solo botón de expandir */}
                        {esHerramienta && (
                          <button
                            onClick={() => handleToggleHerramientaEtiquetas(articulo.id)}
                            className="w-5 h-5 flex items-center justify-center text-gray-600 hover:text-red-600"
                          >
                            {estaExpandida ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </button>
                        )}

                        {/* Imagen del artículo */}
                        {imagenUrl ? (
                          <img
                            src={imagenUrl}
                            alt={articulo.nombre}
                            className="w-10 h-10 object-cover rounded-lg flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                            {esHerramienta ? '🔧' : '📦'}
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium text-gray-900 truncate">{articulo.nombre}</h4>
                            {articulo.etiquetado && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded border border-green-300">
                                ✓ Etiquetado
                              </span>
                            )}
                            {esPendienteRevision && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-200 text-orange-900 text-xs font-bold rounded">
                                🔔 Pendiente de Revisión
                              </span>
                            )}
                            {esUbicacionRevisar && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-200 text-yellow-900 text-xs font-bold rounded border border-yellow-400">
                                ⚠️ REVISAR
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 truncate mt-1">
                            {esHerramienta
                              ? `Herramienta • Stock: ${articulo.stock_actual} unidades`
                              : `EAN-13: ${articulo.codigo_ean13} • Stock: ${articulo.stock_actual}`
                            }
                          </p>
                        </div>
                      </div>

                      {/* Unidades de herramientas expandidas */}
                      {esHerramienta && estaExpandida && (
                        <div className="bg-gray-50 border-t border-gray-200">
                          {unidades.length > 0 ? (
                            <>
                              {/* Header con botón Seleccionar Todas */}
                              <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
                                <span className="text-xs text-gray-600 font-medium">
                                  {unidades.length} unidad(es) • {unidades.filter(u => unidadesSeleccionadasEtiquetas.includes(u.id)).length} seleccionada(s)
                                </span>
                                <button
                                  onClick={() => handleSeleccionarTodasUnidades(articulo.id)}
                                  className={`text-xs font-semibold px-3 py-1 rounded transition-colors ${unidades.every(u => unidadesSeleccionadasEtiquetas.includes(u.id))
                                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                    }`}
                                >
                                  {unidades.every(u => unidadesSeleccionadasEtiquetas.includes(u.id))
                                    ? '✓ Deseleccionar todas'
                                    : 'Seleccionar todas'}
                                </button>
                              </div>
                              {unidades.map((unidad) => (
                                <label
                                  key={unidad.id}
                                  className="flex items-center gap-4 p-3 pl-12 hover:bg-gray-100 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                                >
                                  <input
                                    type="checkbox"
                                    checked={unidadesSeleccionadasEtiquetas.includes(unidad.id)}
                                    onChange={() => handleToggleUnidadEtiqueta(unidad.id)}
                                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono font-bold text-red-600 text-sm">
                                        {unidad.codigo_unico}
                                      </span>
                                      {unidad.etiquetado && (
                                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 font-semibold rounded border border-green-300">
                                          ✓ Etiquetado
                                        </span>
                                      )}
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${unidad.estado === 'disponible' ? 'bg-green-100 text-green-800' :
                                        unidad.estado === 'asignada' ? 'bg-blue-100 text-blue-800' :
                                          'bg-gray-100 text-gray-800'
                                        }`}>
                                        {unidad.estado === 'disponible' ? 'Disponible' :
                                          unidad.estado === 'asignada' ? 'Asignada' : unidad.estado}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      ID: #{unidad.id}
                                    </p>
                                  </div>
                                </label>
                              ))}
                            </>
                          ) : (
                            <div className="p-3 pl-12 text-sm text-gray-500">
                              Cargando unidades...
                            </div>
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  );
                });
              })()}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={() => setModalEtiquetasOpen(false)}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              disabled={loadingEtiquetas}
            >
              Cancelar
            </button>
            <button
              onClick={handleGenerarEtiquetas}
              disabled={(articulosSeleccionadosEtiquetas.length === 0 && unidadesSeleccionadasEtiquetas.length === 0) || loadingEtiquetas}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loadingEtiquetas ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Generando...</span>
                </>
              ) : (
                <>
                  <Barcode size={20} />
                  <span>Generar PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de detalle de unidad de herramienta */}
      {modalUnidadOpen && unidadSeleccionada && tipoHerramientaSeleccionado && (
        <UnidadHerramientaDetalleModal
          unidad={unidadSeleccionada}
          tipoHerramienta={tipoHerramientaSeleccionado}
          isOpen={modalUnidadOpen}
          onClose={() => {
            setModalUnidadOpen(false);
            setUnidadSeleccionada(null);
            setTipoHerramientaSeleccionado(null);
          }}
        />
      )}

      {/* Modal de gestión de almacenes */}
      <Modal
        isOpen={modalAlmacenesOpen}
        onClose={() => {
          setModalAlmacenesOpen(false);
          setAlmacenEditando(null);
          setNuevoNombreAlmacen('');
        }}
        title="Gestionar Almacenes"
        size="lg"
      >
        <div className="space-y-6">
          {/* Crear nuevo almacén */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
              <Plus size={18} />
              Crear Nuevo Almacén
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={nuevoNombreAlmacen}
                onChange={(e) => setNuevoNombreAlmacen(e.target.value)}
                placeholder="Nombre del almacén..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !almacenEditando) {
                    handleCrearAlmacen();
                  }
                }}
              />
              <button
                onClick={handleCrearAlmacen}
                disabled={loadingAlmacenes || !nuevoNombreAlmacen.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loadingAlmacenes ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>

          {/* Lista de almacenes existentes */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Almacenes Existentes ({almacenesDisponibles.length})</h3>
            {almacenesDisponibles.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay almacenes registrados</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {almacenesDisponibles.map((almacen) => {
                  const estaEditando = almacenEditando === almacen.id;

                  return (
                    <div
                      key={almacen.id}
                      className={`border rounded-lg p-4 transition-all ${estaEditando ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      {estaEditando ? (
                        // Modo edición
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={nuevoNombreAlmacen}
                              onChange={(e) => setNuevoNombreAlmacen(e.target.value)}
                              placeholder="Nuevo nombre..."
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleRenombrarAlmacen(almacen);
                                }
                              }}
                              autoFocus
                            />
                            <button
                              onClick={() => handleRenombrarAlmacen(almacen)}
                              disabled={loadingAlmacenes || !nuevoNombreAlmacen.trim()}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              {loadingAlmacenes ? 'Guardando...' : 'Guardar'}
                            </button>
                            <button
                              onClick={() => {
                                setAlmacenEditando(null);
                                setNuevoNombreAlmacen('');
                              }}
                              disabled={loadingAlmacenes}
                              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Modo vista
                        <div>
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-gray-900">🏢 {almacen.nombre}</h4>
                              <p className="text-sm text-gray-500">
                                {almacen.ubicaciones_count || 0} ubicaciones · {almacen.categorias?.length || 0} categorías · {almacen.articulos_count || 0} artículos
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
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
                                }}
                                className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${almacenCategoriasExpandido === almacen.id
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                  }`}
                                title="Gestionar categorías"
                              >
                                {almacenCategoriasExpandido === almacen.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                Categorías
                              </button>
                              <button
                                onClick={() => {
                                  setAlmacenEditando(almacen.id);
                                  setNuevoNombreAlmacen(almacen.nombre);
                                }}
                                disabled={loadingAlmacenes}
                                className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1"
                                title="Renombrar almacén"
                              >
                                <Edit2 size={14} />
                                Renombrar
                              </button>
                              <button
                                onClick={() => handleEliminarAlmacen(almacen)}
                                disabled={loadingAlmacenes}
                                className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-1"
                                title="Eliminar almacén"
                              >
                                <Trash2 size={14} />
                                Eliminar
                              </button>
                            </div>
                          </div>

                          {/* Panel expandible de categorías */}
                          {almacenCategoriasExpandido === almacen.id && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <p className="text-xs font-medium text-gray-600 mb-2">Categorías asignadas a este almacén:</p>
                              {todasLasCategorias.length === 0 ? (
                                <p className="text-sm text-gray-400">Cargando categorías...</p>
                              ) : (
                                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                                  {todasLasCategorias.map((cat) => {
                                    const isAssigned = almacen.categorias?.some(c => c.id === cat.id);
                                    return (
                                      <label
                                        key={cat.id}
                                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors text-sm ${isAssigned
                                          ? 'bg-green-50 border border-green-200 text-green-800'
                                          : 'bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100'
                                          } ${loadingToggleCategoria ? 'opacity-50 pointer-events-none' : ''}`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isAssigned}
                                          onChange={async () => {
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
                                          }}
                                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                        />
                                        {cat.icono && <span>{cat.icono}</span>}
                                        <span className="truncate">{cat.nombre}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Botón cerrar */}
          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={() => {
                setModalAlmacenesOpen(false);
                setAlmacenEditando(null);
                setNuevoNombreAlmacen('');
              }}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default InventarioPage;
