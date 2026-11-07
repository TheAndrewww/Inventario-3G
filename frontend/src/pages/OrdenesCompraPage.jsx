import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import ordenesCompraService from '../services/ordenesCompra.service';
import articulosService from '../services/articulos.service';
import proveedoresService from '../services/proveedores.service';
import categoriasService from '../services/categorias.service';
import ubicacionesService from '../services/ubicaciones.service';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import EAN13ScannerOrdenesCompra from '../components/scanner/EAN13ScannerOrdenesCompra';
import { jsPDF } from 'jspdf';
import AnularOrdenCompraModal from '../components/ordenes-compra/AnularOrdenCompraModal';
import EditarOrdenModal from '../components/ordenes/EditarOrdenModal';
import { confirmarG3 } from '../diseno-3g/dialogosG3';
import VistaOrdenesR2 from '../rediseno2/compras/VistaOrdenes';
import VistaSolicitudesR2 from '../rediseno2/compras/VistaSolicitudes';
import CajonNuevaOrdenR2 from '../rediseno2/compras/CajonNuevaOrden';
import CajonArmarOrdenR2 from '../rediseno2/compras/CajonArmarOrden';
import CajonNuevoArticuloR2 from '../rediseno2/compras/CajonNuevoArticulo';
import DialogoCancelarSolicitudR2 from '../rediseno2/compras/DialogoCancelarSolicitud';
import { CajonBajoStockR2, BotonSolicitudR2, UltimoMovimientoR2 } from '../rediseno2/compras/CajonBajoStock';
import PagoPedidoR2 from '../rediseno2/compras/PagoPedido';

// B6 · PLA-21: con OC_OCULTA_IMPORTES el servidor manda los importes vacíos (importesOcultos) a quien no debe verlos;
// la pantalla muestra «—». Sin la bandera, o para administración y compras, se ve lo de siempre.
const SIN_IMPORTE = '—';
const totalOrden = (orden) => (orden?.importesOcultos ? SIN_IMPORTE : `$${parseFloat(orden?.total_estimado || 0).toFixed(2)}`);

