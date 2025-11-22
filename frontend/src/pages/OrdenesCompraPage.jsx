import React, { useState, useEffect } from 'react';
import { Search, Plus, Package, ShoppingCart, Eye, Send, CheckCircle, XCircle, AlertCircle, Camera, Download, FileText, PlusCircle, RotateCcw, Trash2 } from 'lucide-react';
import ordenesCompraService from '../services/ordenesCompra.service';
import articulosService from '../services/articulos.service';
import proveedoresService from '../services/proveedores.service';
import categoriasService from '../services/categorias.service';
import ubicacionesService from '../services/ubicaciones.service';
import { Loader, Modal, Button, TimelineHistorial } from '../components/common';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import EAN13ScannerOrdenesCompra from '../components/scanner/EAN13ScannerOrdenesCompra';
import { jsPDF } from 'jspdf';
import AnularOrdenCompraModal from '../components/ordenes-compra/AnularOrdenCompraModal';

const OrdenesCompraPage = () => {
  const [ordenes, setOrdenes] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [vistaActual, setVistaActual] = useState('solicitudes'); // 'solicitudes' o 'ordenes'
  const [modalNuevaOrden, setModalNuevaOrden] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [solicitudesSeleccionadas, setSolicitudesSeleccionadas] = useState([]);
  const [modalCrearDesdeSeleccion, setModalCrearDesdeSeleccion] = useState(false);
  const [filterPrioridad, setFilterPrioridad] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [searchSolicitudes, setSearchSolicitudes] = useState('');
  const [estadisticas, setEstadisticas] = useState(null);
  const [modalAnular, setModalAnular] = useState(false);
  const [ordenAAnular, setOrdenAAnular] = useState(null);
  const [cantidadesSolicitudesEditadas, setCantidadesSolicitudesEditadas] = useState({});
  const { user } = useAuth();

  // Verificar permisos
  const puedeCrearOrdenes = ['administrador', 'diseñador', 'almacen', 'compras'].includes(user?.rol);
  const esDiseñador = user?.rol === 'diseñador';
  const puedeAnularOrdenes = ['administrador', 'almacen', 'compras'].includes(user?.rol);

  useEffect(() => {
    fetchData();
    fetchEstadisticas();
  }, [vistaActual]);

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
    } catch (error) {
      console.error('Error al cargar datos:', error);
      toast.error('Error al cargar los datos');
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
    const cantidad = parseFloat(nuevaCantidad);
    if (isNaN(cantidad) || cantidad < 0) return;

    setCantidadesSolicitudesEditadas(prev => ({
      ...prev,
      [solicitudId]: cantidad
    }));
  };

  const handleClickSolicitud = (solicitud) => {
    // Identificar el proveedor preferido de la solicitud clickeada
    const proveedorPreferido = solicitud.articulo?.proveedor?.id;

    // Si tiene proveedor preferido, seleccionar todas las solicitudes con el mismo proveedor
    if (proveedorPreferido) {
      const solicitudesMismoProveedor = solicitudes
        .filter(s => s.articulo?.proveedor?.id === proveedorPreferido)
        .map(s => s.id);

      if (solicitudesMismoProveedor.length > 1) {
        const nombreProveedor = solicitud.articulo?.proveedor?.nombre;
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

  const handleEnviarOrden = async (ordenId) => {
    if (!window.confirm('¿Está seguro de enviar esta orden al proveedor?')) return;

    try {
      await ordenesCompraService.enviarOrden(ordenId);
      toast.success('Orden enviada al proveedor');
      fetchData();
    } catch (error) {
      toast.error('Error al enviar la orden');
    }
  };

  const handleActualizarEstado = async (ordenId, nuevoEstado) => {
    try {
      await ordenesCompraService.actualizarEstado(ordenId, nuevoEstado);
      toast.success('Estado actualizado');
      fetchData();
    } catch (error) {
      toast.error('Error al actualizar el estado');
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

      const doc = new jsPDF();

      // URLs de los logos
      const logoCompletoUrl = 'https://res.cloudinary.com/dd93jrilg/image/upload/v1762292854/logo_completo_web_eknzcb.png';
      const marcaAguaUrl = 'https://res.cloudinary.com/dd93jrilg/image/upload/v1763602391/iso_black_1_mmxd6k.png';

      // Cargar imágenes con dimensiones
      const [logoData, marcaAguaData] = await Promise.all([
        loadImageWithDimensions(logoCompletoUrl),
        loadImageWithDimensions(marcaAguaUrl)
      ]);

      // === HEADER ===
      // Logo completo arriba a la izquierda (respetando relación de aspecto)
      if (logoData) {
        const logoWidth = 70; // Ancho deseado en mm
        const logoHeight = logoWidth / logoData.aspectRatio; // Alto calculado
        doc.addImage(logoData.base64, 'PNG', 15, 10, logoWidth, logoHeight);
      }

      // Ticket ID debajo del logo
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.text(`OC. ${ordenCompleta.ticket_id || 'N/A'}`, 15, 42);

      // Información a la derecha
      let rightX = 120;
      let rightY = 15;

      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('PROVEEDOR', rightX, rightY);
      doc.setFont(undefined, 'normal');
      doc.text(ordenCompleta.proveedor?.nombre || 'Sin proveedor', rightX, rightY + 5);

      rightY += 15;
      doc.setFont(undefined, 'bold');
      doc.text('CREADO POR', rightX, rightY);
      doc.setFont(undefined, 'normal');
      doc.text(ordenCompleta.creador?.nombre || 'N/A', rightX, rightY + 5);

      rightY += 15;
      doc.setFont(undefined, 'bold');
      doc.text('FECHA:', rightX, rightY);
      doc.setFont(undefined, 'normal');
      doc.text(
        new Date(ordenCompleta.created_at).toLocaleDateString('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }),
        rightX,
        rightY + 5
      );

      // === TÍTULO PRINCIPAL ===
      let yPos = 60;
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('ORDEN DE COMPRA', 15, yPos);

      yPos += 10;

      // === INFORMACIÓN ADICIONAL ===
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');

      if (ordenCompleta.proveedor?.telefono) {
        doc.text(`Tel: ${ordenCompleta.proveedor.telefono}`, 15, yPos);
        yPos += 5;
      }
      if (ordenCompleta.proveedor?.email) {
        doc.text(`Email: ${ordenCompleta.proveedor.email}`, 15, yPos);
        yPos += 5;
      }

      yPos += 5;

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

      // Mostrar artículos por categoría
      doc.setFontSize(10);
      let totalGeneral = 0;

      Object.keys(articulosPorCategoria).forEach(categoria => {
        if (yPos > 220) {
          doc.addPage();
          yPos = 20;
        }

        // Nombre de categoría
        doc.setFont(undefined, 'bold');
        doc.text(categoria.toUpperCase(), 15, yPos);
        yPos += 6;

        // Lista de artículos
        doc.setFont(undefined, 'normal');
        articulosPorCategoria[categoria].forEach(detalle => {
          if (yPos > 220) {
            doc.addPage();
            yPos = 20;
          }

          const nombreArticulo = detalle.articulo?.nombre || `Artículo ID: ${detalle.articulo_id}`;
          const cantidad = detalle.cantidad_solicitada;
          const unidad = detalle.articulo?.unidad || 'uds';
          const costoUnit = parseFloat(detalle.costo_unitario || 0);
          const subtotal = cantidad * costoUnit;
          totalGeneral += subtotal;

          // Bullet point con artículo y precio
          doc.text(`• ${nombreArticulo} - ${cantidad} ${unidad} x $${costoUnit.toFixed(2)} = $${subtotal.toFixed(2)}`, 20, yPos);
          yPos += 6;
        });

        yPos += 4;
      });

      // === TOTAL ===
      yPos += 5;
      doc.setFont(undefined, 'bold');
      doc.setFontSize(11);
      doc.text(`TOTAL: $${totalGeneral.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 15, yPos);

      // === MARCA DE AGUA ===
      if (marcaAguaData) {
        // Configurar opacidad para la marca de agua (efecto difuminado)
        const gState = doc.GState({ opacity: 0.08 });
        doc.setGState(gState);

        // Calcular dimensiones respetando relación de aspecto
        const watermarkWidth = 160; // Ancho más grande
        const watermarkHeight = watermarkWidth / marcaAguaData.aspectRatio;

        // Agregar marca de agua grande, más abajo y a la derecha (cortada)
        doc.addImage(marcaAguaData.base64, 'PNG', 60, 180, watermarkWidth, watermarkHeight, undefined, 'NONE', 0);

        // Restaurar opacidad normal
        doc.setGState(doc.GState({ opacity: 1 }));
      }

      // === FOOTER CON BARRA ROJA ===
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        // Barra roja
        doc.setFillColor(185, 28, 28);
        doc.rect(0, 280, 210, 17, 'F');

        // Texto en la barra
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text('4621302459 | admin@3gvelarias.com', 105, 289, { align: 'center' });
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

    return matchesSearch && matchesEstado;
  });

  // Filtrar solicitudes con filtros inteligentes
  const filteredSolicitudes = solicitudes.filter((solicitud) => {
    const matchesSearch =
      solicitud.ticket_id?.toLowerCase().includes(searchSolicitudes.toLowerCase()) ||
      solicitud.articulo?.nombre?.toLowerCase().includes(searchSolicitudes.toLowerCase()) ||
      solicitud.articulo?.categoria?.nombre?.toLowerCase().includes(searchSolicitudes.toLowerCase()) ||
      solicitud.solicitante?.nombre?.toLowerCase().includes(searchSolicitudes.toLowerCase()) ||
      solicitud.motivo?.toLowerCase().includes(searchSolicitudes.toLowerCase());

    const matchesPrioridad = !filterPrioridad || solicitud.prioridad === filterPrioridad;
    const matchesCategoria = !filterCategoria || solicitud.articulo?.categoria?.id === parseInt(filterCategoria);

    return matchesSearch && matchesPrioridad && matchesCategoria;
  });

  // Extraer categorías únicas de las solicitudes
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

  const getEstadoBadge = (estado) => {
    const estados = {
      borrador: { label: 'Borrador', color: 'bg-gray-100 text-gray-800', icon: AlertCircle },
      enviada: { label: 'Enviada', color: 'bg-blue-100 text-blue-800', icon: Send },
      parcial: { label: 'Parcial', color: 'bg-yellow-100 text-yellow-800', icon: Package },
      recibida: { label: 'Recibida', color: 'bg-green-100 text-green-800', icon: CheckCircle },
      cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-800', icon: XCircle }
    };

    const config = estados[estado] || estados.borrador;
    const IconComponent = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <IconComponent size={12} />
        {config.label}
      </span>
    );
  };

  const getPrioridadBadge = (prioridad) => {
    const prioridades = {
      baja: 'bg-gray-100 text-gray-800',
      media: 'bg-blue-100 text-blue-800',
      alta: 'bg-orange-100 text-orange-800',
      urgente: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${prioridades[prioridad] || prioridades.media}`}>
        {prioridad?.toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Órdenes de Compra</h1>
        <p className="text-gray-600">
          {esDiseñador
            ? 'Puedes crear órdenes aunque no haya stock. Se generarán solicitudes automáticas para artículos faltantes.'
            : 'Gestiona las órdenes de compra y solicitudes pendientes.'}
        </p>
      </div>

      {/* Dashboard de Métricas */}
      {estadisticas && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Solicitudes Pendientes */}
          <div className={`bg-white rounded-lg shadow p-5 border-l-4 ${
            estadisticas.resumen.solicitudesPendientes > 10
              ? 'border-red-500'
              : 'border-orange-500'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Solicitudes Pendientes</p>
                <p className="text-3xl font-bold text-gray-900">
                  {estadisticas.resumen.solicitudesPendientes}
                </p>
                {estadisticas.resumen.solicitudesPendientes > 10 && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    Requiere atención
                  </p>
                )}
              </div>
              <AlertCircle
                size={40}
                className={estadisticas.resumen.solicitudesPendientes > 10 ? 'text-red-500' : 'text-orange-500'}
              />
            </div>
          </div>

          {/* Órdenes en Borrador */}
          <div className="bg-white rounded-lg shadow p-5 border-l-4 border-gray-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Órdenes en Borrador</p>
                <p className="text-3xl font-bold text-gray-900">
                  {estadisticas.resumen.ordenesBorrador}
                </p>
              </div>
              <Package size={40} className="text-gray-500" />
            </div>
          </div>

          {/* Órdenes Enviadas */}
          <div className="bg-white rounded-lg shadow p-5 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Esperando Entrega</p>
                <p className="text-3xl font-bold text-gray-900">
                  {estadisticas.resumen.ordenesEnviadas}
                </p>
              </div>
              <Send size={40} className="text-blue-500" />
            </div>
          </div>

          {/* Total Estimado del Mes */}
          <div className="bg-white rounded-lg shadow p-5 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total del Mes</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${parseFloat(estadisticas.resumen.totalEstimadoMes).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                </p>
              </div>
              <ShoppingCart size={40} className="text-green-500" />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setVistaActual('ordenes')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              vistaActual === 'ordenes'
                ? 'border-red-700 text-red-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} />
              Órdenes de Compra
            </div>
          </button>
          <button
            onClick={() => setVistaActual('solicitudes')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              vistaActual === 'solicitudes'
                ? 'border-red-700 text-red-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={18} />
              Solicitudes Pendientes
              {solicitudes.length > 0 && (
                <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {solicitudes.length}
                </span>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Vista de Órdenes */}
      {vistaActual === 'ordenes' && (
        <>
          {/* Barra de búsqueda y filtros */}
          <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Buscar por ticket, proveedor u observaciones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
              />
            </div>

            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            >
              <option value="">Todos los estados</option>
              <option value="borrador">Borrador</option>
              <option value="enviada">Enviada</option>
              <option value="parcial">Parcial</option>
              <option value="recibida">Recibida</option>
              <option value="cancelada">Cancelada</option>
            </select>

            {puedeCrearOrdenes && (
              <Button
                onClick={() => setModalNuevaOrden(true)}
                className="bg-red-700 hover:bg-red-800 text-white"
              >
                <Plus size={20} />
                Nueva Orden
              </Button>
            )}
          </div>

          {/* Lista de órdenes */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ticket
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Proveedor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Creado por
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Estimado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrdenes.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                        <Package size={48} className="mx-auto mb-2 text-gray-300" />
                        <p>No hay órdenes de compra</p>
                      </td>
                    </tr>
                  ) : (
                    filteredOrdenes.map((orden) => (
                      <tr key={orden.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{orden.ticket_id}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {orden.proveedor?.nombre || 'Sin proveedor'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{orden.creador?.nombre}</div>
                          <div className="text-xs text-gray-500">{orden.creador?.rol}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">
                            ${parseFloat(orden.total_estimado || 0).toFixed(2)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getEstadoBadge(orden.estado)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(orden.created_at).toLocaleDateString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleVerDetalle(orden)}
                            className="text-red-700 hover:text-red-900 mr-3"
                            title="Ver detalle"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => generarPDFOrden(orden)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-lg transition-colors text-sm"
                            title="Descargar PDF"
                          >
                            <Download size={16} />
                            PDF
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Vista de Solicitudes */}
      {vistaActual === 'solicitudes' && (
        <>
          {/* Barra de filtros para solicitudes */}
          <div className="mb-6 bg-white rounded-lg shadow p-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              {/* Búsqueda */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Buscar por ticket, artículo, categoría, solicitante..."
                  value={searchSolicitudes}
                  onChange={(e) => setSearchSolicitudes(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                />
              </div>

              {/* Filtro por prioridad */}
              <select
                value={filterPrioridad}
                onChange={(e) => setFilterPrioridad(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
              >
                <option value="">Todas las prioridades</option>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>

              {/* Filtro por categoría */}
              <select
                value={filterCategoria}
                onChange={(e) => setFilterCategoria(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
              >
                <option value="">Todas las categorías</option>
                {categoriasUnicas.map(categoria => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nombre}
                  </option>
                ))}
              </select>

              {/* Botón para limpiar filtros */}
              {(searchSolicitudes || filterPrioridad || filterCategoria) && (
                <button
                  onClick={() => {
                    setSearchSolicitudes('');
                    setFilterPrioridad('');
                    setFilterCategoria('');
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Limpiar filtros
                </button>
              )}
            </div>

            {/* Contador de resultados */}
            <div className="mt-3 text-sm text-gray-600">
              {filteredSolicitudes.length !== solicitudes.length ? (
                <>
                  Mostrando {filteredSolicitudes.length} de {solicitudes.length} solicitudes
                </>
              ) : (
                <>
                  {solicitudes.length} solicitud{solicitudes.length !== 1 ? 'es' : ''} pendiente{solicitudes.length !== 1 ? 's' : ''}
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Artículo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cant. Solicitada
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock Actual
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prioridad
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Solicitante
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Motivo
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSolicitudes.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                        {solicitudes.length === 0 ? (
                          <>
                            <CheckCircle size={48} className="mx-auto mb-2 text-green-300" />
                            <p>No hay solicitudes pendientes</p>
                          </>
                        ) : (
                          <>
                            <Search size={48} className="mx-auto mb-2 text-gray-300" />
                            <p>No se encontraron solicitudes con los filtros aplicados</p>
                            <button
                              onClick={() => {
                                setSearchSolicitudes('');
                                setFilterPrioridad('');
                                setFilterCategoria('');
                              }}
                              className="mt-2 text-red-700 hover:text-red-900 text-sm underline"
                            >
                              Limpiar filtros
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredSolicitudes.map((solicitud) => (
                      <tr
                        key={solicitud.id}
                        onClick={() => handleClickSolicitud(solicitud)}
                        className="hover:bg-red-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {solicitud.articulo?.nombre}
                          </div>
                          <div className="text-xs text-gray-500">
                            {solicitud.articulo?.categoria?.nombre}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={cantidadesSolicitudesEditadas[solicitud.id] ?? parseFloat(solicitud.cantidad_solicitada)}
                              onChange={(e) => handleCantidadSolicitudChange(solicitud.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500 text-center"
                            />
                            <span className="text-sm text-gray-600">{solicitud.articulo?.unidad}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">
                            {parseFloat(solicitud.articulo?.stock_actual || 0).toFixed(0)} {solicitud.articulo?.unidad}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getPrioridadBadge(solicitud.prioridad)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{solicitud.solicitante?.nombre}</div>
                          <div className="text-xs text-gray-500">{solicitud.solicitante?.rol}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600 max-w-md">
                            {solicitud.motivo}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal Nueva Orden */}
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

      {/* Modal Detalle */}
      {modalDetalle && ordenSeleccionada && (
        <ModalDetalleOrden
          isOpen={modalDetalle}
          orden={ordenSeleccionada}
          onClose={() => {
            setModalDetalle(false);
            setOrdenSeleccionada(null);
          }}
          onActualizarEstado={handleActualizarEstado}
          puedeAnularOrdenes={puedeAnularOrdenes}
          onAbrirModalAnular={handleAbrirModalAnular}
        />
      )}

      {/* Modal Crear Orden desde Solicitudes Seleccionadas */}
      {modalCrearDesdeSeleccion && (
        <ModalCrearOrdenDesdeSolicitudes
          isOpen={modalCrearDesdeSeleccion}
          solicitudes={solicitudes.filter(s => solicitudesSeleccionadas.includes(s.id))}
          cantidadesIniciales={cantidadesSolicitudesEditadas}
          onClose={() => setModalCrearDesdeSeleccion(false)}
          onSuccess={() => {
            setModalCrearDesdeSeleccion(false);
            setSolicitudesSeleccionadas([]);
            fetchData();
          }}
        />
      )}

      {/* Modal Anular Orden de Compra */}
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
    </div>
  );
};

// Modal para crear nueva orden
const ModalNuevaOrden = ({ isOpen, onClose, onSuccess, esDiseñador }) => {
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
        fecha_llegada_estimada: fechaLlegadaEstimada || undefined
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nueva Orden de Compra">
      <form onSubmit={handleSubmit} className="space-y-4">
        {esDiseñador && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-800">
              💡 <strong>Modo Diseñador:</strong> Puedes crear órdenes aunque no haya stock suficiente.
              Se generarán solicitudes de compra automáticas para los artículos faltantes.
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Proveedor (Opcional)
          </label>
          <select
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
          >
            <option value="">Seleccionar proveedor...</option>
            {proveedores.map(proveedor => (
              <option key={proveedor.id} value={proveedor.id}>
                {proveedor.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Buscar y agregar artículos
          </label>

          {/* Buscador de artículos */}
          <div className="relative mb-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar por nombre, código EAN-13 o categoría..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setMostrarCatalogo(e.target.value.length > 0);
                  }}
                  onFocus={() => setMostrarCatalogo(searchTerm.length > 0)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setMostrarCatalogo(!mostrarCatalogo);
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <Package size={18} />
                {mostrarCatalogo && !searchTerm ? 'Ocultar' : 'Ver todos'}
              </button>
              <button
                type="button"
                onClick={() => setMostrarModalNuevoArticulo(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                title="Crear nuevo artículo"
              >
                <PlusCircle size={18} />
                Nuevo
              </button>
            </div>

            {/* Catálogo desplegable */}
            {mostrarCatalogo && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                {/* Contador de resultados */}
                {articulosFiltrados.length > 0 && (
                  <div className="sticky top-0 bg-gray-50 px-4 py-2 border-b border-gray-200 text-sm text-gray-600">
                    {searchTerm
                      ? `${articulosFiltrados.length} resultado${articulosFiltrados.length !== 1 ? 's' : ''} encontrado${articulosFiltrados.length !== 1 ? 's' : ''}`
                      : `${articulos.length} artículo${articulos.length !== 1 ? 's' : ''} disponible${articulos.length !== 1 ? 's' : ''}`
                    }
                  </div>
                )}

                {articulosFiltrados.length > 0 ? (
                  searchTerm ? (
                    // Vista de búsqueda: lista plana
                    articulosFiltrados.map((articulo) => {
                      const yaSeleccionado = articulosSeleccionados.find(item => item.articulo_id === articulo.id);

                      return (
                        <button
                          key={articulo.id}
                          type="button"
                          onClick={() => handleSeleccionarArticulo(articulo)}
                          disabled={yaSeleccionado}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                            yaSeleccionado ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{articulo.nombre}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-gray-500">
                                  {articulo.codigo_ean13 || 'Sin código'}
                                </span>
                                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                                  {articulo.categoria?.nombre || 'Sin categoría'}
                                </span>
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <p className="text-sm font-semibold text-gray-900">
                                ${parseFloat(articulo.costo_unitario || 0).toFixed(2)}
                              </p>
                              <p className={`text-xs ${
                                parseFloat(articulo.stock_actual) > parseFloat(articulo.stock_minimo)
                                  ? 'text-green-600'
                                  : 'text-orange-600'
                              }`}>
                                Stock: {articulo.stock_actual} {articulo.unidad}
                              </p>
                            </div>
                          </div>
                          {yaSeleccionado && (
                            <p className="text-xs text-gray-500 mt-1">✓ Ya agregado</p>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    // Vista "Ver todos": agrupado por categorías
                    Object.entries(articulosPorCategoria).map(([categoria, articulosCategoria]) => (
                      <div key={categoria}>
                        <div className="sticky top-10 bg-gray-100 px-4 py-2 border-b border-gray-200">
                          <h4 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
                            <Package size={14} />
                            {categoria} ({articulosCategoria.length})
                          </h4>
                        </div>
                        {articulosCategoria.map((articulo) => {
                          const yaSeleccionado = articulosSeleccionados.find(item => item.articulo_id === articulo.id);

                          return (
                            <button
                              key={articulo.id}
                              type="button"
                              onClick={() => handleSeleccionarArticulo(articulo)}
                              disabled={yaSeleccionado}
                              className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                                yaSeleccionado ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">{articulo.nombre}</p>
                                  <div className="flex items-center gap-3 mt-1">
                                    <span className="text-xs text-gray-500">
                                      {articulo.codigo_ean13 || 'Sin código'}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right ml-4">
                                  <p className="text-sm font-semibold text-gray-900">
                                    ${parseFloat(articulo.costo_unitario || 0).toFixed(2)}
                                  </p>
                                  <p className={`text-xs ${
                                    parseFloat(articulo.stock_actual) > parseFloat(articulo.stock_minimo)
                                      ? 'text-green-600'
                                      : 'text-orange-600'
                                  }`}>
                                    Stock: {articulo.stock_actual} {articulo.unidad}
                                  </p>
                                </div>
                              </div>
                              {yaSeleccionado && (
                                <p className="text-xs text-gray-500 mt-1">✓ Ya agregado</p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))
                  )
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    <p className="text-sm">No se encontraron artículos</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Lista de artículos seleccionados */}
          {articulosSeleccionados.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Artículos en la orden ({articulosSeleccionados.length})
              </h4>
              {articulosSeleccionados.map((item, index) => {
                const stockInsuficiente = parseFloat(item.cantidad) > parseFloat(item.articulo.stock_actual);
                const subtotal = parseFloat(item.cantidad) * parseFloat(item.costo_unitario || 0);

                return (
                  <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium text-gray-900">{item.articulo.nombre}</p>
                            <p className="text-xs text-gray-500">
                              {item.articulo.codigo_ean13 || 'Sin código'} • Stock: {item.articulo.stock_actual} {item.articulo.unidad}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoverArticulo(index)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Eliminar"
                          >
                            <XCircle size={18} />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Cantidad</label>
                            <input
                              type="number"
                              value={item.cantidad}
                              onChange={(e) => handleCantidadChange(index, e.target.value)}
                              className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-red-700 ${
                                stockInsuficiente ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
                              }`}
                              min="0.01"
                              step="0.01"
                              required
                            />
                            {stockInsuficiente && (
                              <p className="text-xs text-blue-600 mt-1">
                                ℹ️ Cantidad mayor al stock actual
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Costo Unitario</label>
                            <input
                              type="number"
                              value={item.costo_unitario}
                              onChange={(e) => handleCostoChange(index, e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-700"
                              min="0"
                              step="0.01"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Subtotal</label>
                            <div className="w-full px-2 py-1 text-sm bg-gray-100 border border-gray-300 rounded font-semibold">
                              ${subtotal.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Total */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Total Estimado:</span>
                  <span className="text-xl font-bold text-red-700">
                    ${calcularTotal().toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {articulosSeleccionados.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Package size={48} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Busca y selecciona artículos para agregar a la orden</p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha de Llegada Estimada
          </label>
          <input
            type="date"
            value={fechaLlegadaEstimada}
            onChange={(e) => setFechaLlegadaEstimada(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            placeholder="Seleccionar fecha..."
          />
          <p className="text-xs text-gray-500 mt-1">
            Se enviarán notificaciones cuando la fecha se cumpla sin haber recibido la orden
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Observaciones
          </label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            rows="3"
            placeholder="Notas adicionales sobre esta orden..."
          />
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <Button
            type="button"
            onClick={onClose}
            variant="secondary"
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading || articulosSeleccionados.length === 0}
          >
            {loading ? 'Creando...' : 'Crear Orden'}
          </Button>
        </div>
      </form>

      {/* Modal para crear nuevo artículo */}
      {mostrarModalNuevoArticulo && (
        <ModalNuevoArticulo
          isOpen={mostrarModalNuevoArticulo}
          onClose={() => setMostrarModalNuevoArticulo(false)}
          categorias={categorias}
          ubicaciones={ubicaciones}
          proveedores={proveedores}
          onSuccess={(nuevoArticulo) => {
            setArticulos([...articulos, nuevoArticulo]);
            setMostrarModalNuevoArticulo(false);
            // Agregar automáticamente el nuevo artículo a la orden
            handleSeleccionarArticulo(nuevoArticulo);
            toast.success('Artículo creado y agregado a la orden');
          }}
        />
      )}
    </Modal>
  );
};

// Modal para ver detalle de orden con trazabilidad
const ModalDetalleOrden = ({ isOpen, orden, onClose, onActualizarEstado, puedeAnularOrdenes, onAbrirModalAnular }) => {
  const [tabActual, setTabActual] = React.useState('detalle'); // 'detalle' o 'historial'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Orden ${orden.ticket_id}`} size="xl">
      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <div className="flex gap-4">
          <button
            onClick={() => setTabActual('detalle')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              tabActual === 'detalle'
                ? 'border-red-700 text-red-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Detalle de la Orden
          </button>
          <button
            onClick={() => setTabActual('historial')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              tabActual === 'historial'
                ? 'border-red-700 text-red-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Historial de Trazabilidad
          </button>
        </div>
      </div>

      {/* Contenido de tabs */}
      {tabActual === 'detalle' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Estado</p>
              <p className="font-medium">
                {orden.estado === 'borrador' && 'Borrador'}
                {orden.estado === 'enviada' && 'Enviada'}
                {orden.estado === 'parcial' && 'Parcial'}
                {orden.estado === 'recibida' && 'Recibida'}
                {orden.estado === 'cancelada' && 'Cancelada'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Estimado</p>
              <p className="font-medium">${parseFloat(orden.total_estimado || 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Proveedor</p>
              <p className="font-medium">{orden.proveedor?.nombre || 'Sin proveedor'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Creado por</p>
              <p className="font-medium">{orden.creador?.nombre}</p>
            </div>
          </div>

          {orden.observaciones && (
            <div>
              <p className="text-sm text-gray-500 mb-1">Observaciones</p>
              <p className="text-sm text-gray-700">{orden.observaciones}</p>
            </div>
          )}

          <div className="mt-4">
            <h3 className="font-semibold mb-3">Artículos</h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Artículo</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Cantidad</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Costo Unit.</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orden.detalles?.map((detalle) => (
                    <tr key={detalle.id}>
                      <td className="px-4 py-2 text-sm">{detalle.articulo?.nombre}</td>
                      <td className="px-4 py-2 text-sm">
                        {parseFloat(detalle.cantidad_solicitada).toFixed(2)} {detalle.articulo?.unidad}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        ${parseFloat(detalle.costo_unitario || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-sm font-medium">
                        ${parseFloat(detalle.subtotal || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {orden.solicitudes_origen && orden.solicitudes_origen.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <h4 className="font-semibold text-orange-900 mb-2 text-sm">
                ⚠️ Solicitudes generadas automáticamente
              </h4>
              <ul className="text-sm text-orange-800 space-y-1">
                {orden.solicitudes_origen.map((sol) => (
                  <li key={sol.id}>
                    • {sol.ticket_id}: {sol.articulo?.nombre} - {parseFloat(sol.cantidad_solicitada).toFixed(0)} {sol.articulo?.unidad}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 justify-end mt-6">
            {puedeAnularOrdenes && orden.estado !== 'cancelada' && (
              <Button
                onClick={() => onAbrirModalAnular(orden)}
                variant="danger"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <RotateCcw size={16} />
                Anular Orden
              </Button>
            )}
            <Button onClick={onClose} variant="secondary">
              Cerrar
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <TimelineHistorial ordenId={orden.id} />

          <div className="flex gap-3 justify-end mt-6">
            {puedeAnularOrdenes && orden.estado !== 'cancelada' && (
              <Button
                onClick={() => onAbrirModalAnular(orden)}
                variant="danger"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <RotateCcw size={16} />
                Anular Orden
              </Button>
            )}
            <Button onClick={onClose} variant="secondary">
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

// Modal para crear orden desde solicitudes seleccionadas
const ModalCrearOrdenDesdeSolicitudes = ({ isOpen, solicitudes, cantidadesIniciales = {}, onClose, onSuccess }) => {
  const [proveedores, setProveedores] = useState([]);
  const [proveedorId, setProveedorId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);
  const [cantidadesEditadas, setCantidadesEditadas] = useState({});
  const [articulosEliminados, setArticulosEliminados] = useState(new Set());

  useEffect(() => {
    fetchProveedores();
  }, []);

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

    // Obtener los proveedores preferidos de todos los artículos
    const proveedoresPreferidos = solicitudes
      .map(s => s.articulo?.proveedor?.id)
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
    return articulosAgrupados.reduce((total, item) => {
      const cantidad = cantidadesEditadas[item.articulo?.id] || item.cantidad_total;
      const costo = parseFloat(item.articulo?.costo_unitario || 0);
      return total + (cantidad * costo);
    }, 0);
  };

  const handleCantidadChange = (articuloId, nuevaCantidad) => {
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
      toast.error('Debes tener al menos un artículo en la orden');
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

      await ordenesCompraService.crearOrdenDesdeSolicitudes(
        solicitudes_ids,
        proveedorId ? parseInt(proveedorId) : null,
        observaciones.trim() || null,
        huboEdiciones ? cantidades_custom : null
      );

      toast.success(`Orden creada exitosamente con ${solicitudesValidas.length} solicitud(es)`);
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crear Orden desde Solicitudes">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Información de solicitudes */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">
            📋 Resumen de Solicitudes Seleccionadas
          </h3>
          <p className="text-sm text-blue-800">
            {solicitudes.length} solicitud{solicitudes.length !== 1 ? 'es' : ''} • {articulosAgrupados.length} artículo{articulosAgrupados.length !== 1 ? 's' : ''} único{articulosAgrupados.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Selección de proveedor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Proveedor (Opcional)
          </label>
          <select
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
          >
            <option value="">Seleccionar proveedor...</option>
            {proveedores.map(proveedor => (
              <option key={proveedor.id} value={proveedor.id}>
                {proveedor.nombre}
              </option>
            ))}
          </select>

          {/* Mensaje informativo si hay proveedor seleccionado automáticamente */}
          {proveedorId && (() => {
            const proveedoresPreferidos = solicitudes
              .map(s => s.articulo?.proveedor?.id)
              .filter(id => id !== null && id !== undefined);

            const todosTienenMismoProveedor = proveedoresPreferidos.length > 0 &&
              proveedoresPreferidos.every(id => id === proveedoresPreferidos[0]);

            if (todosTienenMismoProveedor && proveedoresPreferidos[0].toString() === proveedorId) {
              const nombreProveedor = proveedores.find(p => p.id.toString() === proveedorId)?.nombre;
              return (
                <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle size={12} />
                  Proveedor preferido de {solicitudes.length === 1 ? 'este artículo' : 'estos artículos'}: {nombreProveedor}
                </p>
              );
            }
            return null;
          })()}
        </div>

        {/* Lista de artículos */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Artículos en la orden:
          </h4>
          {articulosAgrupados.length === 0 ? (
            <div className="border border-gray-200 rounded-lg p-8 text-center">
              <Package className="mx-auto text-gray-400 mb-2" size={48} />
              <p className="text-gray-600 font-medium">No hay artículos en esta orden</p>
              <p className="text-sm text-gray-500 mt-1">
                Todos los artículos han sido eliminados
              </p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Artículo</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Cantidad</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Costo Unit.</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Subtotal</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {articulosAgrupados.map((item, index) => {
                  const costo = parseFloat(item.articulo?.costo_unitario || 0);
                  const cantidadActual = cantidadesEditadas[item.articulo?.id] || item.cantidad_total;
                  const subtotal = cantidadActual * costo;

                  return (
                    <tr key={index}>
                      <td className="px-4 py-2 text-sm">
                        <div className="font-medium text-gray-900">{item.articulo?.nombre}</div>
                        <div className="text-xs text-gray-500">
                          {item.solicitudes.length > 1 && `${item.solicitudes.length} solicitudes`}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={cantidadActual}
                            onChange={(e) => handleCantidadChange(item.articulo?.id, e.target.value)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500 text-center"
                          />
                          <span className="text-gray-600">{item.articulo?.unidad}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        ${costo.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-sm font-medium">
                        ${subtotal.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <button
                          type="button"
                          onClick={() => handleEliminarArticulo(item.articulo?.id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1 rounded transition-colors"
                          title="Eliminar artículo de la orden"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>

        {/* Total */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-900">Total Estimado:</span>
            <span className="text-xl font-bold text-red-700">
              ${calcularTotal().toFixed(2)}
            </span>
          </div>
        </div>

        {/* Observaciones */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Observaciones
          </label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            rows="3"
            placeholder="Notas adicionales sobre esta orden..."
          />
        </div>

        {/* Botones */}
        <div className="flex gap-3 justify-end mt-6">
          <Button
            type="button"
            onClick={onClose}
            variant="secondary"
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading || articulosAgrupados.length === 0}
          >
            {loading ? 'Creando Orden...' : 'Crear Orden de Compra'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// Modal para crear nuevo artículo desde la orden de compra
const ModalNuevoArticulo = ({ isOpen, onClose, categorias, ubicaciones, proveedores, onSuccess }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    categoria_id: '',
    ubicacion_id: '',
    proveedor_id: '',
    stock_actual: 0,
    stock_minimo: 1,
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
        stock_minimo: parseFloat(formData.stock_minimo) || 1,
        stock_maximo: formData.stock_maximo ? parseFloat(formData.stock_maximo) : null,
        unidad: formData.unidad,
        costo_unitario: formData.costo_unitario ? parseFloat(formData.costo_unitario) : null,
        activo: true
      };

      const response = await articulosService.crear(dataToSend);
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
        stock_minimo: 1,
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crear Nuevo Artículo">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-800">
            💡 <strong>Nuevo Artículo:</strong> El artículo se creará con stock en 0 y se agregará automáticamente a la orden de compra.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nombre - Obligatorio */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Artículo <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
              placeholder="Ej: Tornillo hexagonal 1/4"
            />
          </div>

          {/* Descripción */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              rows="2"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
              placeholder="Descripción del artículo..."
            />
          </div>

          {/* Categoría - Obligatorio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría <span className="text-red-600">*</span>
            </label>
            <select
              name="categoria_id"
              value={formData.categoria_id}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            >
              <option value="">Seleccionar categoría...</option>
              {categorias.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
              ))}
            </select>
          </div>

          {/* Ubicación - Obligatorio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ubicación <span className="text-red-600">*</span>
            </label>
            <select
              name="ubicacion_id"
              value={formData.ubicacion_id}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            >
              <option value="">Seleccionar ubicación...</option>
              {ubicaciones.map(ub => (
                <option key={ub.id} value={ub.id}>
                  {ub.codigo} - {ub.almacen}
                </option>
              ))}
            </select>
          </div>

          {/* Proveedor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proveedor
            </label>
            {!modoNuevoProveedor ? (
              <select
                name="proveedor_id"
                value={formData.proveedor_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
              >
                <option value="">Sin proveedor</option>
                <option value="nuevo" className="font-semibold text-green-600">
                  ➕ Crear nuevo proveedor...
                </option>
                {proveedoresList.map(prov => (
                  <option key={prov.id} value={prov.id}>{prov.nombre}</option>
                ))}
              </select>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nuevoProveedorNombre}
                  onChange={(e) => setNuevoProveedorNombre(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCrearProveedorRapido();
                    }
                  }}
                  placeholder="Nombre del proveedor..."
                  className="flex-1 px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCrearProveedorRapido}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  title="Crear proveedor"
                >
                  ✓
                </button>
                <button
                  type="button"
                  onClick={handleCancelarNuevoProveedor}
                  className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
                  title="Cancelar"
                >
                  ✕
                </button>
              </div>
            )}
            {modoNuevoProveedor && (
              <p className="text-xs text-gray-500 mt-1">
                💡 Presiona Enter o click en ✓ para crear
              </p>
            )}
          </div>

          {/* Unidad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unidad de Medida
            </label>
            <select
              name="unidad"
              value={formData.unidad}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            >
              <option value="piezas">Piezas</option>
              <option value="metros">Metros</option>
              <option value="litros">Litros</option>
              <option value="kilogramos">Kilogramos</option>
              <option value="cajas">Cajas</option>
              <option value="rollos">Rollos</option>
              <option value="bolsas">Bolsas</option>
              <option value="unidades">Unidades</option>
            </select>
          </div>

          {/* Stock Mínimo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stock Mínimo
            </label>
            <input
              type="number"
              name="stock_minimo"
              value={formData.stock_minimo}
              onChange={handleChange}
              min="1"
              step="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
            />
          </div>

          {/* Stock Máximo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stock Máximo
            </label>
            <input
              type="number"
              name="stock_maximo"
              value={formData.stock_maximo}
              onChange={handleChange}
              min="1"
              step="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
              placeholder="Opcional"
            />
          </div>

          {/* Costo Unitario */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Costo Unitario
            </label>
            <input
              type="number"
              name="costo_unitario"
              value={formData.costo_unitario}
              onChange={handleChange}
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-200">
          <Button
            type="button"
            onClick={onClose}
            variant="secondary"
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? 'Creando...' : 'Crear y Agregar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default OrdenesCompraPage;
