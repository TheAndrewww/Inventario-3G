import React, { useState, useEffect } from 'react';
import { Search, Plus, Package, ShoppingCart, Eye, Send, CheckCircle, XCircle, AlertCircle, Camera, Download, FileText, PlusCircle } from 'lucide-react';
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

const OrdenesCompraPage = () => {
  const [ordenes, setOrdenes] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [vistaActual, setVistaActual] = useState('ordenes'); // 'ordenes' o 'solicitudes'
  const [modalNuevaOrden, setModalNuevaOrden] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [solicitudesSeleccionadas, setSolicitudesSeleccionadas] = useState([]);
  const [modalCrearDesdeSeleccion, setModalCrearDesdeSeleccion] = useState(false);
  const [filterPrioridad, setFilterPrioridad] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [searchSolicitudes, setSearchSolicitudes] = useState('');
  const [estadisticas, setEstadisticas] = useState(null);
  const { user } = useAuth();

  // Verificar permisos
  const puedeCrearOrdenes = ['administrador', 'diseñador', 'almacen', 'compras'].includes(user?.rol);
  const esDiseñador = user?.rol === 'diseñador';

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

  const handleToggleSolicitud = (solicitudId) => {
    setSolicitudesSeleccionadas(prev => {
      if (prev.includes(solicitudId)) {
        return prev.filter(id => id !== solicitudId);
      } else {
        return [...prev, solicitudId];
      }
    });
  };

  const handleToggleTodas = () => {
    if (filteredSolicitudes.length === 0) return;

    // Si todas las solicitudes filtradas están seleccionadas, deseleccionar todas
    const todasSeleccionadas = filteredSolicitudes.every(s => solicitudesSeleccionadas.includes(s.id));

    if (todasSeleccionadas) {
      // Remover las IDs de las solicitudes filtradas de la selección
      const idsARemover = filteredSolicitudes.map(s => s.id);
      setSolicitudesSeleccionadas(prev => prev.filter(id => !idsARemover.includes(id)));
    } else {
      // Agregar todas las IDs de las solicitudes filtradas que no estén ya seleccionadas
      const nuevasIds = filteredSolicitudes.map(s => s.id);
      setSolicitudesSeleccionadas(prev => {
        const set = new Set([...prev, ...nuevasIds]);
        return Array.from(set);
      });
    }
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

  const generarPDFOrden = async (orden) => {
    try {
      // Obtener detalle completo de la orden
      const data = await ordenesCompraService.obtenerOrden(orden.id);
      const ordenCompleta = data.data?.orden;

      const doc = new jsPDF();

      // Encabezado
      doc.setFontSize(20);
      doc.setTextColor(220, 38, 38);
      doc.text('INVENTARIO 3G', 105, 20, { align: 'center' });

      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('Orden de Compra', 105, 30, { align: 'center' });

      // Línea separadora
      doc.setDrawColor(220, 38, 38);
      doc.setLineWidth(0.5);
      doc.line(20, 35, 190, 35);

      // Información de la orden
      doc.setFontSize(11);
      let yPos = 45;

      doc.setFont(undefined, 'bold');
      doc.text('Ticket ID:', 20, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(ordenCompleta.ticket_id || 'N/A', 60, yPos);

      yPos += 8;
      doc.setFont(undefined, 'bold');
      doc.text('Proveedor:', 20, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(ordenCompleta.proveedor?.nombre || 'Sin proveedor', 60, yPos);

      yPos += 8;
      doc.setFont(undefined, 'bold');
      doc.text('Estado:', 20, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(ordenCompleta.estado || 'N/A', 60, yPos);

      yPos += 8;
      doc.setFont(undefined, 'bold');
      doc.text('Creado por:', 20, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(ordenCompleta.creador?.nombre || 'N/A', 60, yPos);

      yPos += 8;
      doc.setFont(undefined, 'bold');
      doc.text('Fecha Creación:', 20, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(
        new Date(ordenCompleta.created_at).toLocaleDateString('es-MX', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        60,
        yPos
      );

      if (ordenCompleta.fecha_llegada_estimada) {
        yPos += 8;
        doc.setFont(undefined, 'bold');
        doc.text('Llegada Estimada:', 20, yPos);
        doc.setFont(undefined, 'normal');
        doc.text(
          new Date(ordenCompleta.fecha_llegada_estimada).toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          60,
          yPos
        );
      }

      yPos += 8;
      doc.setFont(undefined, 'bold');
      doc.text('Total Estimado:', 20, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(
        `$${parseFloat(ordenCompleta.total_estimado || 0).toLocaleString('es-MX', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}`,
        60,
        yPos
      );

      // Información del proveedor si existe
      if (ordenCompleta.proveedor) {
        yPos += 12;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(12);
        doc.text('Información del Proveedor:', 20, yPos);

        yPos += 8;
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');

        if (ordenCompleta.proveedor.telefono) {
          doc.text(`Tel: ${ordenCompleta.proveedor.telefono}`, 20, yPos);
          yPos += 6;
        }
        if (ordenCompleta.proveedor.email) {
          doc.text(`Email: ${ordenCompleta.proveedor.email}`, 20, yPos);
          yPos += 6;
        }
        if (ordenCompleta.proveedor.direccion) {
          const splitDireccion = doc.splitTextToSize(
            `Dirección: ${ordenCompleta.proveedor.direccion}`,
            170
          );
          doc.text(splitDireccion, 20, yPos);
          yPos += splitDireccion.length * 5;
        }
      }

      // Observaciones
      if (ordenCompleta.observaciones) {
        yPos += 10;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text('Observaciones:', 20, yPos);
        yPos += 6;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        const splitObs = doc.splitTextToSize(ordenCompleta.observaciones, 170);
        doc.text(splitObs, 20, yPos);
        yPos += splitObs.length * 5;
      }

      // Tabla de artículos
      yPos += 15;
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Artículos:', 20, yPos);

      yPos += 8;
      doc.setFontSize(10);

      // Encabezados de tabla
      doc.setFillColor(220, 38, 38);
      doc.rect(20, yPos - 5, 170, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text('Artículo', 22, yPos);
      doc.text('Cantidad', 120, yPos);
      doc.text('Costo Unit.', 145, yPos);
      doc.text('Subtotal', 170, yPos);

      doc.setTextColor(0, 0, 0);
      yPos += 8;

      // Filas de artículos
      ordenCompleta.detalles?.forEach((detalle, index) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }

        const bgColor = index % 2 === 0 ? 245 : 255;
        doc.setFillColor(bgColor, bgColor, bgColor);
        doc.rect(20, yPos - 5, 170, 7, 'F');

        const articuloText = doc.splitTextToSize(
          detalle.articulo?.nombre || `Artículo ID: ${detalle.articulo_id}`,
          90
        );
        doc.text(articuloText, 22, yPos);

        doc.text(
          `${detalle.cantidad_solicitada} ${detalle.articulo?.unidad || 'uds'}`,
          120,
          yPos
        );

        doc.text(
          `$${parseFloat(detalle.costo_unitario || 0).toFixed(2)}`,
          145,
          yPos
        );

        const subtotal = parseFloat(detalle.cantidad_solicitada) * parseFloat(detalle.costo_unitario || 0);
        doc.text(`$${subtotal.toFixed(2)}`, 170, yPos);

        yPos += Math.max(articuloText.length * 5, 7);
      });

      // Pie de página
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Generado el ${new Date().toLocaleDateString('es-MX')} a las ${new Date().toLocaleTimeString('es-MX')}`,
          105,
          285,
          { align: 'center' }
        );
        doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
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
                  {solicitudesSeleccionadas.length > 0 && (
                    <> • {solicitudesSeleccionadas.length} seleccionada{solicitudesSeleccionadas.length !== 1 ? 's' : ''}</>
                  )}
                </>
              ) : (
                <>
                  {solicitudes.length} solicitud{solicitudes.length !== 1 ? 'es' : ''} pendiente{solicitudes.length !== 1 ? 's' : ''}
                  {solicitudesSeleccionadas.length > 0 && (
                    <> • {solicitudesSeleccionadas.length} seleccionada{solicitudesSeleccionadas.length !== 1 ? 's' : ''}</>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={filteredSolicitudes.length > 0 && solicitudesSeleccionadas.length === filteredSolicitudes.length}
                        onChange={handleToggleTodas}
                        className="w-4 h-4 text-red-700 border-gray-300 rounded focus:ring-red-700"
                        title="Seleccionar todos los resultados filtrados"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ticket
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Artículo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cantidad
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
                      <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
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
                        className={`hover:bg-gray-50 ${solicitudesSeleccionadas.includes(solicitud.id) ? 'bg-red-50' : ''}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={solicitudesSeleccionadas.includes(solicitud.id)}
                            onChange={() => handleToggleSolicitud(solicitud.id)}
                            className="w-4 h-4 text-red-700 border-gray-300 rounded focus:ring-red-700"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{solicitud.ticket_id}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {solicitud.articulo?.nombre}
                          </div>
                          <div className="text-xs text-gray-500">
                            {solicitud.articulo?.categoria?.nombre}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {parseFloat(solicitud.cantidad_solicitada).toFixed(0)} {solicitud.articulo?.unidad}
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

          {/* Botón flotante para crear orden */}
          {solicitudesSeleccionadas.length > 0 && (
            <div className="fixed bottom-8 right-8 z-50">
              <button
                onClick={handleAbrirModalCrearDesdeSeleccion}
                className="bg-red-700 hover:bg-red-800 text-white px-6 py-4 rounded-full shadow-lg flex items-center gap-3 transition-all transform hover:scale-105"
              >
                <ShoppingCart size={24} />
                <span className="font-semibold">
                  Crear Orden con {solicitudesSeleccionadas.length} solicitud{solicitudesSeleccionadas.length !== 1 ? 'es' : ''}
                </span>
                <span className="bg-white text-red-700 px-3 py-1 rounded-full font-bold">
                  {solicitudesSeleccionadas.length}
                </span>
              </button>
            </div>
          )}
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
        />
      )}

      {/* Modal Crear Orden desde Solicitudes Seleccionadas */}
      {modalCrearDesdeSeleccion && (
        <ModalCrearOrdenDesdeSolicitudes
          isOpen={modalCrearDesdeSeleccion}
          solicitudes={solicitudes.filter(s => solicitudesSeleccionadas.includes(s.id))}
          onClose={() => setModalCrearDesdeSeleccion(false)}
          onSuccess={() => {
            setModalCrearDesdeSeleccion(false);
            setSolicitudesSeleccionadas([]);
            fetchData();
          }}
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
      const [artData, provData, catData, ubData] = await Promise.all([
        articulosService.getAll(),
        proveedoresService.listar(),
        categoriasService.listar(),
        ubicacionesService.listar()
      ]);

      // Procesar respuesta de artículos
      const articulosArray = Array.isArray(artData) ? artData : [];

      // Procesar respuesta de proveedores (puede venir en data.proveedores o directamente)
      const proveedoresArray = Array.isArray(provData)
        ? provData
        : (provData?.data?.proveedores || provData?.data || []);

      // Procesar respuesta de categorías
      const categoriasArray = Array.isArray(catData)
        ? catData
        : (catData?.data?.categorias || catData?.data || []);

      // Procesar respuesta de ubicaciones
      const ubicacionesArray = Array.isArray(ubData)
        ? ubData
        : (ubData?.data?.ubicaciones || ubData?.data || []);

      setArticulos(articulosArray);
      setProveedores(proveedoresArray);
      setCategorias(categoriasArray);
      setUbicaciones(ubicacionesArray);
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
                onClick={() => setMostrarScanner(!mostrarScanner)}
                className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg transition-colors flex items-center gap-2"
                title="Escanear código de barras"
              >
                <Camera size={18} />
                Scanner
              </button>
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

          {/* Scanner de códigos de barras */}
          {mostrarScanner && (
            <div className="mb-4 p-4 border-2 border-red-200 rounded-lg bg-red-50">
              <EAN13ScannerOrdenesCompra
                onArticuloEscaneado={handleArticuloEscaneado}
                onClose={() => setMostrarScanner(false)}
              />
            </div>
          )}

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
const ModalDetalleOrden = ({ isOpen, orden, onClose, onActualizarEstado }) => {
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
            <Button onClick={onClose} variant="secondary">
              Cerrar
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <TimelineHistorial ordenId={orden.id} />

          <div className="flex gap-3 justify-end mt-6">
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
const ModalCrearOrdenDesdeSolicitudes = ({ isOpen, solicitudes, onClose, onSuccess }) => {
  const [proveedores, setProveedores] = useState([]);
  const [proveedorId, setProveedorId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProveedores();
  }, []);

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
    return solicitudes.reduce((total, solicitud) => {
      const cantidad = parseFloat(solicitud.cantidad_solicitada);
      const costo = parseFloat(solicitud.articulo?.costo_unitario || 0);
      return total + (cantidad * costo);
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      const solicitudes_ids = solicitudes.map(s => s.id);

      await ordenesCompraService.crearOrdenDesdeSolicitudes(
        solicitudes_ids,
        proveedorId ? parseInt(proveedorId) : null,
        observaciones.trim() || null
      );

      toast.success(`Orden creada exitosamente con ${solicitudes.length} solicitud(es)`);
      onSuccess();
    } catch (error) {
      console.error('Error al crear orden:', error);
      toast.error(error.response?.data?.message || 'Error al crear la orden');
    } finally {
      setLoading(false);
    }
  };

  // Agrupar solicitudes por artículo (en caso de que haya duplicados)
  const articulosAgrupados = React.useMemo(() => {
    const mapa = new Map();
    solicitudes.forEach(solicitud => {
      const artId = solicitud.articulo?.id;
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
  }, [solicitudes]);

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
        </div>

        {/* Lista de artículos */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Artículos en la orden:
          </h4>
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Artículo</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Cantidad</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Costo Unit.</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Subtotal</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {articulosAgrupados.map((item, index) => {
                  const costo = parseFloat(item.articulo?.costo_unitario || 0);
                  const subtotal = item.cantidad_total * costo;

                  return (
                    <tr key={index}>
                      <td className="px-4 py-2 text-sm">
                        <div className="font-medium text-gray-900">{item.articulo?.nombre}</div>
                        <div className="text-xs text-gray-500">
                          {item.solicitudes.length > 1 && `${item.solicitudes.length} solicitudes`}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {item.cantidad_total.toFixed(0)} {item.articulo?.unidad}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        ${costo.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-sm font-medium">
                        ${subtotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
            disabled={loading}
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