// La misma pantalla sirve dos sub-pestañas del menú Compras:
// /ordenes-compra (vista="ordenes") y /solicitudes-compra (vista="solicitudes")
const OrdenesCompraPage = ({ vista = 'ordenes' }) => {
  const [ordenes, setOrdenes] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [vistaOrdenes, setVistaOrdenes] = useState('activas'); // 'activas', 'completadas', 'canceladas'
  const vistaActual = vista; // 'solicitudes' o 'ordenes' (la decide la ruta)
  const [errorCargaR2, setErrorCargaR2] = useState(null); // Rediseño 2: el error de la carga, para pintarlo con «Reintentar»
  const [modalNuevaOrden, setModalNuevaOrden] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [solicitudesSeleccionadas, setSolicitudesSeleccionadas] = useState([]);
  const [modalCrearDesdeSeleccion, setModalCrearDesdeSeleccion] = useState(false);
  const [estadisticas, setEstadisticas] = useState(null);
  const [modalAnular, setModalAnular] = useState(false);
  const [ordenAAnular, setOrdenAAnular] = useState(null);
  const [modalCancelarSolicitud, setModalCancelarSolicitud] = useState(false);
  const [solicitudACancelar, setSolicitudACancelar] = useState(null);
  const [cantidadesSolicitudesEditadas, setCantidadesSolicitudesEditadas] = useState({});

  // Estados para edición de orden
  const [modalEditarOrden, setModalEditarOrden] = useState(false);
  const [ordenAEditar, setOrdenAEditar] = useState(null);

  // Estados para búsqueda y creación de solicitudes
  const [busquedaArticulo, setBusquedaArticulo] = useState('');
  const [articulosBuscados, setArticulosBuscados] = useState([]);
  const [buscandoArticulos, setBuscandoArticulos] = useState(false);
  const [modalArticulosEncontrados, setModalArticulosEncontrados] = useState(false);
  const [articulosConSolicitudIds, setArticulosConSolicitudIds] = useState([]);
  const [articuloSeleccionado, setArticuloSeleccionado] = useState(null);
  const [modalCrearSolicitud, setModalCrearSolicitud] = useState(false);
  const [cantidadSolicitud, setCantidadSolicitud] = useState('');
  const [prioridadSolicitud, setPrioridadSolicitud] = useState('media');
  const [motivoSolicitud, setMotivoSolicitud] = useState('');
  const [mostrandoBajoStock, setMostrandoBajoStock] = useState(false);

  const { user } = useAuth();

  // Verificar permisos
  const puedeCrearOrdenes = ['administrador', 'diseñador', 'almacen', 'compras'].includes(user?.rol);
  const esDiseñador = user?.rol === 'diseñador';
  const esAdmin = user?.rol === 'administrador';
  const puedeAnularOrdenes = ['administrador', 'almacen', 'compras'].includes(user?.rol);
  const puedeReabrirOrdenes = ['administrador', 'compras'].includes(user?.rol);
  const [modalRechazo, setModalRechazo] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [ordenParaRechazo, setOrdenParaRechazo] = useState(null);
  const [loadingAprobacion, setLoadingAprobacion] = useState(false);

  useEffect(() => {
    fetchData();
    fetchEstadisticas();
  }, [vistaActual]);

  // Liga directa a una orden (D2 · PLA-13): /ordenes-compra?orden=OC-0836 abre su detalle (lo usan el Inicio 3G y el
  // correo de resumen). Se busca por folio (o por id) en la lista ya cargada; la pestaña se cambia a la de su estado
  // y el parámetro se quita de la dirección para que al cerrar no se vuelva a abrir.
  const [searchParams, setSearchParams] = useSearchParams();
  const ligaOrdenAtendida = useRef(null);
  useEffect(() => {
    const folio = (searchParams.get('orden') || '').trim();
    if (vistaActual !== 'ordenes' || loading || !folio || ligaOrdenAtendida.current === folio) return;
    ligaOrdenAtendida.current = folio;
    const quitarParametro = () => {
      const resto = new URLSearchParams(searchParams);
      resto.delete('orden');
      setSearchParams(resto, { replace: true });
    };
    (async () => {
      const igual = (o) => String(o.ticket_id || '').toUpperCase() === folio.toUpperCase() || String(o.id) === folio;
      let orden = ordenes.find(igual);
      if (!orden) {
        // La lista trae las 50 más recientes: si no está ahí, se busca en una lista más larga una sola vez.
        try {
          const data = await ordenesCompraService.listarOrdenes({ limit: 1000 });
          orden = (data.data?.ordenes || []).find(igual);
        } catch { /* abajo se avisa */ }
      }
      if (!orden) {
        toast.error(`No se encontró la orden ${folio}`);
        quitarParametro();
        return;
      }
      setVistaOrdenes(orden.estado === 'cancelada' ? 'canceladas' : orden.estado === 'recibida' ? 'completadas' : 'activas');
      await handleVerDetalle(orden);
      quitarParametro();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading, ordenes, vistaActual]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (vistaActual === 'ordenes') {
        const data = await ordenesCompraService.listarOrdenes();
        setOrdenes(data.data?.ordenes || []);
      } else {
        const data = await ordenesCompraService.listarSolicitudes({ estado: 'pendiente' });
        setSolicitudes(data.data?.solicitudes || []);
        setSolicitudesSeleccionadas([]); // Limpiar selección al cambiar vista
        setCantidadesSolicitudesEditadas({}); // Limpiar cantidades editadas
      }
      setErrorCargaR2(null);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      toast.error('Error al cargar los datos');
      setErrorCargaR2(error?.response?.data?.message || error?.message || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const fetchEstadisticas = async () => {
    try {
      const data = await ordenesCompraService.obtenerEstadisticas();
      setEstadisticas(data.data);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    }
  };

  const handleCantidadSolicitudChange = (solicitudId, nuevaCantidad) => {
    if (nuevaCantidad === '' || nuevaCantidad === null || nuevaCantidad === undefined) {
      setCantidadesSolicitudesEditadas(prev => ({
        ...prev,
        [solicitudId]: ''
      }));
      return;
    }
    const cantidad = parseFloat(nuevaCantidad);
    if (isNaN(cantidad) || cantidad < 0) return;

    setCantidadesSolicitudesEditadas(prev => ({
      ...prev,
      [solicitudId]: cantidad
    }));
  };

  // Helper: Obtener el proveedor correcto (de artículo o herramienta)
  const obtenerProveedorSolicitud = (solicitud) => {
    // Prioridad 1: Si tiene proveedores via many-to-many, buscar el marcado como preferido
    if (solicitud.articulo?.proveedores?.length > 0) {
      // Buscar el proveedor preferido (es_preferido: true)
      const proveedorPreferido = solicitud.articulo.proveedores.find(
        p => p.ArticuloProveedor?.es_preferido === true
      );
      if (proveedorPreferido) {
        return proveedorPreferido;
      }
      // Si no hay preferido, usar el primero
      return solicitud.articulo.proveedores[0];
    }
    // Prioridad 2: Si tiene proveedor directo (FK legacy), usar ese
    if (solicitud.articulo?.proveedor) {
      return solicitud.articulo.proveedor;
    }
    // Prioridad 3: Si el artículo tiene tipo_herramienta_migrado con proveedor, usar ese (datos antiguos)
    if (solicitud.articulo?.tipo_herramienta_migrado?.proveedor) {
      return solicitud.articulo.tipo_herramienta_migrado.proveedor;
    }
    return null;
  };

  const handleClickSolicitud = (solicitud) => {
    // Identificar el proveedor preferido de la solicitud clickeada
    const proveedor = obtenerProveedorSolicitud(solicitud);
    const proveedorPreferido = proveedor?.id;

    // Si tiene proveedor preferido, seleccionar todas las solicitudes con el mismo proveedor
    if (proveedorPreferido) {
      const solicitudesMismoProveedor = solicitudes
        .filter(s => obtenerProveedorSolicitud(s)?.id === proveedorPreferido)
        .map(s => s.id);

      if (solicitudesMismoProveedor.length > 1) {
        const nombreProveedor = proveedor.nombre;
        toast.success(
          `Se seleccionaron ${solicitudesMismoProveedor.length} solicitudes del proveedor ${nombreProveedor}`,
          { duration: 3000 }
        );
      }

      setSolicitudesSeleccionadas(solicitudesMismoProveedor);
    } else {
      // Si no tiene proveedor preferido, solo seleccionar esta solicitud
      setSolicitudesSeleccionadas([solicitud.id]);
    }

    setModalCrearDesdeSeleccion(true);
  };

  const handleAbrirModalCrearDesdeSeleccion = () => {
    if (solicitudesSeleccionadas.length === 0) {
      toast.error('Selecciona al menos una solicitud');
      return;
    }
    setModalCrearDesdeSeleccion(true);
  };

  const handleVerDetalle = async (orden) => {
    try {
      const data = await ordenesCompraService.obtenerOrden(orden.id);
      setOrdenSeleccionada(data.data?.orden);
      setModalDetalle(true);
    } catch (error) {
      toast.error('Error al cargar el detalle');
    }
  };

  const handleAbrirModalAnular = (orden) => {
    setOrdenAAnular(orden);
    setModalAnular(true);
  };

  const handleAnularOrden = async (ordenId, motivo) => {
    const response = await ordenesCompraService.anular(ordenId, motivo);
    toast.success(response.message);
    await fetchData();
    await fetchEstadisticas();
    setModalAnular(false);
    setOrdenAAnular(null);
    setModalDetalle(false);
    setOrdenSeleccionada(null);
    return response;
  };

  const handleAbrirModalEditar = (orden) => {
    setOrdenAEditar(orden);
    setModalEditarOrden(true);
    setModalDetalle(false); // Cerrar el modal de detalle
  };

  const handleEdicionExitosa = async (ordenActualizada) => {
    // Recargar datos
    await fetchData();
    await fetchEstadisticas();

    // Cerrar modal de edición
    setModalEditarOrden(false);
    setOrdenAEditar(null);

    // Abrir modal de detalle con la orden actualizada
    if (ordenActualizada) {
      const data = await ordenesCompraService.obtenerOrden(ordenActualizada.id);
      setOrdenSeleccionada(data.data?.orden);
      setModalDetalle(true);
    }
  };

  const handleAbrirModalCancelarSolicitud = (solicitud, e) => {
    e.stopPropagation(); // Evitar que se abra el modal de crear orden
    setSolicitudACancelar(solicitud);
    setModalCancelarSolicitud(true);
  };

  // Buscar artículos por nombre o código (en tiempo real)
  const buscarArticulosEnTiempoReal = async (termino) => {
    if (!termino || termino.length < 2) {
      setArticulosBuscados([]);
      return;
    }

    try {
      setBuscandoArticulos(true);
      const articulos = await articulosService.getAll();

      // Filtrar artículos localmente por nombre, código o categoría — incluye DESACTIVADOS
      // (para evitar crear duplicados de SKUs apagados; se marcan visualmente en la UI)
      const resultados = articulos.filter(art => {
        const nombreMatch = art.nombre?.toLowerCase().includes(termino.toLowerCase());
        const codigoMatch = art.codigo_ean13?.includes(termino);
        const categoriaMatch = art.categoria?.nombre?.toLowerCase().includes(termino.toLowerCase());
        return nombreMatch || codigoMatch || categoriaMatch;
      });

      setArticulosBuscados(resultados);
      setMostrandoBajoStock(false);
    } catch (error) {
      console.error('Error al buscar artículos:', error);
      toast.error('Error al buscar artículos');
    } finally {
      setBuscandoArticulos(false);
    }
  };

  // Debounce para la búsqueda en tiempo real
  useEffect(() => {
    const timer = setTimeout(() => {
      buscarArticulosEnTiempoReal(busquedaArticulo);
    }, 300);

    return () => clearTimeout(timer);
  }, [busquedaArticulo]);

  // Mostrar artículos bajo stock mínimo
  const handleMostrarBajoStockMinimo = async () => {
    try {
      setBuscandoArticulos(true);

      // Obtener TODAS las solicitudes (pendientes y en orden) y artículos en paralelo
      const [responseSolicitudes, todosArticulos] = await Promise.all([
        ordenesCompraService.listarSolicitudes({ limit: 99999 }).catch(() => ({ data: { solicitudes: [] } })),
        articulosService.buscar({ activo: true, limit: 99999 })
      ]);

      const solicitudes = responseSolicitudes.data?.solicitudes || [];

      // Artículos con solicitud PENDIENTE (aún sin orden): se muestran marcados
      const idsConSolicitud = solicitudes
        .filter(sol => sol.estado === 'pendiente')
        .map(sol => sol.articulo_id);
      setArticulosConSolicitudIds(idsConSolicitud);

      // Artículos que YA están en una orden de compra (solicitud en_orden):
      // se ocultan de la lista para NO duplicar la compra
      const idsEnOrden = solicitudes
        .filter(sol => sol.estado === 'en_orden')
        .map(sol => sol.articulo_id);

      // Filtrar artículos con stock bajo mínimo, excluyendo los que ya tienen
      // una orden de compra activa (para no duplicar las compras)
      const articulosBajoStock = todosArticulos.filter(art =>
        parseFloat(art.stock_minimo) > 0 &&
        parseFloat(art.stock_actual) < parseFloat(art.stock_minimo) &&
        !idsEnOrden.includes(art.id)
      );

      setArticulosBuscados(articulosBajoStock);
      setMostrandoBajoStock(true);

      if (articulosBajoStock.length === 0) {
        setModalArticulosEncontrados(false);
        toast.success('Todos los artículos tienen stock suficiente');
      } else {
        setModalArticulosEncontrados(true);
        toast(`${articulosBajoStock.length} artículo${articulosBajoStock.length !== 1 ? 's' : ''} bajo stock mínimo`, {
          icon: undefined,
          duration: 2000
        });
      }
    } catch (error) {
      console.error('Error al cargar artículos bajo stock:', error);
      toast.error('Error al cargar artículos');
    } finally {
      setBuscandoArticulos(false);
    }
  };

  // Abrir modal para crear solicitud de un artículo
  const handleAbrirModalCrearSolicitudArticulo = (articulo) => {
    setArticuloSeleccionado(articulo);
    const stockFaltante = Math.max(0, parseFloat(articulo.stock_maximo || articulo.stock_minimo * 2) - parseFloat(articulo.stock_actual));
    setCantidadSolicitud(Math.ceil(stockFaltante).toString());
    setPrioridadSolicitud(parseFloat(articulo.stock_actual) < parseFloat(articulo.stock_minimo) ? 'alta' : 'media');
    setMotivoSolicitud(`Reposición de stock. Stock actual: ${articulo.stock_actual} ${articulo.unidad}, Stock mínimo: ${articulo.stock_minimo} ${articulo.unidad}`);
    setModalCrearSolicitud(true);
  };

  // Crear solicitud de compra manual
  const handleCrearSolicitudManual = async () => {
    if (!cantidadSolicitud || parseFloat(cantidadSolicitud) <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    // Guardar el artículo ID antes de limpiar el estado
    const articuloIdCreado = articuloSeleccionado.id;
    const estabaMostrandoBajoStock = mostrandoBajoStock;

    try {
      const response = await ordenesCompraService.crearSolicitudManual(
        articuloIdCreado,
        parseFloat(cantidadSolicitud),
        prioridadSolicitud,
        motivoSolicitud
      );

      toast.success(response.message || 'Solicitud creada exitosamente');
      setModalCrearSolicitud(false);
      setArticuloSeleccionado(null);
      setBusquedaArticulo('');

      // Recargar solicitudes primero
      await fetchData();

      // Si estábamos mostrando bajo stock, actualizar la lista automáticamente
      // IMPORTANTE: Esto eliminará el artículo que acaba de tener solicitud creada
      if (estabaMostrandoBajoStock && modalArticulosEncontrados) {
        // Mostrar loading mientras actualiza
        toast.loading('Actualizando lista...', { id: 'updating-list' });
        await handleMostrarBajoStockMinimo();
        toast.dismiss('updating-list');
        toast.success('Artículo quitado de la lista', { duration: 2000 });
      }
    } catch (error) {
      console.error('Error al crear solicitud:', error);
      toast.error(error.response?.data?.message || 'Error al crear solicitud');
    }
  };

  const handleCancelarSolicitud = async (solicitudId, motivo) => {
    try {
      const response = await ordenesCompraService.cancelarSolicitud(solicitudId, motivo);
      toast.success(response.message);
      await fetchData();
      await fetchEstadisticas();
      setModalCancelarSolicitud(false);
      setSolicitudACancelar(null);
      return response;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al cancelar la solicitud');
      throw error;
    }
  };

  // Función para cargar imagen desde URL y obtener base64 + dimensiones
  const loadImageWithDimensions = async (url) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          // Crear imagen para obtener dimensiones
          const img = new Image();
          img.onload = () => {
            resolve({
              base64: reader.result,
              width: img.width,
              height: img.height,
              aspectRatio: img.width / img.height
            });
          };
          img.onerror = reject;
          img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error cargando imagen:', error);
      return null;
    }
  };

  const generarPDFOrden = async (orden) => {
    try {
      // Obtener detalle completo de la orden
      const data = await ordenesCompraService.obtenerOrden(orden.id);
      const ordenCompleta = data.data?.orden;

      // URLs de los logos
      const logoCompletoUrl = 'https://res.cloudinary.com/dd93jrilg/image/upload/v1762292854/logo_completo_web_eknzcb.png';
      const marcaAguaUrl = 'https://res.cloudinary.com/dd93jrilg/image/upload/v1763602391/iso_black_1_mmxd6k.png';

      // Cargar imágenes con dimensiones
      const [logoData, marcaAguaData] = await Promise.all([
        loadImageWithDimensions(logoCompletoUrl),
        loadImageWithDimensions(marcaAguaUrl)
      ]);

      // === ARTÍCULOS AGRUPADOS POR CATEGORÍA ===
      const articulos = ordenCompleta.detalles || [];

      // Agrupar artículos por categoría
      const articulosPorCategoria = {};
      articulos.forEach(detalle => {
        const categoria = detalle.articulo?.categoria?.nombre || 'GENERAL';
        if (!articulosPorCategoria[categoria]) {
          articulosPorCategoria[categoria] = [];
        }
        articulosPorCategoria[categoria].push(detalle);
      });

      // Cargar imágenes de artículos
      const imagenesArticulos = {};
      for (const detalle of articulos) {
        if (detalle.articulo?.imagen_url) {
          try {
            const imagenData = await loadImageWithDimensions(detalle.articulo.imagen_url);
            if (imagenData) {
              imagenesArticulos[detalle.articulo_id] = imagenData;
            }
          } catch (error) {
            console.error(`Error cargando imagen del artículo ${detalle.articulo_id}:`, error);
          }
        }
      }

      // Calcular altura aproximada necesaria
      let alturaEstimada = 100; // Header inicial
      Object.keys(articulosPorCategoria).forEach(categoria => {
        alturaEstimada += 8; // Título de categoría
        articulosPorCategoria[categoria].forEach(detalle => {
          alturaEstimada += 20; // Espacio por artículo con imagen
          const descripcion = detalle.articulo?.descripcion || '';
          if (descripcion) {
            const lineasDesc = Math.ceil(descripcion.length / 50);
            alturaEstimada += lineasDesc * 4;
          }
        });
        alturaEstimada += 5; // Espacio entre categorías
      });
      alturaEstimada += 10; // Margen final

      // Crear documento con formato ticket (80mm de ancho, altura dinámica)
      const anchoTicket = 80; // mm
      const altoTicket = Math.max(200, alturaEstimada); // Mínimo 200mm
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [anchoTicket, altoTicket]
      });

      let yPos = 5;
      const margen = 5;
      const anchoUtil = anchoTicket - (margen * 2);

      // === HEADER ===
      // Logo completo centrado
      if (logoData) {
        const logoWidth = 60;
        const logoHeight = logoWidth / logoData.aspectRatio;
        const logoX = (anchoTicket - logoWidth) / 2;
        doc.addImage(logoData.base64, 'PNG', logoX, yPos, logoWidth, logoHeight);
        yPos += logoHeight + 5;
      }

      // Información de la orden (centrada)
      doc.setFontSize(8);

      // Proveedor
      doc.setFont(undefined, 'bold');
      doc.text('PROVEEDOR', anchoTicket / 2, yPos, { align: 'center' });
      yPos += 4;
      doc.setFont(undefined, 'normal');
      const proveedor = ordenCompleta.proveedor?.nombre || 'Sin proveedor';
      const proveedorLines = doc.splitTextToSize(proveedor, anchoUtil);
      proveedorLines.forEach(line => {
        doc.text(line, anchoTicket / 2, yPos, { align: 'center' });
        yPos += 3.5;
      });
      yPos += 2;

      // Creado por
      doc.setFont(undefined, 'bold');
      doc.text('CREADO POR', anchoTicket / 2, yPos, { align: 'center' });
      yPos += 4;
      doc.setFont(undefined, 'normal');
      const creador = ordenCompleta.creador?.nombre || 'N/A';
      const creadorLines = doc.splitTextToSize(creador, anchoUtil);
      creadorLines.forEach(line => {
        doc.text(line, anchoTicket / 2, yPos, { align: 'center' });
        yPos += 3.5;
      });
      yPos += 2;

      // Fecha de pedido
      doc.setFont(undefined, 'bold');
      doc.text('FECHA DE PEDIDO', anchoTicket / 2, yPos, { align: 'center' });
      yPos += 4;
      doc.setFont(undefined, 'normal');
      const fechaPedido = ordenCompleta.created_at;
      doc.text(
        fechaPedido ? new Date(fechaPedido).toLocaleDateString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }) : 'N/A',
        anchoTicket / 2,
        yPos,
        { align: 'center' }
      );
      yPos += 4;

      // Fecha de llegada estimada
      doc.setFont(undefined, 'bold');
      doc.text('FECHA DE LLEGADA', anchoTicket / 2, yPos, { align: 'center' });
      yPos += 4;
      doc.setFont(undefined, 'normal');
      doc.text(
        ordenCompleta.fecha_llegada_estimada
          ? new Date(ordenCompleta.fecha_llegada_estimada).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          })
          : 'Sin definir',
        anchoTicket / 2,
        yPos,
        { align: 'center' }
      );
      yPos += 6;

      // === TÍTULO PRINCIPAL ===
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('ORDEN DE COMPRA', anchoTicket / 2, yPos, { align: 'center' });
      yPos += 6;

      // Línea divisoria
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margen, yPos, anchoTicket - margen, yPos);
      yPos += 5;

      // === ARTÍCULOS AGRUPADOS POR CATEGORÍA ===
      doc.setFontSize(8);
      Object.keys(articulosPorCategoria).forEach(categoria => {
        // Nombre de categoría
        doc.setFont(undefined, 'bold');
        doc.text(categoria.toUpperCase(), margen, yPos);
        yPos += 4;

        // Lista de artículos
        doc.setFont(undefined, 'normal');
        articulosPorCategoria[categoria].forEach(detalle => {
          const nombreArticulo = detalle.articulo?.nombre || `Artículo ID: ${detalle.articulo_id}`;
          const descripcion = detalle.articulo?.descripcion || '';
          const cantidad = detalle.cantidad_solicitada;
          const unidad = detalle.articulo?.unidad || 'uds';
          const imagenArticulo = imagenesArticulos[detalle.articulo_id];

          // Dibujar imagen del artículo si existe
          const imgSize = 12; // Tamaño de imagen en mm
          let textX = margen;
          let textStartY = yPos;

          if (imagenArticulo) {
            const imgWidth = imgSize;
            const imgHeight = imgSize / imagenArticulo.aspectRatio;

            // Borde de imagen
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.2);
            doc.rect(margen, yPos, imgWidth, imgHeight);

            // Agregar imagen
            doc.addImage(imagenArticulo.base64, 'JPEG', margen, yPos, imgWidth, imgHeight);
            textX = margen + imgWidth + 2;
            textStartY = yPos + 3;
            yPos = Math.max(yPos + imgHeight, textStartY);
          } else {
            textStartY = yPos + 3;
          }

          // Nombre y cantidad en negrita
          doc.setFont(undefined, 'bold');
          const texto = `• ${nombreArticulo} - ${cantidad} ${unidad}`;
          const textoLines = doc.splitTextToSize(texto, anchoUtil - (imagenArticulo ? imgSize + 2 : 0));
          doc.text(textoLines, textX, textStartY);
          const altoTexto = textoLines.length * 3.5;

          // Descripción si existe
          if (descripcion) {
            doc.setFont(undefined, 'normal');
            doc.setFontSize(7);
            const descLines = doc.splitTextToSize(`  ${descripcion}`, anchoUtil - (imagenArticulo ? imgSize + 2 : 0));
            doc.text(descLines, textX, textStartY + altoTexto);
            yPos = Math.max(yPos, textStartY + altoTexto + (descLines.length * 3));
            doc.setFontSize(8);
          } else {
            yPos = Math.max(yPos, textStartY + altoTexto);
          }

          yPos += 3;
        });

        yPos += 3; // Espacio entre categorías
      });

      // === MARCA DE AGUA ===
      if (marcaAguaData) {
        const gState = doc.GState({ opacity: 0.05 });
        doc.setGState(gState);

        const watermarkWidth = 60;
        const watermarkHeight = watermarkWidth / marcaAguaData.aspectRatio;
        const watermarkX = (anchoTicket - watermarkWidth) / 2;
        const watermarkY = altoTicket / 2 - watermarkHeight / 2;

        doc.addImage(marcaAguaData.base64, 'PNG', watermarkX, watermarkY, watermarkWidth, watermarkHeight, undefined, 'NONE', 0);
        doc.setGState(doc.GState({ opacity: 1 }));
      }

      // Descargar PDF
      doc.save(`Orden-Compra-${ordenCompleta.ticket_id}.pdf`);
      toast.success('PDF descargado correctamente');
    } catch (error) {
      console.error('Error al generar PDF:', error);
      toast.error('Error al generar el PDF');
    }
  };

  const filteredOrdenes = ordenes.filter((orden) => {
    const matchesSearch =
      orden.ticket_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      orden.proveedor?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      orden.observaciones?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesEstado = !filterEstado || orden.estado === filterEstado;

    // Filtrar según la vista seleccionada
    let matchesVista = true;
    if (vistaOrdenes === 'activas') {
      // Vista activas: mostrar pendiente_aprobacion, enviada, parcial, rechazada (excluir recibida y cancelada)
      matchesVista = orden.estado !== 'recibida' && orden.estado !== 'cancelada';
    } else if (vistaOrdenes === 'completadas') {
      // Vista completadas: mostrar SOLO recibida
      matchesVista = orden.estado === 'recibida';
    } else if (vistaOrdenes === 'canceladas') {
      // Vista canceladas: mostrar SOLO cancelada
      matchesVista = orden.estado === 'cancelada';
    }

    return matchesSearch && matchesEstado && matchesVista;
  });

  // Extraer categorías únicas de las solicitudes (ya no se usa pero se mantiene por compatibilidad)
  const categoriasUnicas = React.useMemo(() => {
    const categoriasMap = new Map();
    solicitudes.forEach(solicitud => {
      const categoria = solicitud.articulo?.categoria;
      if (categoria && !categoriasMap.has(categoria.id)) {
        categoriasMap.set(categoria.id, categoria);
      }
    });
    return Array.from(categoriasMap.values());
  }, [solicitudes]);

  const handleAprobarOrden = async (orden) => {
    if (!(await confirmarG3({
      titulo: `¿Aprobar la orden ${orden.ticket_id}?`,
      datos: [['Proveedor', orden.proveedor?.nombre || 'Sin proveedor'], ['Total estimado', totalOrden(orden)]],
      confirmar: 'Aprobar orden', cancelar: 'Regresar',
    }))) return;
    setLoadingAprobacion(true);
    try {
      await ordenesCompraService.aprobarOrden(orden.id);
      toast.success(`Orden ${orden.ticket_id} aprobada`);
      setModalDetalle(false);
      setOrdenSeleccionada(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al aprobar');
    } finally {
      setLoadingAprobacion(false);
    }
  };

  const handleAbrirRechazo = (orden) => {
    setOrdenParaRechazo(orden);
    setMotivoRechazo('');
    setModalRechazo(true);
  };

  const handleConfirmarRechazo = async () => {
    if (!motivoRechazo.trim()) {
      toast.error('Escribe un motivo de rechazo');
      return;
    }
    setLoadingAprobacion(true);
    try {
      await ordenesCompraService.rechazarOrden(ordenParaRechazo.id, motivoRechazo.trim());
      toast.success(`Orden ${ordenParaRechazo.ticket_id} rechazada`);
      setModalRechazo(false);
      setModalDetalle(false);
      setOrdenSeleccionada(null);
      setOrdenParaRechazo(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al rechazar');
    } finally {
      setLoadingAprobacion(false);
    }
  };

  const handleEliminarOrden = async (orden) => {
    if (!(await confirmarG3({
      titulo: `¿Eliminar permanentemente la orden ${orden.ticket_id}?`,
      aviso: 'Esta acción no se puede deshacer.',
      datos: [['Proveedor', orden.proveedor?.nombre || 'Sin proveedor'], ['Total estimado', totalOrden(orden)]],
      confirmar: 'Eliminar orden', cancelar: 'No eliminar', peligro: true,
    }))) return;
    setLoadingAprobacion(true);
    try {
      await ordenesCompraService.eliminarOrden(orden.id);
      toast.success(`Orden ${orden.ticket_id} eliminada`);
      setModalDetalle(false);
      setOrdenSeleccionada(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al eliminar');
    } finally {
      setLoadingAprobacion(false);
    }
  };

  const modalesR2 = (
    <>
      {modalNuevaOrden && (
        <ModalNuevaOrden
          isOpen={modalNuevaOrden}
          onClose={() => setModalNuevaOrden(false)}
          onSuccess={() => {
            setModalNuevaOrden(false);
            fetchData();
          }}
          esDiseñador={esDiseñador}
        />
      )}
      {modalCrearDesdeSeleccion && (
        <ModalCrearOrdenDesdeSolicitudes
          isOpen={modalCrearDesdeSeleccion}
          solicitudes={solicitudes.filter(s => solicitudesSeleccionadas.includes(s.id))}
          cantidadesIniciales={cantidadesSolicitudesEditadas}
          generarPDFOrden={generarPDFOrden}
          onClose={() => setModalCrearDesdeSeleccion(false)}
          onSuccess={() => {
            setModalCrearDesdeSeleccion(false);
            setSolicitudesSeleccionadas([]);
            fetchData();
          }}
        />
      )}
      {modalAnular && ordenAAnular && (
        <AnularOrdenCompraModal
          isOpen={modalAnular}
          onClose={() => {
            setModalAnular(false);
            setOrdenAAnular(null);
          }}
          orden={ordenAAnular}
          onAnular={handleAnularOrden}
        />
      )}
      {modalCancelarSolicitud && solicitudACancelar && (
        <CancelarSolicitudModal
          isOpen={modalCancelarSolicitud}
          onClose={() => {
            setModalCancelarSolicitud(false);
            setSolicitudACancelar(null);
          }}
          solicitud={solicitudACancelar}
          onCancelar={handleCancelarSolicitud}
        />
      )}
      {modalEditarOrden && ordenAEditar && (
        <EditarOrdenModal
          isOpen={modalEditarOrden}
          onClose={() => {
            setModalEditarOrden(false);
            setOrdenAEditar(null);
          }}
          orden={ordenAEditar}
          onSuccess={handleEdicionExitosa}
        />
      )}
      <ModalArticulosEncontrados
        isOpen={modalArticulosEncontrados}
        onClose={() => {
          setModalArticulosEncontrados(false);
          setArticulosBuscados([]);
          setMostrandoBajoStock(false);
        }}
        articulos={articulosBuscados}
        articulosConSolicitudIds={articulosConSolicitudIds}
        onCrearSolicitud={async (articulo) => {
          const stockFaltante = Math.max(0, parseFloat(articulo.stock_maximo || articulo.stock_minimo * 2) - parseFloat(articulo.stock_actual));
          const cantidad = Math.ceil(stockFaltante) || 1;
          const prioridad = parseFloat(articulo.stock_actual) < parseFloat(articulo.stock_minimo) ? 'alta' : 'media';
          const motivo = `Reposición de stock. Stock actual: ${articulo.stock_actual} ${articulo.unidad}, Stock mínimo: ${articulo.stock_minimo} ${articulo.unidad}`;
          await ordenesCompraService.crearSolicitudManual(articulo.id, cantidad, prioridad, motivo);
          setArticulosConSolicitudIds(prev => [...prev, articulo.id]);
          // Quitar el artículo de la lista para reflejar que ya se agregó,
          // SIN cerrar la ventana: así se pueden agregar varios seguidos.
          setArticulosBuscados(prev => prev.filter(a => a.id !== articulo.id));
          // Refrescar solicitudes en segundo plano (no cierra el modal de bajo stock)
          fetchData();
        }}
        titulo={mostrandoBajoStock ? 'Artículos bajo stock mínimo' : 'Resultados de búsqueda'}
      />
    </>
  );
  const comunesR2 = { loading, errorCarga: errorCargaR2, recargar: fetchData, estadisticas, esAdmin, esDiseñador, children: modalesR2 };
  if (vistaActual === 'solicitudes') {
    return (
      <VistaSolicitudesR2
        {...comunesR2}
        solicitudes={solicitudes}
        cantidadesSolicitudesEditadas={cantidadesSolicitudesEditadas}
        cambiarCantidad={handleCantidadSolicitudChange}
        obtenerProveedorSolicitud={obtenerProveedorSolicitud}
        armarOrden={handleClickSolicitud}
        abrirCancelar={handleAbrirModalCancelarSolicitud}
        categoriasUnicas={categoriasUnicas}
        abrirBajoStock={handleMostrarBajoStockMinimo}
        buscandoArticulos={buscandoArticulos}
        busquedaArticulo={busquedaArticulo}
        setBusquedaArticulo={setBusquedaArticulo}
        articulosBuscados={articulosBuscados}
        elegirArticulo={(articulo) => {
          handleAbrirModalCrearSolicitudArticulo(articulo);
          setBusquedaArticulo('');
          setArticulosBuscados([]);
        }}
        crear={{
          abierto: modalCrearSolicitud,
          articulo: articuloSeleccionado,
          cantidad: cantidadSolicitud,
          setCantidad: setCantidadSolicitud,
          prioridad: prioridadSolicitud,
          setPrioridad: setPrioridadSolicitud,
          motivo: motivoSolicitud,
          setMotivo: setMotivoSolicitud,
          enviar: handleCrearSolicitudManual,
          cargando: loading,
          cerrar: () => {
            setModalCrearSolicitud(false);
            setArticuloSeleccionado(null);
            setCantidadSolicitud('');
            setPrioridadSolicitud('media');
            setMotivoSolicitud('');
          },
        }}
      />
    );
  }
  return (
    <VistaOrdenesR2
      {...comunesR2}
      ordenes={ordenes}
      filteredOrdenes={filteredOrdenes}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      filterEstado={filterEstado}
      setFilterEstado={setFilterEstado}
      vistaOrdenes={vistaOrdenes}
      setVistaOrdenes={setVistaOrdenes}
      puedeCrearOrdenes={puedeCrearOrdenes}
      puedeAnularOrdenes={puedeAnularOrdenes}
      puedeReabrirOrdenes={puedeReabrirOrdenes}
      abrirNueva={() => setModalNuevaOrden(true)}
      verDetalle={handleVerDetalle}
      generarPDFOrden={generarPDFOrden}
      aprobar={handleAprobarOrden}
      abrirRechazo={handleAbrirRechazo}
      eliminar={handleEliminarOrden}
      abrirAnular={handleAbrirModalAnular}
      abrirEditar={handleAbrirModalEditar}
      loadingAprobacion={loadingAprobacion}
      ordenSeleccionada={ordenSeleccionada}
      detalleAbierto={modalDetalle}
      cerrarDetalle={() => {
        setModalDetalle(false);
        setOrdenSeleccionada(null);
      }}
      franjaPago={modalDetalle && ordenSeleccionada ? <FranjaPagoPedido ordenId={ordenSeleccionada.id} /> : null}
      rechazo={{
        abierto: modalRechazo,
        orden: ordenParaRechazo,
        motivo: motivoRechazo,
        setMotivo: setMotivoRechazo,
        confirmar: handleConfirmarRechazo,
        cerrar: () => setModalRechazo(false),
        cargando: loadingAprobacion,
      }}
    />
  );
};

// Modal para crear nueva orden
const ModalNuevaOrden = ({ isOpen, onClose, onSuccess, esDiseñador }) => {
  const { user } = useAuth();
  const esAdmin = user?.rol === 'administrador';

  const [articulos, setArticulos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [articulosSeleccionados, setArticulosSeleccionados] = useState([]);
  const [proveedorId, setProveedorId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [fechaLlegadaEstimada, setFechaLlegadaEstimada] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [mostrarCatalogo, setMostrarCatalogo] = useState(false);
  const [mostrarScanner, setMostrarScanner] = useState(false);
  const [mostrarModalNuevoArticulo, setMostrarModalNuevoArticulo] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);

  // Estados para consolidación de órdenes (solo admin)
  const [articulosOrdenes, setArticulosOrdenes] = useState([]);
  const [articulosSolicitudes, setArticulosSolicitudes] = useState([]);
  const [articulosBajoStock, setArticulosBajoStock] = useState([]);
  const [ordenesSeleccionadas, setOrdenesSeleccionadas] = useState(new Set());
  const [loadingPendientes, setLoadingPendientes] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Usar Promise.allSettled para que no falle todo si uno falla
      const results = await Promise.allSettled([
        articulosService.getAll(),
        proveedoresService.listar(),
        categoriasService.getAll(),
        ubicacionesService.getAll()
      ]);

      const [artResult, provResult, catResult, ubResult] = results;

      // Procesar respuesta de artículos
      if (artResult.status === 'fulfilled') {
        const artData = artResult.value;
        const articulosArray = Array.isArray(artData) ? artData : [];
        setArticulos(articulosArray);
      } else {
        console.error('Error al cargar artículos:', artResult.reason);
      }

      // Procesar respuesta de proveedores
      if (provResult.status === 'fulfilled') {
        const provData = provResult.value;
        const proveedoresArray = Array.isArray(provData)
          ? provData
          : (provData?.data?.proveedores || provData?.data || []);
        setProveedores(proveedoresArray);
      } else {
        console.error('Error al cargar proveedores:', provResult.reason);
      }

      // Procesar respuesta de categorías
      if (catResult.status === 'fulfilled') {
        const catData = catResult.value;
        const categoriasArray = Array.isArray(catData)
          ? catData
          : (catData?.data?.categorias || catData?.data || []);
        setCategorias(categoriasArray);
      } else {
        console.error('Error al cargar categorías:', catResult.reason);
      }

      // Procesar respuesta de ubicaciones
      if (ubResult.status === 'fulfilled') {
        const ubData = ubResult.value;
        const ubicacionesArray = Array.isArray(ubData)
          ? ubData
          : (ubData?.data?.ubicaciones || ubData?.data || []);
        setUbicaciones(ubicacionesArray);
      } else {
        console.error('Error al cargar ubicaciones:', ubResult.reason);
      }

      // Mostrar error solo si falló algo crítico (artículos o proveedores)
      if (artResult.status === 'rejected' || provResult.status === 'rejected') {
        toast.error('Error al cargar algunos datos');
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
      toast.error('Error al cargar datos');
    }
  };

  // Cargar artículos pendientes cuando cambia el proveedor (solo admin)
  useEffect(() => {
    const fetchArticulosPendientes = async () => {
      if (!esAdmin || !proveedorId) {
        setArticulosOrdenes([]);
        setArticulosSolicitudes([]);
        setArticulosBajoStock([]);
        setOrdenesSeleccionadas(new Set());
        return;
      }

      setLoadingPendientes(true);
      try {
        const response = await ordenesCompraService.obtenerArticulosPendientes(proveedorId);
        setArticulosOrdenes(response?.data?.articulos_ordenes || []);
        setArticulosSolicitudes(response?.data?.articulos_solicitudes || []);
        setArticulosBajoStock(response?.data?.articulos_bajo_stock || []);
      } catch (error) {
        console.error('Error al cargar artículos pendientes:', error);
        setArticulosOrdenes([]);
        setArticulosSolicitudes([]);
        setArticulosBajoStock([]);
      } finally {
        setLoadingPendientes(false);
      }
    };

    fetchArticulosPendientes();
  }, [proveedorId, esAdmin]);

  const articulosFiltrados = articulos.filter((art) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      art.nombre?.toLowerCase().includes(searchLower) ||
      art.codigo_ean13?.includes(searchTerm) ||
      art.categoria?.nombre?.toLowerCase().includes(searchLower)
    );
  });

  // Agrupar artículos por categoría para la vista de "Ver todos"
  const articulosPorCategoria = React.useMemo(() => {
    const grupos = {};
    articulosFiltrados.forEach(articulo => {
      const categoriaNombre = articulo.categoria?.nombre || 'Sin categoría';
      if (!grupos[categoriaNombre]) {
        grupos[categoriaNombre] = [];
      }
      grupos[categoriaNombre].push(articulo);
    });
    return grupos;
  }, [articulosFiltrados]);

  const handleSeleccionarArticulo = (articulo) => {
    // Verificar si ya está en la lista
    const yaExiste = articulosSeleccionados.find(item => item.articulo_id === articulo.id);

    if (yaExiste) {
      toast.error('Este artículo ya está en la lista');
      return;
    }

    setArticulosSeleccionados([
      ...articulosSeleccionados,
      {
        articulo_id: articulo.id,
        articulo: articulo, // Guardamos el objeto completo para mostrarlo
        cantidad: 1,
        costo_unitario: articulo.costo_unitario || 0
      }
    ]);

    setSearchTerm('');
    setMostrarCatalogo(false);
    toast.success(`${articulo.nombre} agregado`);
  };

  const handleArticuloEscaneado = (articulo) => {
    // Verificar si ya está en la lista
    const yaExiste = articulosSeleccionados.find(item => item.articulo_id === articulo.id);

    if (yaExiste) {
      // Si ya existe, incrementar cantidad
      const nuevosArticulos = articulosSeleccionados.map(item =>
        item.articulo_id === articulo.id
          ? { ...item, cantidad: parseFloat(item.cantidad) + 1 }
          : item
      );
      setArticulosSeleccionados(nuevosArticulos);
    } else {
      // Si no existe, agregar nuevo
      setArticulosSeleccionados([
        ...articulosSeleccionados,
        {
          articulo_id: articulo.id,
          articulo: articulo,
          cantidad: 1,
          costo_unitario: articulo.costo_unitario || 0
        }
      ]);
    }
  };

  const handleRemoverArticulo = (index) => {
    setArticulosSeleccionados(articulosSeleccionados.filter((_, i) => i !== index));
  };

  const handleCantidadChange = (index, cantidad) => {
    const nuevosArticulos = [...articulosSeleccionados];
    nuevosArticulos[index].cantidad = cantidad;
    setArticulosSeleccionados(nuevosArticulos);
  };

  const handleCostoChange = (index, costo) => {
    const nuevosArticulos = [...articulosSeleccionados];
    nuevosArticulos[index].costo_unitario = costo;
    setArticulosSeleccionados(nuevosArticulos);
  };

  // Agregar artículo desde sugerencias (órdenes, solicitudes o bajo stock)
  const handleAgregarDesdeSugerencias = (item, cantidad, tipo) => {
    // Verificar si ya está en la lista
    const yaExiste = articulosSeleccionados.find(art => art.articulo_id === item.articulo_id);

    if (yaExiste) {
      toast.error('Este artículo ya está en la lista');
      return;
    }

    // Agregar a la lista de artículos seleccionados
    setArticulosSeleccionados([
      ...articulosSeleccionados,
      {
        articulo_id: item.articulo_id,
        articulo: item.articulo,
        cantidad: cantidad,
        costo_unitario: item.articulo?.costo_unitario || 0
      }
    ]);

    // Quitar de la lista correspondiente
    if (tipo === 'orden') {
      setArticulosOrdenes(articulosOrdenes.filter(art => art.articulo_id !== item.articulo_id));
    } else if (tipo === 'solicitud') {
      setArticulosSolicitudes(articulosSolicitudes.filter(art => art.articulo_id !== item.articulo_id));
    } else if (tipo === 'bajo_stock') {
      setArticulosBajoStock(articulosBajoStock.filter(art => art.articulo_id !== item.articulo_id));
    }

    toast.success(`${item.articulo?.nombre} agregado a la orden`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (articulosSeleccionados.length === 0) {
      toast.error('Debe agregar al menos un artículo');
      return;
    }

    // Validar que todos los artículos tengan datos completos
    const articulosValidos = articulosSeleccionados.filter(
      item => item.articulo_id && item.cantidad > 0
    );

    if (articulosValidos.length !== articulosSeleccionados.length) {
      toast.error('Complete todos los datos de los artículos');
      return;
    }

    try {
      setLoading(true);
      const ordenData = {
        articulos: articulosValidos.map(item => ({
          articulo_id: parseInt(item.articulo_id),
          cantidad: parseFloat(item.cantidad),
          costo_unitario: item.costo_unitario ? parseFloat(item.costo_unitario) : undefined
        })),
        proveedor_id: proveedorId ? parseInt(proveedorId) : undefined,
        observaciones: observaciones.trim() || undefined,
        fecha_llegada_estimada: fechaLlegadaEstimada || undefined,
        // Incluir órdenes a consolidar si el admin las seleccionó
        ...(esAdmin && ordenesSeleccionadas.size > 0 && {
          consolidar_ordenes: Array.from(ordenesSeleccionadas)
        })
      };

      const response = await ordenesCompraService.crearOrden(ordenData);

      // Mostrar mensaje con información sobre solicitudes creadas
      if (response.data?.solicitudes_creadas && response.data.solicitudes_creadas.length > 0) {
        toast.success(
          `Orden creada. Se generaron ${response.data.solicitudes_creadas.length} solicitud(es) automática(s) por faltante de stock`,
          { duration: 5000 }
        );
      } else {
        toast.success('Orden de compra creada exitosamente');
      }

      onSuccess();
    } catch (error) {
      console.error('Error al crear orden:', error);
      toast.error(error.response?.data?.message || 'Error al crear la orden de compra');
    } finally {
      setLoading(false);
    }
  };

  const calcularTotal = () => {
    return articulosSeleccionados.reduce((total, item) => {
      return total + (parseFloat(item.cantidad) * parseFloat(item.costo_unitario || 0));
    }, 0);
  };

  if (!isOpen) return null;
  return (
    <CajonNuevaOrdenR2
      onClose={onClose}
      esDiseñador={esDiseñador}
      esAdmin={esAdmin}
      proveedores={proveedores}
      proveedorId={proveedorId}
      setProveedorId={setProveedorId}
      articulos={articulos}
      articulosFiltrados={articulosFiltrados}
      articulosPorCategoria={articulosPorCategoria}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      mostrarCatalogo={mostrarCatalogo}
      setMostrarCatalogo={setMostrarCatalogo}
      articulosSeleccionados={articulosSeleccionados}
      handleSeleccionarArticulo={handleSeleccionarArticulo}
      handleRemoverArticulo={handleRemoverArticulo}
      handleCantidadChange={handleCantidadChange}
      handleCostoChange={handleCostoChange}
      articulosOrdenes={articulosOrdenes}
      articulosSolicitudes={articulosSolicitudes}
      articulosBajoStock={articulosBajoStock}
      ordenesSeleccionadas={ordenesSeleccionadas}
      setOrdenesSeleccionadas={setOrdenesSeleccionadas}
      loadingPendientes={loadingPendientes}
      handleAgregarDesdeSugerencias={handleAgregarDesdeSugerencias}
      fechaLlegadaEstimada={fechaLlegadaEstimada}
      setFechaLlegadaEstimada={setFechaLlegadaEstimada}
      observaciones={observaciones}
      setObservaciones={setObservaciones}
      loading={loading}
      handleSubmit={handleSubmit}
      calcularTotal={calcularTotal}
      abrirNuevoArticulo={() => setMostrarModalNuevoArticulo(true)}
      nuevoArticulo={mostrarModalNuevoArticulo && (
        <ModalNuevoArticulo
          isOpen={mostrarModalNuevoArticulo}
          onClose={() => setMostrarModalNuevoArticulo(false)}
          categorias={categorias}
          ubicaciones={ubicaciones}
          proveedores={proveedores}
          nombreInicial={searchTerm}
          proveedorInicial={proveedorId}
          onSuccess={(nuevoArticulo) => {
            setArticulos([...articulos, nuevoArticulo]);
            setMostrarModalNuevoArticulo(false);
            // Agregar automáticamente el nuevo artículo a la orden
            handleSeleccionarArticulo(nuevoArticulo);
            toast.success('Artículo creado y agregado a la orden');
          }}
        />
      )}
    />
  );
};

// Modal para ver detalle de orden con trazabilidad
// C4 · PLA-16: franja «Pago y pedido (Julia)» del detalle (solo con Diseño 3G). La historia la manda Finanzas por la
// puerta /api/sistemas/v1/ordenes/:folio/seguimiento (FIN-10) y, con LLEGADA_CON_DATOS, la recepción de Planta. Sin
// historia no se muestra nada.
const FranjaPagoPedido = ({ ordenId }) => {
  const [datos, setDatos] = useState(null);
  useEffect(() => {
    let vigente = true;
    ordenesCompraService.obtenerSeguimiento(ordenId)
      .then((d) => { if (vigente) setDatos(d || null); })
      .catch(() => { if (vigente) setDatos(null); });
    return () => { vigente = false; };
  }, [ordenId]);
  if (!datos?.seguimiento?.length) return null;
  return <PagoPedidoR2 datos={datos} />;
};

// Modal para crear orden desde solicitudes seleccionadas
// Default FIJO: un `{}` en la firma es un objeto nuevo en cada render y el efecto
// que inicializa cantidades (depende de él) se disparaba sin fin, borrando lo que
// se escribía y trabando el modal. Pasaba al abrirlo desde la Orden de Salida,
// que no manda cantidadesIniciales.
const SIN_CANTIDADES_INICIALES = {};

export const ModalCrearOrdenDesdeSolicitudes = ({ isOpen, solicitudes, cantidadesIniciales = SIN_CANTIDADES_INICIALES, generarPDFOrden, onClose, onSuccess }) => {
  const [proveedores, setProveedores] = useState([]);
  const [proveedorId, setProveedorId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [fechaLlegadaEstimada, setFechaLlegadaEstimada] = useState('');
  const [loading, setLoading] = useState(false);
  const [cantidadesEditadas, setCantidadesEditadas] = useState({});
  const [articulosEliminados, setArticulosEliminados] = useState(new Set());
  // Productos agregados con el buscador (solo del mismo proveedor de la orden)
  const [articulosExtra, setArticulosExtra] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  // Artículos que se darán de alta como herramienta al crear la orden
  const [marcadosHerramienta, setMarcadosHerramienta] = useState(new Set());

  // Helper: Obtener el proveedor correcto (de artículo o herramienta)
  const obtenerProveedorSolicitud = (solicitud) => {
    // Prioridad 1: Si tiene proveedores via many-to-many, buscar el marcado como preferido
    if (solicitud.articulo?.proveedores?.length > 0) {
      // Buscar el proveedor preferido (es_preferido: true)
      const proveedorPreferido = solicitud.articulo.proveedores.find(
        p => p.ArticuloProveedor?.es_preferido === true
      );
      if (proveedorPreferido) {
        return proveedorPreferido;
      }
      // Si no hay preferido, usar el primero
      return solicitud.articulo.proveedores[0];
    }
    // Prioridad 2: Si tiene proveedor directo (FK legacy), usar ese
    if (solicitud.articulo?.proveedor) {
      return solicitud.articulo.proveedor;
    }
    // Prioridad 3: Si el artículo tiene tipo_herramienta_migrado con proveedor, usar ese (datos antiguos)
    if (solicitud.articulo?.tipo_herramienta_migrado?.proveedor) {
      return solicitud.articulo.tipo_herramienta_migrado.proveedor;
    }
    return null;
  };

  useEffect(() => {
    fetchProveedores();
  }, []);

  // Catálogo para el buscador: se carga una vez al abrir el modal
  useEffect(() => {
    if (!isOpen || catalogo.length > 0) return;
    articulosService.buscar({ activo: true, limit: 99999 })
      .then(arts => setCatalogo(Array.isArray(arts) ? arts : []))
      .catch(() => toast.error('Error al cargar artículos para el buscador'));
  }, [isOpen]);

  // ¿El artículo lo surte este proveedor? (relación many-to-many o FK legacy)
  const esDelProveedor = (articulo, provId) => {
    if (!provId || !articulo) return false;
    const id = parseInt(provId);
    return articulo.proveedor_id === id ||
      articulo.proveedor?.id === id ||
      (articulo.proveedores || []).some(p => p.id === id);
  };

  // Si cambian de proveedor, se quitan los agregados que no son de él
  useEffect(() => {
    setArticulosExtra(prev => {
      const siguen = prev.filter(e => esDelProveedor(e.articulo, proveedorId));
      if (siguen.length !== prev.length) {
        toast(`Se quitaron ${prev.length - siguen.length} producto(s) agregado(s) que no son de este proveedor`, undefined);
      }
      return siguen;
    });
  }, [proveedorId]);

  // Inicializar cantidades editadas cuando cambien las solicitudes
  useEffect(() => {
    if (solicitudes.length === 0) return;

    // Agrupar y calcular cantidades
    const cantidades = {};
    solicitudes.forEach(solicitud => {
      const artId = solicitud.articulo?.id;
      const solicitudId = solicitud.id;

      // Si hay una cantidad editada desde la tabla para esta solicitud, usarla
      const cantidadEditadaTabla = cantidadesIniciales[solicitudId];
      const cantidadOriginal = parseFloat(solicitud.cantidad_solicitada);

      if (!cantidades[artId]) {
        cantidades[artId] = 0;
      }

      // Usar cantidad editada si existe, sino la original
      cantidades[artId] += cantidadEditadaTabla !== undefined ? cantidadEditadaTabla : cantidadOriginal;
    });

    setCantidadesEditadas(cantidades);
  }, [solicitudes, cantidadesIniciales]);

  // Efecto para seleccionar automáticamente el proveedor preferido
  useEffect(() => {
    if (solicitudes.length === 0) return;

    // Obtener los proveedores preferidos de todos los artículos (incluyendo herramientas)
    const proveedoresPreferidos = solicitudes
      .map(s => obtenerProveedorSolicitud(s)?.id)
      .filter(id => id !== null && id !== undefined);

    // Si todos los artículos tienen el mismo proveedor preferido, seleccionarlo
    if (proveedoresPreferidos.length > 0) {
      const primerProveedor = proveedoresPreferidos[0];
      const todosTienenMismoProveedor = proveedoresPreferidos.every(id => id === primerProveedor);

      if (todosTienenMismoProveedor) {
        setProveedorId(primerProveedor.toString());
      }
    }
  }, [solicitudes]);

  const fetchProveedores = async () => {
    try {
      const provData = await proveedoresService.listar();
      const proveedoresArray = Array.isArray(provData)
        ? provData
        : (provData?.data?.proveedores || provData?.data || []);
      setProveedores(proveedoresArray);
    } catch (error) {
      console.error('Error al cargar proveedores:', error);
      toast.error('Error al cargar proveedores');
    }
  };

  const calcularTotal = () => {
    const deSolicitudes = articulosAgrupados.reduce((total, item) => {
      const cantidad = item.articulo?.id in cantidadesEditadas ? cantidadesEditadas[item.articulo?.id] : item.cantidad_total;
      const costo = parseFloat(item.articulo?.costo_unitario || 0);
      return total + (cantidad * costo);
    }, 0);
    const deAgregados = articulosExtra.reduce((total, e) =>
      total + (parseFloat(e.cantidad) || 0) * parseFloat(e.articulo?.costo_unitario || 0), 0);
    return deSolicitudes + deAgregados;
  };

  const handleAgregarArticulo = (articulo) => {
    setArticulosExtra(prev => [...prev, { articulo, cantidad: 1 }]);
    setBusqueda('');
  };

  const handleCantidadExtraChange = (articuloId, valor) => {
    if (valor !== '' && (isNaN(parseFloat(valor)) || parseFloat(valor) < 0)) return;
    setArticulosExtra(prev => prev.map(e =>
      e.articulo.id === articuloId ? { ...e, cantidad: valor === '' ? '' : parseFloat(valor) } : e
    ));
  };

  const handleQuitarExtra = (articuloId) => {
    setArticulosExtra(prev => prev.filter(e => e.articulo.id !== articuloId));
    setMarcadosHerramienta(prev => {
      const s = new Set(prev);
      s.delete(articuloId);
      return s;
    });
  };

  const toggleHerramienta = (articuloId) => {
    setMarcadosHerramienta(prev => {
      const s = new Set(prev);
      if (s.has(articuloId)) s.delete(articuloId); else s.add(articuloId);
      return s;
    });
  };

  const handleCantidadChange = (articuloId, nuevaCantidad) => {
    if (nuevaCantidad === '' || nuevaCantidad === null || nuevaCantidad === undefined) {
      setCantidadesEditadas(prev => ({
        ...prev,
        [articuloId]: ''
      }));
      return;
    }
    const cantidad = parseFloat(nuevaCantidad);
    if (isNaN(cantidad) || cantidad < 0) return;

    setCantidadesEditadas(prev => ({
      ...prev,
      [articuloId]: cantidad
    }));
  };

  const handleEliminarArticulo = (articuloId) => {
    setArticulosEliminados(prev => {
      const nuevos = new Set(prev);
      nuevos.add(articuloId);
      return nuevos;
    });
    toast.success('Artículo eliminado de la orden');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validar que queden artículos después de eliminar
    if (articulosAgrupados.length === 0) {
      toast.error('Debes tener al menos un artículo de las solicitudes en la orden');
      return;
    }

    if (articulosExtra.some(e => !(parseFloat(e.cantidad) > 0))) {
      toast.error('Captura la cantidad de los productos agregados');
      return;
    }

    try {
      setLoading(true);

      // Filtrar solicitudes: solo incluir las que NO tienen artículos eliminados
      const solicitudesValidas = solicitudes.filter(s => !articulosEliminados.has(s.articulo?.id));
      const solicitudes_ids = solicitudesValidas.map(s => s.id);

      // Preparar cantidades personalizadas (solo si fueron editadas)
      const cantidades_custom = {};
      let huboEdiciones = false;

      articulosAgrupados.forEach(item => {
        const articuloId = item.articulo?.id;
        const cantidadEditada = cantidadesEditadas[articuloId];
        const cantidadOriginal = item.cantidad_total;

        // Solo incluir si la cantidad fue editada
        if (cantidadEditada && cantidadEditada !== cantidadOriginal) {
          cantidades_custom[articuloId] = cantidadEditada;
          huboEdiciones = true;
        }
      });

      const response = await ordenesCompraService.crearOrdenDesdeSolicitudes(
        solicitudes_ids,
        proveedorId ? parseInt(proveedorId) : null,
        observaciones.trim() || null,
        huboEdiciones ? cantidades_custom : null,
        fechaLlegadaEstimada || null,
        articulosExtra.map(e => ({ articulo_id: e.articulo.id, cantidad: parseFloat(e.cantidad) })),
        Array.from(marcadosHerramienta)
      );

      toast.success(`Orden creada exitosamente con ${solicitudesValidas.length} solicitud(es)`);

      // Generar PDF automáticamente
      if (response.data?.orden && generarPDFOrden) {
        await generarPDFOrden(response.data.orden);
      }

      onSuccess();
    } catch (error) {
      console.error('Error al crear orden:', error);
      toast.error(error.response?.data?.message || 'Error al crear la orden');
    } finally {
      setLoading(false);
    }
  };

  // Agrupar solicitudes por artículo (en caso de que haya duplicados) y filtrar eliminados
  const articulosAgrupados = React.useMemo(() => {
    const mapa = new Map();
    solicitudes.forEach(solicitud => {
      const artId = solicitud.articulo?.id;

      // Filtrar artículos eliminados
      if (articulosEliminados.has(artId)) return;

      if (mapa.has(artId)) {
        const existente = mapa.get(artId);
        existente.cantidad_total += parseFloat(solicitud.cantidad_solicitada);
        existente.solicitudes.push(solicitud);
      } else {
        mapa.set(artId, {
          articulo: solicitud.articulo,
          cantidad_total: parseFloat(solicitud.cantidad_solicitada),
          solicitudes: [solicitud]
        });
      }
    });
    return Array.from(mapa.values());
  }, [solicitudes, articulosEliminados]);

  // Resultados del buscador: activos, del proveedor elegido y que no estén ya en la orden
  const resultadosBusqueda = React.useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (termino.length < 2 || !proveedorId) return [];
    const enOrden = new Set([
      ...articulosAgrupados.map(i => i.articulo?.id),
      ...articulosExtra.map(e => e.articulo.id)
    ]);
    return catalogo
      .filter(art => art.activo !== false && !enOrden.has(art.id) && esDelProveedor(art, proveedorId))
      .filter(art =>
        art.nombre?.toLowerCase().includes(termino) ||
        art.codigo_ean13?.includes(termino) ||
        art.categoria?.nombre?.toLowerCase().includes(termino)
      )
      .slice(0, 30);
  }, [busqueda, catalogo, proveedorId, articulosAgrupados, articulosExtra]);

  if (!isOpen) return null;
  const preferidosR2 = solicitudes
    .map(s => obtenerProveedorSolicitud(s)?.id)
    .filter(id => id !== null && id !== undefined);
  const mismoR2 = preferidosR2.length > 0 && preferidosR2.every(id => id === preferidosR2[0]);
  const preferidoR2 = proveedorId && mismoR2 && preferidosR2[0].toString() === proveedorId
    ? proveedores.find(p => p.id.toString() === proveedorId)?.nombre
    : null;
  return (
    <CajonArmarOrdenR2
      onClose={onClose}
      solicitudes={solicitudes}
      proveedores={proveedores}
      proveedorId={proveedorId}
      setProveedorId={setProveedorId}
      preferido={preferidoR2}
      fechaLlegadaEstimada={fechaLlegadaEstimada}
      setFechaLlegadaEstimada={setFechaLlegadaEstimada}
      observaciones={observaciones}
      setObservaciones={setObservaciones}
      loading={loading}
      articulosAgrupados={articulosAgrupados}
      cantidadesEditadas={cantidadesEditadas}
      handleCantidadChange={handleCantidadChange}
      handleEliminarArticulo={handleEliminarArticulo}
      articulosExtra={articulosExtra}
      handleCantidadExtraChange={handleCantidadExtraChange}
      handleQuitarExtra={handleQuitarExtra}
      marcadosHerramienta={marcadosHerramienta}
      toggleHerramienta={toggleHerramienta}
      busqueda={busqueda}
      setBusqueda={setBusqueda}
      resultadosBusqueda={resultadosBusqueda}
      handleAgregarArticulo={handleAgregarArticulo}
      calcularTotal={calcularTotal}
      handleSubmit={handleSubmit}
    />
  );
};

