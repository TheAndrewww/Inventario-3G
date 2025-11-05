import React, { useState, useEffect } from 'react';
import { Search, Plus, Package, Eye, Barcode, QrCode, Trash2, PackagePlus, PackageMinus, ArrowUpDown } from 'lucide-react';
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
  const [ordenamiento, setOrdenamiento] = useState('nombre-asc');
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
  const [modalSalidaOpen, setModalSalidaOpen] = useState(false);
  const [articuloParaSalida, setArticuloParaSalida] = useState(null);
  const [cantidadSalida, setCantidadSalida] = useState('');
  const [observacionesSalida, setObservacionesSalida] = useState('');
  const [loadingSalida, setLoadingSalida] = useState(false);
  const { agregarArticulo } = usePedido();
  const { user } = useAuth();

  // Verificar permisos según el rol
  const puedeCrearArticulos = ['administrador', 'encargado', 'almacen'].includes(user?.rol);
  const puedeAgregarAlPedido = ['administrador', 'diseñador'].includes(user?.rol);
  const puedeGestionarInventario = ['administrador', 'encargado', 'almacen'].includes(user?.rol);
  const esAdministrador = user?.rol === 'administrador';

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

      return matchesActiveFilter && matchesSearch && matchesCategoria;
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artículo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicación</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Costo Unit.</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
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

                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleVerDetalle(item)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
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
                          {esAdministrador && (
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

                    return (
                      <tr
                        key={item.id}
                        onClick={() => handleVerDetalle(item)}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                      >
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
                            {esAdministrador && (
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
                </>
              )}

              {/* Mensaje si no hay artículos */}
              {filteredArticulos.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
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

                return (
                  <div
                    key={`consumible-${item.id}`}
                    onClick={() => handleVerDetalle(item)}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
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
                      {esAdministrador && (
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

                return (
                  <div
                    key={`herramienta-${item.id}`}
                    onClick={() => handleVerDetalle(item)}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
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
                      {esAdministrador && (
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
    </div>
  );
};

export default InventarioPage;
