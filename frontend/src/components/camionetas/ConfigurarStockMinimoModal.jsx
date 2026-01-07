import React, { useState, useEffect } from 'react';
import { X, Plus, Save, Trash2, Package, Search, Check, Edit2 } from 'lucide-react';
import camionetasService from '../../services/camionetas.service';
import herramientasRentaService from '../../services/herramientasRenta.service';
import toast from 'react-hot-toast';

const ConfigurarStockMinimoModal = ({ camioneta, onClose, onActualizar }) => {
  const [tiposHerramientas, setTiposHerramientas] = useState([]);
  const [stocksConfigurados, setStocksConfigurados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  // Herramientas seleccionadas para agregar en batch
  const [seleccionadas, setSeleccionadas] = useState([]);

  useEffect(() => {
    if (camioneta) {
      cargarDatos();
    }
  }, [camioneta]);

  const cargarDatos = async () => {
    try {
      setCargando(true);

      const [tipos, stocks] = await Promise.all([
        herramientasRentaService.obtenerTipos({ activo: true }),
        camionetasService.obtenerStockMinimo(camioneta.id)
      ]);

      setTiposHerramientas(tipos.tipos || []);
      setStocksConfigurados(stocks.data.stockMinimo || []);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      toast.error('Error al cargar información');
    } finally {
      setCargando(false);
    }
  };

  const tiposFiltrados = tiposHerramientas.filter(tipo => {
    const yaConfigurado = stocksConfigurados.some(s => s.tipo_herramienta_id === tipo.id);
    const yaSeleccionado = seleccionadas.some(s => s.tipo.id === tipo.id);

    if (yaConfigurado || yaSeleccionado) return false;

    if (!busqueda.trim()) return true;

    const termino = busqueda.toLowerCase();
    return (
      tipo.nombre.toLowerCase().includes(termino) ||
      tipo.descripcion?.toLowerCase().includes(termino) ||
      tipo.prefijo_codigo.toLowerCase().includes(termino) ||
      tipo.categoria?.nombre.toLowerCase().includes(termino)
    );
  });

  const agregarSeleccion = (tipo) => {
    setSeleccionadas([...seleccionadas, {
      tipo,
      cantidad_minima: 1,
      observaciones: ''
    }]);
  };

  const quitarSeleccion = (tipoId) => {
    setSeleccionadas(seleccionadas.filter(s => s.tipo.id !== tipoId));
  };

  const actualizarCantidad = (tipoId, cantidad) => {
    setSeleccionadas(seleccionadas.map(s =>
      s.tipo.id === tipoId ? { ...s, cantidad_minima: cantidad } : s
    ));
  };

  const actualizarObservaciones = (tipoId, observaciones) => {
    setSeleccionadas(seleccionadas.map(s =>
      s.tipo.id === tipoId ? { ...s, observaciones } : s
    ));
  };

  const guardarTodas = async () => {
    if (seleccionadas.length === 0) {
      toast.error('Selecciona al menos una herramienta');
      return;
    }

    const invalidas = seleccionadas.filter(s => s.cantidad_minima <= 0);
    if (invalidas.length > 0) {
      toast.error('Todas las cantidades deben ser mayores a 0');
      return;
    }

    try {
      setGuardando(true);

      for (const seleccion of seleccionadas) {
        await camionetasService.configurarStockMinimo(camioneta.id, {
          tipo_herramienta_id: seleccion.tipo.id,
          cantidad_minima: parseInt(seleccion.cantidad_minima),
          observaciones: seleccion.observaciones
        });
      }

      toast.success(`${seleccionadas.length} configuración(es) agregada(s) exitosamente`);
      setSeleccionadas([]);
      await cargarDatos();

      if (onActualizar) {
        onActualizar();
      }
    } catch (error) {
      console.error('Error al guardar configuraciones:', error);
      toast.error(error.message || 'Error al guardar configuraciones');
    } finally {
      setGuardando(false);
    }
  };

  const eliminarConfiguracion = async (stockId, nombreHerramienta) => {
    if (!window.confirm(`¿Eliminar configuración de ${nombreHerramienta}?`)) {
      return;
    }

    try {
      await camionetasService.eliminarStockMinimo(camioneta.id, stockId);
      toast.success('Configuración eliminada');
      await cargarDatos();

      if (onActualizar) {
        onActualizar();
      }
    } catch (error) {
      console.error('Error al eliminar configuración:', error);
      toast.error('Error al eliminar configuración');
    }
  };

  const editarConfiguracion = async (stock) => {
    const nuevaCantidad = prompt(
      `Nueva cantidad mínima para ${stock.tipoHerramienta.nombre}:`,
      stock.cantidad_minima
    );

    if (!nuevaCantidad || nuevaCantidad === stock.cantidad_minima.toString()) {
      return;
    }

    const cantidad = parseInt(nuevaCantidad);
    if (isNaN(cantidad) || cantidad <= 0) {
      toast.error('La cantidad debe ser un número mayor a 0');
      return;
    }

    try {
      await camionetasService.configurarStockMinimo(camioneta.id, {
        tipo_herramienta_id: stock.tipo_herramienta_id,
        cantidad_minima: cantidad,
        observaciones: stock.observaciones
      });

      toast.success('Cantidad actualizada');
      await cargarDatos();

      if (onActualizar) {
        onActualizar();
      }
    } catch (error) {
      console.error('Error al actualizar configuración:', error);
      toast.error('Error al actualizar cantidad');
    }
  };

  const obtenerImagenUrl = (tipo) => {
    return tipo.imagen_url || tipo.articuloOrigen?.imagen_url || null;
  };

  if (!camioneta) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-indigo-700">
          <div className="flex items-center gap-3 text-white">
            <Package className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">Configurar Stock Mínimo</h2>
              <p className="text-sm text-indigo-100">
                {camioneta.nombre}
                {camioneta.matricula && ` • ${camioneta.matricula}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-indigo-800 rounded-lg p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {cargando ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
              {/* Panel izquierdo: Herramientas disponibles */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-indigo-900 mb-3">
                    Seleccionar Herramientas
                  </h3>

                  {/* Buscador */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar por nombre, código, categoría..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Grid de herramientas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2">
                    {tiposFiltrados.length === 0 ? (
                      <div className="col-span-2 text-center py-8 text-gray-500">
                        {busqueda ? 'No se encontraron herramientas' : 'Todas las herramientas ya están configuradas'}
                      </div>
                    ) : (
                      tiposFiltrados.map(tipo => {
                        const imagenUrl = obtenerImagenUrl(tipo);

                        return (
                          <div
                            key={tipo.id}
                            className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => agregarSeleccion(tipo)}
                          >
                            <div className="flex gap-3">
                              {/* Imagen */}
                              <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                {imagenUrl ? (
                                  <img
                                    src={imagenUrl}
                                    alt={tipo.nombre}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect fill="%23e5e7eb" width="64" height="64"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-family="sans-serif" font-size="24"%3E' + tipo.prefijo_codigo + '%3C/text%3E%3C/svg%3E';
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-400 font-mono text-xs">
                                    {tipo.prefijo_codigo}
                                  </div>
                                )}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <h4 className="font-semibold text-sm text-gray-900 line-clamp-1">
                                    {tipo.nombre}
                                  </h4>
                                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-mono rounded flex-shrink-0">
                                    {tipo.prefijo_codigo}
                                  </span>
                                </div>

                                {tipo.descripcion && (
                                  <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                                    {tipo.descripcion}
                                  </p>
                                )}

                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500">
                                    {tipo.categoria?.nombre || 'Sin categoría'}
                                  </span>
                                  <span className="text-green-600 font-medium">
                                    {tipo.unidades_disponibles} disponibles
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors">
                              <Plus className="w-4 h-4" />
                              Agregar
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Panel derecho: Seleccionadas y Configuradas */}
              <div className="space-y-4">
                {/* Herramientas seleccionadas (para agregar) */}
                {seleccionadas.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-green-900">
                        Para Agregar ({seleccionadas.length})
                      </h3>
                      <button
                        onClick={guardarTodas}
                        disabled={guardando}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {guardando ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            Guardando...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Guardar Todo
                          </>
                        )}
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {seleccionadas.map(sel => (
                        <div key={sel.tipo.id} className="bg-white border border-green-300 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm text-gray-900 flex-1 line-clamp-1">
                              {sel.tipo.nombre}
                            </span>
                            <button
                              onClick={() => quitarSeleccion(sel.tipo.id)}
                              className="text-red-600 hover:bg-red-50 p-1 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Cantidad Mínima
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={sel.cantidad_minima}
                                onChange={(e) => actualizarCantidad(sel.tipo.id, e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Observaciones
                              </label>
                              <textarea
                                value={sel.observaciones}
                                onChange={(e) => actualizarObservaciones(sel.tipo.id, e.target.value)}
                                rows="2"
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="Opcional..."
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Configuradas */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Ya Configuradas ({stocksConfigurados.length})
                  </h3>

                  {stocksConfigurados.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      Sin configuraciones
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {stocksConfigurados.map(stock => (
                        <div
                          key={stock.id}
                          className="bg-white border border-gray-300 rounded-lg p-3"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm text-gray-900 line-clamp-1">
                                {stock.tipoHerramienta.nombre}
                              </h4>
                              <span className="text-xs text-gray-500">
                                {stock.tipoHerramienta.prefijo_codigo}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => editarConfiguracion(stock)}
                                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                                title="Editar"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => eliminarConfiguracion(stock.id, stock.tipoHerramienta.nombre)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">Mínimo:</span>
                              <span className="font-bold text-indigo-600">
                                {stock.cantidad_minima}
                              </span>
                            </div>
                            {stock.observaciones && (
                              <p className="text-xs text-gray-600 mt-1">
                                {stock.observaciones}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfigurarStockMinimoModal;