// Modal para crear nuevo artículo desde la orden de compra
const ModalNuevoArticulo = ({ isOpen, onClose, categorias, ubicaciones, proveedores, onSuccess, nombreInicial = '', proveedorInicial = '' }) => {
  const [formData, setFormData] = useState({
    nombre: nombreInicial || '',
    descripcion: '',
    categoria_id: '',
    ubicacion_id: '',
    proveedor_id: proveedorInicial || '',
    stock_actual: 0,
    stock_minimo: 0,
    stock_maximo: '',
    unidad: 'piezas',
    costo_unitario: ''
  });
  const [loading, setLoading] = useState(false);
  const [modoNuevoProveedor, setModoNuevoProveedor] = useState(false);
  const [nuevoProveedorNombre, setNuevoProveedorNombre] = useState('');
  const [proveedoresList, setProveedoresList] = useState(proveedores);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Si selecciona "nuevo" en el dropdown de proveedores
    if (name === 'proveedor_id' && value === 'nuevo') {
      setModoNuevoProveedor(true);
      setFormData(prev => ({
        ...prev,
        proveedor_id: ''
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCrearProveedorRapido = async () => {
    if (!nuevoProveedorNombre.trim()) {
      toast.error('Ingrese el nombre del proveedor');
      return;
    }

    try {
      const response = await proveedoresService.crear({
        nombre: nuevoProveedorNombre.trim(),
        activo: true
      });

      const nuevoProveedor = response.data?.proveedor || response.proveedor || response;

      // Actualizar lista de proveedores
      setProveedoresList([...proveedoresList, nuevoProveedor]);

      // Seleccionar el nuevo proveedor
      setFormData(prev => ({
        ...prev,
        proveedor_id: nuevoProveedor.id
      }));

      setModoNuevoProveedor(false);
      setNuevoProveedorNombre('');
      toast.success(`Proveedor "${nuevoProveedor.nombre}" creado correctamente`);
    } catch (error) {
      console.error('Error al crear proveedor:', error);
      toast.error(error.response?.data?.message || 'Error al crear el proveedor');
    }
  };

  const handleCancelarNuevoProveedor = () => {
    setModoNuevoProveedor(false);
    setNuevoProveedorNombre('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nombre || !formData.categoria_id || !formData.ubicacion_id) {
      toast.error('Complete los campos obligatorios');
      return;
    }

    try {
      setLoading(true);

      // Preparar datos para enviar
      const dataToSend = {
        nombre: formData.nombre,
        descripcion: formData.descripcion || null,
        categoria_id: parseInt(formData.categoria_id),
        ubicacion_id: parseInt(formData.ubicacion_id),
        proveedor_id: formData.proveedor_id ? parseInt(formData.proveedor_id) : null,
        stock_actual: 0, // Siempre en 0 para artículos nuevos desde orden de compra
        stock_minimo: parseFloat(formData.stock_minimo) >= 0 ? parseFloat(formData.stock_minimo) : 0,
        stock_maximo: formData.stock_maximo ? parseFloat(formData.stock_maximo) : null,
        unidad: formData.unidad,
        costo_unitario: formData.costo_unitario ? parseFloat(formData.costo_unitario) : null,
        activo: true
      };

      const response = await articulosService.create(dataToSend);
      const nuevoArticulo = response.data?.articulo || response.articulo || response;

      onSuccess(nuevoArticulo);
      toast.success('Artículo creado correctamente');

      // Resetear formulario
      setFormData({
        nombre: '',
        descripcion: '',
        categoria_id: '',
        ubicacion_id: '',
        proveedor_id: '',
        stock_actual: 0,
        stock_minimo: 0,
        stock_maximo: '',
        unidad: 'piezas',
        costo_unitario: ''
      });
    } catch (error) {
      console.error('Error al crear artículo:', error);
      toast.error(error.response?.data?.message || 'Error al crear el artículo');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  return (
    <CajonNuevoArticuloR2
      onClose={onClose}
      formData={formData}
      handleChange={handleChange}
      categorias={categorias}
      ubicaciones={ubicaciones}
      proveedoresList={proveedoresList}
      modoNuevoProveedor={modoNuevoProveedor}
      nuevoProveedorNombre={nuevoProveedorNombre}
      setNuevoProveedorNombre={setNuevoProveedorNombre}
      handleCrearProveedorRapido={handleCrearProveedorRapido}
      handleCancelarNuevoProveedor={handleCancelarNuevoProveedor}
      loading={loading}
      handleSubmit={handleSubmit}
    />
  );
};

// Modal para cancelar solicitud de compra
const CancelarSolicitudModal = ({ isOpen, onClose, solicitud, onCancelar }) => {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!motivo || motivo.trim().length < 10) {
      toast.error('El motivo debe tener al menos 10 caracteres');
      return;
    }

    setLoading(true);
    try {
      await onCancelar(solicitud.id, motivo);
      onClose();
    } catch (error) {
      console.error('Error al cancelar solicitud:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  return (
    <DialogoCancelarSolicitudR2 onClose={onClose} solicitud={solicitud} motivo={motivo} setMotivo={setMotivo}
      loading={loading} handleSubmit={handleSubmit} />
  );
};

// Sub-componente botón para crear solicitud directamente
const ArticuloSolicitudBtn = ({ articulo, onCrearSolicitud, tieneSolicitud, corto }) => {
  const [loading, setLoading] = useState(false);
  const [creada, setCreada] = useState(false);
  const crearR2 = async () => {
    setLoading(true);
    try {
      await onCrearSolicitud(articulo);
      setCreada(true);
      toast.success(`Solicitud creada: ${articulo.nombre}`);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Error al crear solicitud');
    } finally {
      setLoading(false);
    }
  };
  return <BotonSolicitudR2 loading={loading} creada={creada} tieneSolicitud={tieneSolicitud} alCrear={crearR2} nombre={articulo.nombre} corto={corto} />;
};

// Modal de Artículos Encontrados
// Sub-componente para mostrar último movimiento de un artículo
const UltimoMovimientoInfo = ({ articuloId, soloFecha }) => {
  const [mov, setMov] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMov = async () => {
      try {
        const data = await articulosService.getUltimoMovimiento(articuloId);
        setMov(data.ultimoMovimiento);
      } catch (e) {
        setMov(null);
      } finally {
        setLoading(false);
      }
    };
    fetchMov();
  }, [articuloId]);

  return <UltimoMovimientoR2 loading={loading} mov={mov} soloFecha={soloFecha} />;
};

const ModalArticulosEncontrados = ({ isOpen, onClose, articulos, onCrearSolicitud, titulo, articulosConSolicitudIds = [] }) => {
  // Filtros por Almacén y Sección (default Principal / Stock).
  const [filtroAlmacen, setFiltroAlmacen] = useState('Principal');
  const [filtroSeccion, setFiltroSeccion] = useState('Stock');

  const getAlmacen = (art) => art?.ubicacion?.almacen_ref?.nombre || art?.ubicacion?.almacen || 'Sin almacén';
  const getSeccion = (art) => art?.seccion?.nombre || 'Sin sección';

  const almacenesUnicos = useMemo(() => {
    const set = new Set(articulos.map(getAlmacen));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [articulos]);

  const seccionesUnicas = useMemo(() => {
    const base = filtroAlmacen === 'todos'
      ? articulos
      : articulos.filter(a => getAlmacen(a) === filtroAlmacen);
    const set = new Set(base.map(getSeccion));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [articulos, filtroAlmacen]);

  const articulosFiltrados = useMemo(() => {
    return articulos.filter(art => {
      if (filtroAlmacen !== 'todos' && getAlmacen(art) !== filtroAlmacen) return false;
      if (filtroSeccion !== 'todos' && getSeccion(art) !== filtroSeccion) return false;
      return true;
    });
  }, [articulos, filtroAlmacen, filtroSeccion]);

  if (!isOpen) return null;

  const generarPDFBajoStock = async () => {
    toast.loading('Generando PDF...', { id: 'pdf-loading' });

    try {
      // Usar la lista filtrada para que el PDF refleje lo visible
      const articulosParaPDF = articulosFiltrados;
      // Fetch último movimiento para todos los artículos en paralelo
      const movimientosPromises = articulosParaPDF.map(art =>
        articulosService.getUltimoMovimiento(art.id)
          .then(data => ({ id: art.id, mov: data.ultimoMovimiento }))
          .catch(() => ({ id: art.id, mov: null }))
      );
      const movimientos = await Promise.all(movimientosPromises);
      const movMap = {};
      movimientos.forEach(m => { movMap[m.id] = m.mov; });

      // Cargar imágenes de productos
      const loadImage = (url) => new Promise((resolve) => {
        if (!url) { resolve(null); return; }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
          } catch (e) { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });

      const imagePromises = articulosParaPDF.map(art =>
        loadImage(art.imagen_url).then(data => ({ id: art.id, img: data }))
      );
      const images = await Promise.all(imagePromises);
      const imgMap = {};
      images.forEach(i => { imgMap[i.id] = i.img; });

      const doc = new jsPDF('landscape', 'mm', 'letter');
      const fecha = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Reporte de Artículos Bajo Stock Mínimo', 14, 20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`Generado: ${fecha}`, 14, 27);
      doc.text(`Total de artículos: ${articulosParaPDF.length}`, 14, 32);
      doc.setTextColor(0);

      // Table config
      const startY = 40;
      const rowH = 12;
      const colWidths = [8, 14, 62, 35, 25, 25, 25, 35, 30];
      const headers = ['#', 'Foto', 'Artículo', 'Categoría', 'Stock Act.', 'Stock Mín.', 'Faltante', 'Proveedor', 'Últ. Actualización'];
      const tableW = colWidths.reduce((a, b) => a + b, 0);

      const drawHeader = (y) => {
        doc.setFillColor(220, 38, 38);
        doc.rect(14, y - 6, tableW, 8, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255);
        let xH = 16;
        headers.forEach((h, i) => {
          doc.text(h, xH, y);
          xH += colWidths[i];
        });
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0);
      };

      drawHeader(startY);
      let yPos = startY + 8;

      // Sort: critical first
      const sorted = [...articulosParaPDF].sort((a, b) => {
        const pctA = parseFloat(a.stock_actual) / parseFloat(a.stock_minimo || 1);
        const pctB = parseFloat(b.stock_actual) / parseFloat(b.stock_minimo || 1);
        return pctA - pctB;
      });

      sorted.forEach((art, idx) => {
        if (yPos > 185) {
          doc.addPage();
          yPos = 20;
          drawHeader(yPos);
          yPos += 8;
        }

        const stockActual = parseFloat(art.stock_actual);
        const stockMin = parseFloat(art.stock_minimo || 0);
        const faltante = Math.max(0, stockMin - stockActual);
        const pct = (stockActual / (stockMin || 1)) * 100;
        const critico = pct < 50;

        // Row background
        if (idx % 2 === 0) {
          doc.setFillColor(critico ? 254 : 250, critico ? 242 : 250, critico ? 242 : 250);
          doc.rect(14, yPos - 4, tableW, rowH, 'F');
        }

        doc.setFontSize(7);
        let x = 16;

        // #
        doc.text(`${idx + 1}`, x, yPos);
        x += colWidths[0];

        // Foto
        const imgData = imgMap[art.id];
        if (imgData) {
          try {
            doc.addImage(imgData, 'JPEG', x, yPos - 4, 10, 10);
          } catch (e) { /* skip */ }
        }
        x += colWidths[1];

        // Artículo
        const nombre = art.nombre.length > 35 ? art.nombre.substring(0, 32) + '...' : art.nombre;
        doc.setFont('helvetica', 'bold');
        doc.text(nombre, x, yPos);
        doc.setFont('helvetica', 'normal');
        x += colWidths[2];

        // Categoría
        doc.text(art.categoria?.nombre || 'N/A', x, yPos);
        x += colWidths[3];

        // Stock Actual
        if (critico) doc.setTextColor(220, 38, 38);
        doc.text(`${stockActual} ${art.unidad || ''}`, x, yPos);
        doc.setTextColor(0);
        x += colWidths[4];

        // Stock Mín.
        doc.text(`${stockMin} ${art.unidad || ''}`, x, yPos);
        x += colWidths[5];

        // Faltante
        doc.setTextColor(220, 38, 38);
        doc.text(`${faltante} ${art.unidad || ''}`, x, yPos);
        doc.setTextColor(0);
        x += colWidths[6];

        // Proveedor
        const provNombre = art.proveedor?.nombre || art.proveedores?.[0]?.nombre || '-';
        const provTrunc = provNombre.length > 18 ? provNombre.substring(0, 15) + '...' : provNombre;
        doc.text(provTrunc, x, yPos);
        x += colWidths[7];

        // Última actualización
        const mov = movMap[art.id];
        if (mov) {
          const fechaMov = new Date(mov.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
          doc.text(fechaMov, x, yPos);
        } else {
          doc.setTextColor(150);
          doc.text('Sin datos', x, yPos);
          doc.setTextColor(0);
        }

        yPos += rowH;
      });

      doc.save(`bajo-stock-minimo-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF descargado', { id: 'pdf-loading' });
    } catch (error) {
      console.error('Error al generar PDF:', error);
      toast.error('Error al generar PDF', { id: 'pdf-loading' });
    }
  };

  return (
    <CajonBajoStockR2
      onClose={onClose}
      titulo={titulo}
      articulos={articulos}
      articulosFiltrados={articulosFiltrados}
      filtroAlmacen={filtroAlmacen}
      setFiltroAlmacen={setFiltroAlmacen}
      filtroSeccion={filtroSeccion}
      setFiltroSeccion={setFiltroSeccion}
      almacenesUnicos={almacenesUnicos}
      seccionesUnicas={seccionesUnicas}
      generarPDFBajoStock={generarPDFBajoStock}
      BotonSolicitud={ArticuloSolicitudBtn}
      UltimoMovimiento={UltimoMovimientoInfo}
      onCrearSolicitud={onCrearSolicitud}
      articulosConSolicitudIds={articulosConSolicitudIds}
    />
  );
};

export default OrdenesCompraPage;
