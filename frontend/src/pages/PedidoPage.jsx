import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, Package, Users, Truck, Search, Barcode } from 'lucide-react';
import { usePedido } from '../context/PedidoContext';
import { Button } from '../components/common';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import pedidosService from '../services/pedidos.service';
import equiposService from '../services/equipos.service';
import ubicacionesService from '../services/ubicaciones.service';
import articulosService from '../services/articulos.service';
import EAN13Scanner from '../components/scanner/EAN13Scanner';
import toast from 'react-hot-toast';

const PedidoPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    items,
    incrementar,
    decrementar,
    eliminarArticulo,
    actualizarCantidad,
    limpiarPedido,
    getTotalPiezas,
    getCostoTotal,
  } = usePedido();

  const [proyecto, setProyecto] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [equipos, setEquipos] = useState([]);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState('');
  const [cargandoEquipos, setCargandoEquipos] = useState(false);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [ubicacionDestino, setUbicacionDestino] = useState('');
  const [cargandoUbicaciones, setCargandoUbicaciones] = useState(false);

  // Estados para búsqueda rápida
  const [busqueda, setBusqueda] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const { agregarArticulo } = usePedido();

  // Cargar equipos si el usuario es almacenista
  useEffect(() => {
    const cargarEquipos = async () => {
      if (user?.rol === 'almacen') {
        try {
          setCargandoEquipos(true);
          const response = await equiposService.obtenerTodos();
          setEquipos(response.data.equipos || []);
        } catch (error) {
          console.error('Error al cargar equipos:', error);
          toast.error('Error al cargar equipos');
        } finally {
          setCargandoEquipos(false);
        }
      }
    };

    cargarEquipos();
  }, [user]);

  // Cargar ubicaciones (camionetas y stock general)
  useEffect(() => {
    const cargarUbicaciones = async () => {
      try {
        setCargandoUbicaciones(true);
        const ubicacionesData = await ubicacionesService.getAll();
        // Filtrar solo ubicaciones que son camionetas o stock general
        const ubicacionesCamionetas = ubicacionesData.filter(ub =>
          ub.almacen.includes('Camioneta') ||
          ub.almacen.includes('Stock General') ||
          ub.codigo.includes('NP300') ||
          ub.codigo.includes('TORNADO') ||
          ub.codigo.includes('SAVEIRO') ||
          ub.codigo.includes('STOCK-GEN')
        );
        setUbicaciones(ubicacionesCamionetas);
      } catch (error) {
        console.error('Error al cargar ubicaciones:', error);
        toast.error('Error al cargar ubicaciones de destino');
      } finally {
        setCargandoUbicaciones(false);
      }
    };

    cargarUbicaciones();
  }, []);

  const handleCantidadChange = (id, value) => {
    const cantidad = parseInt(value);
    if (isNaN(cantidad) || cantidad < 1) {
      return;
    }
    actualizarCantidad(id, cantidad);
  };

  const handleCantidadBlur = (id, value) => {
    const cantidad = parseInt(value);
    if (isNaN(cantidad) || cantidad < 1) {
      // Si el valor es inválido, resetear a 1
      actualizarCantidad(id, 1);
      toast.error('La cantidad debe ser al menos 1');
    }
  };

  const handleFinalizarPedido = async () => {
    if (items.length === 0) {
      toast.error('El pedido está vacío');
      return;
    }

    // Validaciones según el rol
    if (user?.rol === 'almacen') {
      // Almacenista debe seleccionar equipo
      if (!equipoSeleccionado) {
        toast.error('Debes seleccionar un equipo');
        return;
      }
    } else {
      // Diseñador/Admin debe especificar proyecto O ubicación destino
      if (!proyecto.trim() && !ubicacionDestino) {
        toast.error('Debes especificar un proyecto o seleccionar una ubicación destino');
        return;
      }
    }

    try {
      const articulosPedido = items.map((item) => ({
        articulo_id: item.id,
        cantidad: item.cantidad,
        observaciones: '',
      }));

      const data = {
        articulos: articulosPedido,
        observaciones: observaciones.trim() || `Pedido creado por ${user?.nombre || 'Usuario'}`,
      };

      // Agregar proyecto o equipo según el rol
      if (user?.rol === 'almacen') {
        data.equipo_id = parseInt(equipoSeleccionado);
      } else {
        // Si se seleccionó ubicación destino, no enviar proyecto
        if (ubicacionDestino) {
          data.ubicacion_destino_id = parseInt(ubicacionDestino);
          // Agregar proyecto solo si hay texto
          if (proyecto.trim()) {
            data.proyecto = proyecto.trim();
          }
        } else {
          // Si no hay ubicación destino, el proyecto es obligatorio
          data.proyecto = proyecto.trim();
        }
      }

      const response = await pedidosService.crear(data);

      if (user?.rol === 'almacen') {
        toast.success('¡Pedido creado! Esperando aprobación del supervisor');
      } else {
        toast.success('¡Pedido creado exitosamente!');
      }

      limpiarPedido();
      setProyecto('');
      setObservaciones('');
      setEquipoSeleccionado('');
      setUbicacionDestino('');

      navigate('/historial');
    } catch (error) {
      console.error('Error al crear pedido:', error);
      toast.error(error.response?.data?.message || error.message || 'Error al crear el pedido');
    }
  };

  // Buscar artículos por nombre o código
  const buscarArticulos = async (termino) => {
    if (!termino || termino.length < 2) {
      setResultadosBusqueda([]);
      return;
    }

    try {
      setBuscando(true);
      const articulos = await articulosService.getAll();

      // Filtrar artículos localmente por nombre o código
      const resultados = articulos.filter(art => {
        const nombreMatch = art.nombre?.toLowerCase().includes(termino.toLowerCase());
        const codigoMatch = art.codigo_ean13?.includes(termino);
        const activoMatch = art.activo !== false;
        return (nombreMatch || codigoMatch) && activoMatch;
      });

      setResultadosBusqueda(resultados);
    } catch (error) {
      console.error('Error al buscar artículos:', error);
      toast.error('Error al buscar artículos');
    } finally {
      setBuscando(false);
    }
  };

  // Debounce para la búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      buscarArticulos(busqueda);
    }, 300);

    return () => clearTimeout(timer);
  }, [busqueda]);

  // Buscar por código de barras
  const buscarPorCodigo = async (codigo) => {
    try {
      const response = await articulosService.getByEAN13(codigo);
      if (response && response.id) {
        agregarArticulo(response);
        toast.success(`✓ ${response.nombre} agregado`);
        setBusqueda('');
        setResultadosBusqueda([]);
        setShowScanner(false);
      }
    } catch (error) {
      console.error('Error al buscar por código:', error);
      toast.error('Artículo no encontrado');
    }
  };

  // Agregar artículo desde búsqueda
  const handleAgregarArticulo = (articulo) => {
    agregarArticulo(articulo);
    toast.success(`✓ ${articulo.nombre} agregado`);
    setBusqueda('');
    setResultadosBusqueda([]);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Lista de artículos */}
        <div className="lg:col-span-2 space-y-4">
          {/* Panel de Búsqueda Rápida */}
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
            <h3 className="text-base md:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Search size={20} />
              Buscar y Agregar Artículos
            </h3>

            {/* Barra de búsqueda con scanner */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value.toUpperCase())}
                    placeholder="BUSCAR POR NOMBRE O CÓDIGO..."
                    className="w-full pl-10 pr-3 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-transparent text-sm md:text-base"
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
                <button
                  onClick={() => setShowScanner(!showScanner)}
                  className={`px-4 py-3 rounded-lg border-2 transition-colors ${
                    showScanner
                      ? 'bg-red-700 text-white border-red-700'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  title="Escanear código de barras"
                >
                  <Barcode size={20} />
                </button>
              </div>

              {/* Scanner */}
              {showScanner && (
                <div className="border-2 border-red-700 rounded-lg p-3 bg-gray-50">
                  <EAN13Scanner
                    onScan={buscarPorCodigo}
                    onClose={() => setShowScanner(false)}
                  />
                </div>
              )}

              {/* Resultados de búsqueda */}
              {busqueda.length >= 2 && (
                <div className="border border-gray-200 rounded-lg max-h-80 overflow-y-auto">
                  {buscando ? (
                    <div className="p-4 text-center text-gray-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-700 mx-auto"></div>
                      <p className="mt-2 text-sm">Buscando...</p>
                    </div>
                  ) : resultadosBusqueda.length > 0 ? (
                    <div className="divide-y divide-gray-200">
                      {resultadosBusqueda.slice(0, 5).map((articulo) => {
                        const imagenUrl = articulo.imagen_url
                          ? `${import.meta.env.VITE_BASE_URL || 'http://localhost:5001'}${articulo.imagen_url}`
                          : null;

                        return (
                          <div
                            key={articulo.id}
                            className="p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => handleAgregarArticulo(articulo)}
                          >
                            <div className="flex items-center gap-3">
                              {imagenUrl ? (
                                <img
                                  src={imagenUrl}
                                  alt={articulo.nombre}
                                  className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
                                />
                              ) : (
                                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                                  📦
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-900 text-sm truncate">
                                  {articulo.nombre}
                                </h4>
                                <p className="text-xs text-gray-500 truncate">
                                  {articulo.codigo_ean13} • Stock: {articulo.stock_actual}
                                </p>
                              </div>
                              <button
                                className="px-3 py-1.5 bg-red-700 text-white rounded-lg hover:bg-red-800 text-sm flex items-center gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAgregarArticulo(articulo);
                                }}
                              >
                                <Plus size={14} />
                                Agregar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No se encontraron artículos
                    </div>
                  )}
                </div>
              )}

              {!busqueda && !showScanner && (
                <p className="text-xs text-gray-500 text-center">
                  Escribe el nombre o código del artículo, o escanea su código de barras
                </p>
              )}
            </div>
          </div>

          {/* Lista de artículos en el pedido */}
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
            <h3 className="text-base md:text-lg font-bold text-gray-900 mb-4">Artículos en el Pedido</h3>

            {items.length === 0 ? (
              <div className="text-center py-8 md:py-12 text-gray-500">
                <ShoppingCart size={48} className="mx-auto mb-4 opacity-20 md:w-16 md:h-16" />
                <p className="text-base md:text-lg mb-2">No hay artículos en el pedido</p>
                <p className="text-sm">Agrega artículos desde el inventario</p>
                <button
                  onClick={() => navigate('/inventario')}
                  className="mt-4 px-6 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 text-sm md:text-base"
                >
                  Ver Inventario
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const imagenUrl = item.imagen_url
                    ? `${import.meta.env.VITE_BASE_URL || 'http://localhost:5001'}${item.imagen_url}`
                    : null;

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 md:p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {imagenUrl ? (
                          <img
                            src={imagenUrl}
                            alt={item.nombre}
                            className="w-14 h-14 md:w-16 md:h-16 object-cover rounded-lg flex-shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 md:w-16 md:h-16 bg-gray-100 rounded-lg flex items-center justify-center text-2xl md:text-3xl flex-shrink-0">
                            📦
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 text-sm md:text-base truncate">{item.nombre}</h4>
                          <p className="text-xs md:text-sm text-gray-500 truncate">
                            {item.codigo_ean13}
                          </p>
                          <p className="text-xs md:text-sm text-gray-500">
                            ${(parseFloat(item.costo_unitario) || 0).toFixed(2)} c/u
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => decrementar(item.id)}
                            className="w-8 h-8 border-2 border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors"
                          >
                            <Minus size={14} />
                          </button>
                          <input
                            type="number"
                            value={item.cantidad}
                            onChange={(e) => handleCantidadChange(item.id, e.target.value)}
                            onBlur={(e) => handleCantidadBlur(item.id, e.target.value)}
                            min="1"
                            className="text-base md:text-lg font-bold w-14 md:w-16 text-center border-2 border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-700 focus:border-transparent"
                          />
                          <button
                            onClick={() => incrementar(item.id)}
                            className="w-8 h-8 border-2 border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        <div className="text-right min-w-[80px] md:min-w-[100px]">
                          <p className="font-bold text-gray-900 text-sm md:text-base">
                            ${(item.cantidad * (item.costo_unitario || 0)).toFixed(2)}
                          </p>
                        </div>

                        <button
                          onClick={() => eliminarArticulo(item.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Resumen del pedido */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 lg:sticky lg:top-6">
            <h3 className="text-base md:text-lg font-bold text-gray-900 mb-4">Resumen del Pedido</h3>

            {/* Formulario de proyecto/equipo y observaciones */}
            <div className="space-y-3 md:space-y-4 mb-4 md:mb-6 pb-4 md:pb-6 border-b border-gray-200">
              {user?.rol === 'almacen' ? (
                // Almacenista selecciona equipo
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center gap-2">
                      <Users size={14} />
                      <span>Equipo *</span>
                    </div>
                  </label>
                  <select
                    value={equipoSeleccionado}
                    onChange={(e) => setEquipoSeleccionado(e.target.value)}
                    className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                    disabled={cargandoEquipos}
                    required
                  >
                    <option value="">Selecciona un equipo...</option>
                    {equipos.map((equipo) => (
                      <option key={equipo.id} value={equipo.id}>
                        {equipo.nombre}
                      </option>
                    ))}
                  </select>
                  {equipoSeleccionado && equipos.find(e => e.id === parseInt(equipoSeleccionado)) && (
                    <p className="text-xs text-gray-500 mt-1">
                      Supervisor: {equipos.find(e => e.id === parseInt(equipoSeleccionado))?.supervisor?.nombre || 'N/A'}
                    </p>
                  )}
                </div>
              ) : (
                // Diseñador/Admin especifica destino (proyecto o ubicación)
                <>
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center gap-2">
                        <Truck size={14} />
                        <span>Destino del Pedido *</span>
                      </div>
                    </label>
                    <select
                      value={ubicacionDestino}
                      onChange={(e) => setUbicacionDestino(e.target.value)}
                      className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                      disabled={cargandoUbicaciones}
                    >
                      <option value="">Proyecto específico (ingresa nombre abajo)</option>
                      {ubicaciones.map((ubicacion) => (
                        <option key={ubicacion.id} value={ubicacion.id}>
                          {ubicacion.almacen.includes('Camioneta') ? '🚛' : '📦'} {ubicacion.almacen}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!ubicacionDestino && (
                    <div>
                      <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                        <div className="flex items-center gap-2">
                          <Package size={14} />
                          <span>Nombre del Proyecto *</span>
                        </div>
                      </label>
                      <input
                        type="text"
                        value={proyecto}
                        onChange={(e) => setProyecto(e.target.value)}
                        placeholder="Ej: Instalación Centro Comercial..."
                        className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700"
                        required={!ubicacionDestino}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Requerido solo si no seleccionaste una ubicación arriba
                      </p>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
                  Observaciones (opcional)
                </label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Notas adicionales..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700 resize-none"
                />
              </div>
            </div>

            <div className="space-y-2 md:space-y-3 mb-4 md:mb-6">
              <div className="flex justify-between text-gray-600 text-sm md:text-base">
                <span>Total de artículos:</span>
                <span className="font-medium">{items.length}</span>
              </div>
              <div className="flex justify-between text-gray-600 text-sm md:text-base">
                <span>Total de piezas:</span>
                <span className="font-medium">{getTotalPiezas()}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 md:pt-3 flex justify-between">
                <span className="font-bold text-gray-900 text-sm md:text-base">Costo Total:</span>
                <span className="font-bold text-lg md:text-xl text-red-700">${getCostoTotal().toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2 md:space-y-3">
              <Button
                variant="primary"
                fullWidth
                disabled={items.length === 0}
                onClick={handleFinalizarPedido}
              >
                <span className="text-sm md:text-base">Finalizar Pedido</span>
              </Button>
              <Button
                variant="secondary"
                fullWidth
                disabled={items.length === 0}
                onClick={limpiarPedido}
              >
                <span className="text-sm md:text-base">Vaciar Carrito</span>
              </Button>
            </div>

            <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2 text-sm md:text-base">Información</h4>
              <p className="text-xs md:text-sm text-gray-600">
                Usuario: <span className="font-medium">{user?.nombre || 'N/A'}</span>
              </p>
              <p className="text-xs md:text-sm text-gray-600">
                Fecha: <span className="font-medium">{new Date().toLocaleDateString('es-MX')}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PedidoPage;
