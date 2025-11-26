import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Package, Eye, Barcode, QrCode, Trash2, PackagePlus, PackageMinus, ArrowUpDown, MapPin, Edit2, X, ChevronDown, ChevronUp, Download, Printer } from 'lucide-react';
import api from '../services/api';
import articulosService from '../services/articulos.service';
import movimientosService from '../services/movimientos.service';
import categoriasService from '../services/categorias.service';
import ubicacionesService from '../services/ubicaciones.service';
import herramientasRentaService from '../services/herramientasRenta.service';
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

const InventarioPage = () => {
  const [articulos, setArticulos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState(null);
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
  const [loadingEtiquetas, setLoadingEtiquetas] = useState(false);
  const [herramientasExpandidasEtiquetas, setHerramientasExpandidasEtiquetas] = useState({});
  const [unidadesCargadasEtiquetas, setUnidadesCargadasEtiquetas] = useState({});

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

  const { agregarArticulo } = usePedido();
  const { user } = useAuth();

  // Verificar permisos según el rol
  const puedeCrearArticulos = ['administrador', 'encargado', 'almacen'].includes(user?.rol);
  const puedeEditarArticulos = ['administrador', 'encargado'].includes(user?.rol); // Almacén NO puede editar
  const puedeAgregarAlPedido = ['administrador', 'diseñador'].includes(user?.rol);
  const puedeGestionarInventario = ['administrador', 'encargado', 'almacen'].includes(user?.rol);
  const puedeRegistrarSalida = ['administrador', 'almacen'].includes(user?.rol); // Almacén puede registrar salidas
  const esAdministrador = user?.rol === 'administrador';
  const esAlmacen = user?.rol === 'almacen';

  useEffect(() => {
    fetchArticulos();
    fetchCategorias();
    fetchUbicaciones();
  }, []);

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

  const fetchCategorias = async () => {
    try {
      const data = await categoriasService.getAll();
      setCategorias(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error al cargar categorías:', error);
    }
  };

  const fetchUbicaciones = async () => {
    try {
      const data = await ubicacionesService.getAll();
      setUbicaciones(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error al cargar ubicaciones:', error);
    }
  };

  const filteredArticulos = articulos
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

      return matchesActiveFilter && matchesSearch && matchesCategoria && matchesUbicacion;
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
  };

  const handleSeleccionarTodosEtiquetas = () => {
    const articulosActivos = articulos.filter(a => a.activo);
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
    const articulo = articulosSeleccionadosParaEtiquetas.find(a => a.id === articuloId);
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
            className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border rounded-lg transition-colors ${
              mostrarCategorias
                ? 'bg-red-700 text-white border-red-700 hover:bg-red-800'
                : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Package size={18} />
            <span className="hidden sm:inline">Categorías</span>
          </button>
          <button
            onClick={() => setMostrarUbicaciones(!mostrarUbicaciones)}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border rounded-lg transition-colors ${
              mostrarUbicaciones
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
                className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 text-sm md:text-base rounded-lg transition-colors ${
                  mostrarDesactivados
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
              <button
                onClick={handleNuevoArticulo}
                className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 text-sm md:text-base bg-red-700 text-white rounded-lg hover:bg-red-800"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Nuevo Artículo</span>
              </button>
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
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  categoriaSeleccionada === null
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
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      categoriaSeleccionada === categoria.id
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
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  ubicacionSeleccionada === null
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
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      ubicacionSeleccionada === ubicacion.id
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Actual</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Mín</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Máx</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidad</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedores</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actualizado</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Sección: Consumibles */}
              {filteredArticulos.filter(item => !item.es_herramienta).length > 0 && (
                <>
                  <tr className="bg-blue-50 sticky top-[49px] z-20 border-b border-blue-200 shadow-sm">
                    <td colSpan="11" className="px-6 py-3">
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

                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleVerDetalle(item)}
                      className={`transition-colors cursor-pointer ${
                        esPendienteRevision
                          ? 'bg-orange-100 hover:bg-orange-200 border-l-4 border-orange-500'
                          : esUbicacionRevisar
                          ? 'bg-yellow-100 hover:bg-yellow-200 border-l-4 border-yellow-500'
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

                      {/* Stock Actual */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`font-medium ${parseFloat(item.stock_actual) <= parseFloat(item.stock_minimo) ? 'text-red-600' : 'text-gray-900'}`}>
                          {parseFloat(item.stock_actual).toFixed(2)}
                        </span>
                      </td>

                      {/* Stock Mínimo */}
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                        {parseFloat(item.stock_minimo).toFixed(2)}
                      </td>

                      {/* Stock Máximo */}
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                        {item.stock_maximo ? parseFloat(item.stock_maximo).toFixed(2) : 'N/A'}
                      </td>

                      {/* Unidad */}
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 uppercase">
                        {item.unidad}
                      </td>

                      {/* Proveedores */}
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {item.proveedores && item.proveedores.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {item.proveedores.map((prov, idx) => (
                              <span key={idx} className={`text-xs ${prov.ArticuloProveedor?.es_preferido ? 'font-semibold text-green-700' : 'text-gray-600'}`}>
                                {prov.nombre}{prov.ArticuloProveedor?.es_preferido ? ' ⭐' : ''}
                              </span>
                            ))}
                          </div>
                        ) : (
                          'N/A'
                        )}
                      </td>

                      {/* Fecha creación */}
                      <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-500">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                      </td>

                      {/* Fecha actualización */}
                      <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-500">
                        {item.updated_at ? new Date(item.updated_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
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
                    <td colSpan="11" className="px-6 py-3">
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

                    return (
                      <React.Fragment key={item.id}>
                        <tr
                          className={`transition-colors ${
                            esPendienteRevision
                              ? 'bg-orange-100 hover:bg-orange-200 border-l-4 border-orange-500'
                              : esUbicacionRevisar
                              ? 'bg-yellow-100 hover:bg-yellow-200 border-l-4 border-yellow-500'
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

                        {/* Stock Actual */}
                        <td className="px-4 py-4 whitespace-nowrap cursor-pointer" onClick={() => handleVerDetalle(item)}>
                          <span className={`font-medium ${parseFloat(item.stock_actual) <= parseFloat(item.stock_minimo) ? 'text-red-600' : 'text-gray-900'}`}>
                            {parseFloat(item.stock_actual).toFixed(2)}
                          </span>
                        </td>

                        {/* Stock Mínimo */}
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 cursor-pointer" onClick={() => handleVerDetalle(item)}>
                          {parseFloat(item.stock_minimo).toFixed(2)}
                        </td>

                        {/* Stock Máximo */}
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700 cursor-pointer" onClick={() => handleVerDetalle(item)}>
                          {item.stock_maximo ? parseFloat(item.stock_maximo).toFixed(2) : 'N/A'}
                        </td>

                        {/* Unidad */}
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 uppercase cursor-pointer" onClick={() => handleVerDetalle(item)}>
                          {item.unidad}
                        </td>

                        {/* Proveedores */}
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 cursor-pointer" onClick={() => handleVerDetalle(item)}>
                          {item.proveedores && item.proveedores.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {item.proveedores.map((prov, idx) => (
                                <span key={idx} className={`text-xs ${prov.ArticuloProveedor?.es_preferido ? 'font-semibold text-green-700' : 'text-gray-600'}`}>
                                  {prov.nombre}{prov.ArticuloProveedor?.es_preferido ? ' ⭐' : ''}
                                </span>
                              ))}
                            </div>
                          ) : (
                            'N/A'
                          )}
                        </td>

                        {/* Fecha creación */}
                        <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-500 cursor-pointer" onClick={() => handleVerDetalle(item)}>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                        </td>

                        {/* Fecha actualización */}
                        <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-500 cursor-pointer" onClick={() => handleVerDetalle(item)}>
                          {item.updated_at ? new Date(item.updated_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
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
                          <td colSpan="11" className="px-4 py-3">
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
                                  <span className="text-gray-500">EAN-13:</span>
                                  <p className="font-mono font-medium">{unidad.codigo_ean13 || 'Sin código'}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Estado:</span>
                                  <p className={`font-medium ${
                                    unidad.estado === 'disponible' ? 'text-green-600' :
                                    unidad.estado === 'asignada' ? 'text-blue-600' :
                                    unidad.estado === 'en_mantenimiento' ? 'text-orange-600' :
                                    'text-red-600'
                                  }`}>
                                    {unidad.estado === 'disponible' ? '✓ Disponible' :
                                     unidad.estado === 'asignada' ? '📍 Asignada' :
                                     unidad.estado === 'en_mantenimiento' ? '🔧 Mantenimiento' :
                                     '❌ Fuera de servicio'}
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

                return (
                  <div
                    key={`consumible-${item.id}`}
                    onClick={() => handleVerDetalle(item)}
                    className={`p-4 transition-colors cursor-pointer ${
                      esPendienteRevision
                        ? 'bg-orange-100 hover:bg-orange-200 border-l-4 border-orange-500'
                        : esUbicacionRevisar
                        ? 'bg-yellow-100 hover:bg-yellow-200 border-l-4 border-yellow-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Imagen */}
                      {imagenUrl ? (
                        <img
                          src={imagenUrl}
                          alt={item.nombre}
                          className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                          📦
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900">{item.nombre}</h3>
                          <span className="text-xs text-gray-400 font-mono">#{item.id}</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{item.descripcion}</p>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-1 text-xs mb-2">
                          <span className="inline-flex px-2 py-1 rounded bg-blue-100 text-blue-800 font-medium">
                            {item.categoria?.nombre || 'Sin categoría'}
                          </span>
                          <span className={`inline-flex px-2 py-1 rounded font-medium ${item.es_herramienta ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                            {item.es_herramienta ? '🔧' : '📦'}
                          </span>
                          <span className={`inline-flex px-2 py-1 rounded font-medium ${item.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {item.activo ? '✓' : '✗'}
                          </span>
                        </div>

                        {/* Detalles principales */}
                        <div className="text-xs text-gray-600 space-y-1 mb-2">
                          <div><span className="font-semibold">Código:</span> <span className="font-mono">{item.codigo_ean13 || 'N/A'}</span></div>
                          {item.codigo_tipo && <div><span className="font-semibold">Tipo:</span> {item.codigo_tipo}</div>}
                          {item.sku && <div><span className="font-semibold">SKU:</span> <span className="font-mono">{item.sku}</span></div>}
                          <div>
                            <span className="font-semibold">Ubicación:</span>{' '}
                            {esUbicacionRevisar ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-200 text-yellow-900 font-bold rounded border border-yellow-400 text-[10px]">
                                ⚠️ {item.ubicacion?.codigo || item.ubicacion?.nombre}
                              </span>
                            ) : (
                              <span>{item.ubicacion?.codigo || 'N/A'}</span>
                            )}
                          </div>
                        </div>

                        {/* Stock info */}
                        <div className="bg-gray-50 rounded p-2 mb-2">
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <div className="text-gray-500">Stock</div>
                              <div className={`font-semibold ${parseFloat(item.stock_actual) <= parseFloat(item.stock_minimo) ? 'text-red-600' : 'text-gray-900'}`}>
                                {parseFloat(item.stock_actual).toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-500">Mín</div>
                              <div className="font-semibold text-gray-700">{parseFloat(item.stock_minimo).toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-gray-500">Máx</div>
                              <div className="font-semibold text-gray-700">{item.stock_maximo ? parseFloat(item.stock_maximo).toFixed(2) : 'N/A'}</div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">Unidad: <span className="uppercase font-medium">{item.unidad}</span></div>
                        </div>

                        {/* Costo y proveedores */}
                        <div className="text-xs space-y-1">
                          <div><span className="font-semibold">Costo:</span> <span className="text-green-700 font-bold">${parseFloat(item.costo_unitario || 0).toFixed(2)}</span></div>
                          {item.proveedores && item.proveedores.length > 0 && (
                            <div>
                              <span className="font-semibold">Proveedores:</span> {item.proveedores.map(p => `${p.nombre}${p.ArticuloProveedor?.es_preferido ? '⭐' : ''}`).join(', ')}
                            </div>
                          )}
                        </div>

                        {/* Fechas */}
                        <div className="text-[10px] text-gray-400 mt-2 space-x-2">
                          {item.created_at && <span>Creado: {new Date(item.created_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: '2-digit' })}</span>}
                          {item.updated_at && <span>Act: {new Date(item.updated_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: '2-digit' })}</span>}
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

                return (
                  <React.Fragment key={`herramienta-${item.id}`}>
                    <div
                      className={`p-4 transition-colors ${
                        esPendienteRevision
                          ? 'bg-orange-100 hover:bg-orange-200 border-l-4 border-orange-500'
                          : esUbicacionRevisar
                          ? 'bg-yellow-100 hover:bg-yellow-200 border-l-4 border-yellow-500'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* Botón expandir/colapsar y header */}
                      <div className="flex items-center gap-2 mb-3">
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
                        <h3
                          className="font-medium text-gray-900 cursor-pointer hover:text-red-700 transition-colors flex-1"
                          onClick={() => handleVerDetalle(item)}
                        >
                          {item.nombre}
                        </h3>
                        <span className="text-xs text-gray-400 font-mono">#{item.id}</span>
                      </div>

                      <div className="flex gap-3 cursor-pointer" onClick={() => handleVerDetalle(item)}>
                        {/* Imagen */}
                        {imagenUrl ? (
                          <img
                            src={imagenUrl}
                            alt={item.nombre}
                            className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                            🔧
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 mb-2">{item.descripcion}</p>

                          {/* Badges */}
                          <div className="flex flex-wrap gap-1 text-xs mb-2">
                          <span className="inline-flex px-2 py-1 rounded bg-blue-100 text-blue-800 font-medium">
                            {item.categoria?.nombre || 'Sin categoría'}
                          </span>
                          <span className={`inline-flex px-2 py-1 rounded font-medium ${item.es_herramienta ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                            {item.es_herramienta ? '🔧' : '📦'}
                          </span>
                          <span className={`inline-flex px-2 py-1 rounded font-medium ${item.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {item.activo ? '✓' : '✗'}
                          </span>
                        </div>

                        {/* Detalles principales */}
                        <div className="text-xs text-gray-600 space-y-1 mb-2">
                          <div><span className="font-semibold">Código:</span> <span className="font-mono">{item.codigo_ean13 || 'N/A'}</span></div>
                          {item.codigo_tipo && <div><span className="font-semibold">Tipo:</span> {item.codigo_tipo}</div>}
                          {item.sku && <div><span className="font-semibold">SKU:</span> <span className="font-mono">{item.sku}</span></div>}
                          <div>
                            <span className="font-semibold">Ubicación:</span>{' '}
                            {esUbicacionRevisar ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-200 text-yellow-900 font-bold rounded border border-yellow-400 text-[10px]">
                                ⚠️ {item.ubicacion?.codigo || item.ubicacion?.nombre}
                              </span>
                            ) : (
                              <span>{item.ubicacion?.codigo || 'N/A'}</span>
                            )}
                          </div>
                        </div>

                        {/* Stock info */}
                        <div className="bg-gray-50 rounded p-2 mb-2">
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <div className="text-gray-500">Stock</div>
                              <div className={`font-semibold ${parseFloat(item.stock_actual) <= parseFloat(item.stock_minimo) ? 'text-red-600' : 'text-gray-900'}`}>
                                {parseFloat(item.stock_actual).toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-500">Mín</div>
                              <div className="font-semibold text-gray-700">{parseFloat(item.stock_minimo).toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-gray-500">Máx</div>
                              <div className="font-semibold text-gray-700">{item.stock_maximo ? parseFloat(item.stock_maximo).toFixed(2) : 'N/A'}</div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">Unidad: <span className="uppercase font-medium">{item.unidad}</span></div>
                        </div>

                        {/* Costo y proveedores */}
                        <div className="text-xs space-y-1">
                          <div><span className="font-semibold">Costo:</span> <span className="text-green-700 font-bold">${parseFloat(item.costo_unitario || 0).toFixed(2)}</span></div>
                          {item.proveedores && item.proveedores.length > 0 && (
                            <div>
                              <span className="font-semibold">Proveedores:</span> {item.proveedores.map(p => `${p.nombre}${p.ArticuloProveedor?.es_preferido ? '⭐' : ''}`).join(', ')}
                            </div>
                          )}
                        </div>

                        {/* Fechas */}
                        <div className="text-[10px] text-gray-400 mt-2 space-x-2">
                          {item.created_at && <span>Creado: {new Date(item.created_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: '2-digit' })}</span>}
                          {item.updated_at && <span>Act: {new Date(item.updated_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: '2-digit' })}</span>}
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
                                  <span className="text-gray-500">EAN-13:</span>
                                  <span className="ml-1 font-mono">{unidad.codigo_ean13 || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Estado:</span>
                                  <span className={`ml-1 font-medium ${
                                    unidad.estado === 'disponible' ? 'text-green-600' :
                                    unidad.estado === 'asignada' ? 'text-blue-600' :
                                    unidad.estado === 'en_mantenimiento' ? 'text-orange-600' :
                                    'text-red-600'
                                  }`}>
                                    {unidad.estado === 'disponible' ? '✓ Disponible' :
                                     unidad.estado === 'asignada' ? '📍 Asignada' :
                                     unidad.estado === 'en_mantenimiento' ? '🔧 Mantenimiento' :
                                     '❌ Fuera de servicio'}
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
                  {articuloParaEntrada ? parseFloat(articuloParaEntrada.stock_actual).toFixed(0) : '0'} {articuloParaEntrada?.unidad}
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
                  {(parseFloat(articuloParaEntrada.stock_actual) + parseFloat(cantidadEntrada)).toFixed(0)} {articuloParaEntrada.unidad}
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
                  {articuloParaSalida ? parseFloat(articuloParaSalida.stock_actual).toFixed(0) : '0'} {articuloParaSalida?.unidad}
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
                  {(parseFloat(articuloParaSalida.stock_actual) - parseFloat(cantidadSalida)).toFixed(0)} {articuloParaSalida.unidad}
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
                const articulosActivos = articulos.filter(a => a.activo);
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
                const articulosActivos = articulos.filter(a => a.activo);
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

                  return (
                    <React.Fragment key={articulo.id}>
                      <div className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
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

                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          {esHerramienta && <span className="text-lg">🔧</span>}
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 truncate">{articulo.nombre}</h4>
                            <p className="text-sm text-gray-500 truncate">
                              {esHerramienta
                                ? `Herramienta • Stock: ${articulo.stock_actual} unidades`
                                : `EAN-13: ${articulo.codigo_ean13} • Stock: ${articulo.stock_actual}`
                              }
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Unidades de herramientas expandidas */}
                      {esHerramienta && estaExpandida && (
                        <div className="bg-gray-50 border-t border-gray-200">
                          {unidades.length > 0 ? (
                            unidades.map((unidad) => (
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
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-red-600 text-sm">
                                      {unidad.codigo_unico}
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      unidad.estado === 'disponible' ? 'bg-green-100 text-green-800' :
                                      unidad.estado === 'asignada' ? 'bg-blue-100 text-blue-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {unidad.estado === 'disponible' ? 'Disponible' :
                                       unidad.estado === 'asignada' ? 'Asignada' : unidad.estado}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    EAN-13: {unidad.codigo_ean13}
                                  </p>
                                </div>
                              </label>
                            ))
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
    </div>
  );
};

export default InventarioPage;
