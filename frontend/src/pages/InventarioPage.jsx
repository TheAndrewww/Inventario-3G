import React, { useState, useEffect } from 'react';
import { Search, Plus, Package, Eye, Barcode, QrCode, Trash2, PackagePlus } from 'lucide-react';
import articulosService from '../services/articulos.service';
import movimientosService from '../services/movimientos.service';
import categoriasService from '../services/categorias.service';
import { Loader, Modal } from '../components/common';
import ArticuloDetalleModal from '../components/articulos/ArticuloDetalleModal';
import ArticuloFormModal from '../components/articulos/ArticuloFormModal';
import EAN13Scanner from '../components/scanner/EAN13Scanner';
import toast from 'react-hot-toast';
import { usePedido } from '../context/PedidoContext';
import { useAuth } from '../context/AuthContext';
import { getImageUrl } from '../utils/imageUtils';

const InventarioPage = () => {
  const [articulos, setArticulos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [mostrarCategorias, setMostrarCategorias] = useState(false);
  const [mostrarDesactivados, setMostrarDesactivados] = useState(false);
  const [articuloSeleccionado, setArticuloSeleccionado] = useState(null);
  const [articuloAEditar, setArticuloAEditar] = useState(null);
  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [modalFormOpen, setModalFormOpen] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [modalEntradaOpen, setModalEntradaOpen] = useState(false);
  const [articuloParaEntrada, setArticuloParaEntrada] = useState(null);
  const [cantidadEntrada, setCantidadEntrada] = useState('');
  const [observacionesEntrada, setObservacionesEntrada] = useState('');
  const [loadingEntrada, setLoadingEntrada] = useState(false);
  const { agregarArticulo } = usePedido();
  const { user } = useAuth();

  // Verificar permisos según el rol
  const puedeCrearArticulos = ['administrador', 'supervisor', 'almacen'].includes(user?.rol);
  const puedeAgregarAlPedido = ['administrador', 'diseñador'].includes(user?.rol);
  const puedeGestionarInventario = ['administrador', 'supervisor', 'almacen'].includes(user?.rol);

  useEffect(() => {
    fetchArticulos();
    fetchCategorias();
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

  const filteredArticulos = articulos.filter((item) => {
    // Filtrar por estado activo/desactivado
    const isActive = item.activo !== false;
    const matchesActiveFilter = mostrarDesactivados ? !isActive : isActive;

    const matchesSearch =
      item.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.codigo_ean13?.includes(searchTerm) ||
      item.categoria?.nombre?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategoria = !categoriaSeleccionada || item.categoria_id === categoriaSeleccionada;

    return matchesActiveFilter && matchesSearch && matchesCategoria;
  });

  const handleAgregarAlPedido = (articulo) => {
    agregarArticulo(articulo, 1);
    toast.success(`${articulo.nombre} agregado al pedido`);
  };

  const handleVerDetalle = (articulo) => {
    setArticuloSeleccionado(articulo);
    setModalDetalleOpen(true);
  };

  const handleNuevoArticulo = () => {
    setArticuloAEditar(null); // Limpiar artículo a editar
    setModalFormOpen(true);
  };

  const handleEditar = (articulo) => {
    setArticuloAEditar(articulo);
    setModalFormOpen(true);
  };

  const handleFormSuccess = () => {
    fetchArticulos(); // Recargar la lista
    setArticuloAEditar(null); // Limpiar artículo a editar
  };

  const handleCloseForm = () => {
    setModalFormOpen(false);
    setArticuloAEditar(null); // Limpiar artículo a editar
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

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <div className="p-4 md:p-6">
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
          <button
            onClick={() => setMostrarCategorias(!mostrarCategorias)}
            className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Package size={18} />
            <span className="hidden sm:inline">Categorías</span>
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
            <div className="flex items-center gap-2 mb-3">
              <Package size={18} className="text-gray-600" />
              <h3 className="font-medium text-gray-900">Filtrar por categoría</h3>
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
                <button
                  key={categoria.id}
                  onClick={() => setCategoriaSeleccionada(categoria.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    categoriaSeleccionada === categoria.id
                      ? 'bg-red-700 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {categoria.nombre}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sección de Herramientas */}
      {filteredArticulos.some(item => item.es_herramienta) && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4 md:mb-6">
          <div className="bg-orange-50 border-b border-orange-200 px-4 md:px-6 py-3">
            <h2 className="text-base md:text-lg font-semibold text-orange-900 flex items-center gap-2">
              🔧 Herramientas
              <span className="text-xs md:text-sm font-normal text-orange-700">
                ({filteredArticulos.filter(item => item.es_herramienta).length})
              </span>
            </h2>
          </div>

          {/* Vista Desktop: Tabla */}
          <div className="hidden md:block overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artículo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código EAN-13</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicación</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Costo Unit.</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredArticulos.filter(item => item.es_herramienta).map((item) => {
                  const imagenUrl = item.imagen_url
                    ? getImageUrl(item.imagen_url)
                    : null;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
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
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {item.codigo_ean13}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {item.categoria?.nombre || 'Sin categoría'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.ubicacion?.codigo || item.ubicacion?.nombre || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${parseFloat(item.stock_actual) <= parseFloat(item.stock_minimo) ? 'text-red-600' : 'text-gray-900'}`}>
                            {parseFloat(item.stock_actual).toFixed(0)} {item.unidad}
                          </span>
                          {parseFloat(item.stock_actual) <= parseFloat(item.stock_minimo) && (
                            <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">Bajo</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${parseFloat(item.costo_unitario || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleVerDetalle(item)}
                            className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
                            title="Ver detalles y código de barras"
                          >
                            <Barcode size={16} />
                            Ver
                          </button>
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
                          {puedeAgregarAlPedido && (
                            <button
                              onClick={() => handleAgregarAlPedido(item)}
                              className="inline-flex items-center gap-1 px-3 py-2 bg-red-700 text-white text-sm rounded-lg hover:bg-red-800"
                            >
                              <Plus size={16} />
                              Agregar
                            </button>
                          )}
                          {puedeCrearArticulos && (
                            mostrarDesactivados ? (
                              <button
                                onClick={() => handleReactivar(item)}
                                className="inline-flex items-center gap-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                                title="Reactivar artículo"
                              >
                                <Plus size={16} />
                                Reactivar
                              </button>
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
              </tbody>
            </table>
          </div>

          {/* Vista Móvil: Cards */}
          <div className="md:hidden divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {filteredArticulos.filter(item => item.es_herramienta).map((item) => {
              const imagenUrl = item.imagen_url
                ? getImageUrl(item.imagen_url)
                : null;

              return (
                <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
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
                        🔧
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{item.nombre}</h3>
                      <p className="text-xs text-gray-500 truncate mb-2">{item.descripcion}</p>

                      <div className="flex flex-wrap gap-2 text-xs mb-2">
                        <span className="inline-flex px-2 py-1 rounded-full bg-blue-100 text-blue-800 font-medium">
                          {item.categoria?.nombre || 'Sin categoría'}
                        </span>
                        <span className={`inline-flex px-2 py-1 rounded font-medium ${
                          parseFloat(item.stock_actual) <= parseFloat(item.stock_minimo)
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {parseFloat(item.stock_actual).toFixed(0)} {item.unidad}
                        </span>
                      </div>

                      <div className="text-xs text-gray-600 space-y-1">
                        <div className="font-mono">{item.codigo_ean13}</div>
                        <div>${parseFloat(item.costo_unitario || 0).toFixed(2)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleVerDetalle(item)}
                      className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200"
                    >
                      <Barcode size={14} />
                      Ver
                    </button>
                    {puedeGestionarInventario && (
                      <button
                        onClick={() => handleAbrirEntrada(item)}
                        className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700"
                      >
                        <PackagePlus size={14} />
                        Entrada
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
                    {puedeCrearArticulos && (
                      mostrarDesactivados ? (
                        <button
                          onClick={() => handleReactivar(item)}
                          className="flex-1 min-w-[100px] inline-flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700"
                        >
                          <Plus size={14} />
                          Reactivar
                        </button>
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
          </div>
        </div>
      )}

      {/* Sección de Consumibles */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="bg-blue-50 border-b border-blue-200 px-4 md:px-6 py-3">
          <h2 className="text-base md:text-lg font-semibold text-blue-900 flex items-center gap-2">
            📦 Consumibles
            <span className="text-xs md:text-sm font-normal text-blue-700">
              ({filteredArticulos.filter(item => !item.es_herramienta).length})
            </span>
          </h2>
        </div>

        {/* Vista Desktop: Tabla */}
        <div className="hidden md:block overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artículo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código EAN-13</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicación</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Costo Unit.</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredArticulos.filter(item => !item.es_herramienta).length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    No se encontraron artículos
                  </td>
                </tr>
              ) : (
                filteredArticulos.filter(item => !item.es_herramienta).map((item) => {
                  const imagenUrl = item.imagen_url
                    ? getImageUrl(item.imagen_url)
                    : null;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {item.codigo_ean13}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {item.categoria?.nombre || 'Sin categoría'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.ubicacion?.codigo || item.ubicacion?.nombre || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${parseFloat(item.stock_actual) <= parseFloat(item.stock_minimo) ? 'text-red-600' : 'text-gray-900'}`}>
                            {parseFloat(item.stock_actual).toFixed(0)} {item.unidad}
                          </span>
                          {parseFloat(item.stock_actual) <= parseFloat(item.stock_minimo) && (
                            <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">Bajo</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${parseFloat(item.costo_unitario || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleVerDetalle(item)}
                            className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
                            title="Ver detalles y código de barras"
                          >
                            <Barcode size={16} />
                            Ver
                          </button>
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
                          {puedeAgregarAlPedido && (
                            <button
                              onClick={() => handleAgregarAlPedido(item)}
                              className="inline-flex items-center gap-1 px-3 py-2 bg-red-700 text-white text-sm rounded-lg hover:bg-red-800"
                            >
                              <Plus size={16} />
                              Agregar
                            </button>
                          )}
                          {puedeCrearArticulos && (
                            mostrarDesactivados ? (
                              <button
                                onClick={() => handleReactivar(item)}
                                className="inline-flex items-center gap-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                                title="Reactivar artículo"
                              >
                                <Plus size={16} />
                                Reactivar
                              </button>
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
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Vista Móvil: Cards */}
        <div className="md:hidden space-y-3 max-h-[70vh] overflow-y-auto px-1">
          {filteredArticulos.filter(item => !item.es_herramienta).length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              No se encontraron artículos
            </div>
          ) : (
            filteredArticulos.filter(item => !item.es_herramienta).map((item) => {
              const imagenUrl = item.imagen_url
                ? getImageUrl(item.imagen_url)
                : null;

              return (
                <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 hover:shadow-md transition-shadow">
                  <div className="flex gap-3 mb-3">
                    {/* Imagen */}
                    {imagenUrl ? (
                      <img
                        src={imagenUrl}
                        alt={item.nombre}
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0 border border-gray-200"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-3xl flex-shrink-0 border border-gray-200">
                        📦
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2 leading-tight">
                        {item.nombre}
                      </h3>
                      <p className="text-xs text-gray-500 line-clamp-2 mb-2 leading-relaxed">
                        {item.descripcion}
                      </p>

                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium text-xs">
                          {item.categoria?.nombre || 'Sin categoría'}
                        </span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full font-medium text-xs ${
                          parseFloat(item.stock_actual) <= parseFloat(item.stock_minimo)
                            ? 'bg-red-100 text-red-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          Stock: {parseFloat(item.stock_actual).toFixed(0)} {item.unidad}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Detalles adicionales */}
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-3 pb-3 border-b border-gray-100">
                    <div className="font-mono bg-gray-50 px-2 py-1 rounded">
                      {item.codigo_ean13}
                    </div>
                    <div className="font-semibold text-gray-900">
                      ${parseFloat(item.costo_unitario || 0).toFixed(2)}
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleVerDetalle(item)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors"
                    >
                      <Barcode size={16} />
                      Ver
                    </button>
                    {puedeGestionarInventario && (
                      <button
                        onClick={() => handleAbrirEntrada(item)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors"
                      >
                        <PackagePlus size={16} />
                        Entrada
                      </button>
                    )}
                    {puedeAgregarAlPedido && (
                      <button
                        onClick={() => handleAgregarAlPedido(item)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-700 text-white text-sm font-medium rounded-lg hover:bg-red-800 active:bg-red-900 transition-colors"
                      >
                        <Plus size={16} />
                        Agregar
                      </button>
                    )}
                    {puedeCrearArticulos && (
                      mostrarDesactivados ? (
                        <button
                          onClick={() => handleReactivar(item)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors"
                        >
                          <Plus size={16} />
                          Reactivar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleEliminar(item)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal de detalles con código de barras */}
      <ArticuloDetalleModal
        articulo={articuloSeleccionado}
        isOpen={modalDetalleOpen}
        onClose={() => setModalDetalleOpen(false)}
        onEdit={handleEditar}
        canEdit={puedeCrearArticulos}
      />

      {/* Modal de formulario para crear/editar */}
      <ArticuloFormModal
        isOpen={modalFormOpen}
        onClose={handleCloseForm}
        onSuccess={handleFormSuccess}
        articulo={articuloAEditar}
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
    </div>
  );
};

export default InventarioPage;
