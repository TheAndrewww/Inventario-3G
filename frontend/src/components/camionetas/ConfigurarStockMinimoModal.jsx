import React, { useState, useEffect } from 'react';
import { X, Plus, Save, Trash2, Package, AlertCircle } from 'lucide-react';
import camionetasService from '../../services/camionetas.service';
import herramientasRentaService from '../../services/herramientasRenta.service';
import toast from 'react-hot-toast';

const ConfigurarStockMinimoModal = ({ camioneta, onClose, onActualizar }) => {
  const [tiposHerramientas, setTiposHerramientas] = useState([]);
  const [stocksConfigurados, setStocksConfigurados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Formulario para nueva configuración
  const [nuevaConfig, setNuevaConfig] = useState({
    tipo_herramienta_id: '',
    cantidad_minima: '',
    observaciones: ''
  });

  useEffect(() => {
    if (camioneta) {
      cargarDatos();
    }
  }, [camioneta]);

  const cargarDatos = async () => {
    try {
      setCargando(true);

      // Cargar tipos de herramientas y stocks configurados en paralelo
      const [tipos, stocks] = await Promise.all([
        herramientasRentaService.obtenerTipos({ activo: true }),
        camionetasService.obtenerStockMinimo(camioneta.id)
      ]);

      setTiposHerramientas(tipos.tipos || []);
      setStocksConfigurados(stocks.data.stocks || []);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      toast.error('Error al cargar información');
    } finally {
      setCargando(false);
    }
  };

  const agregarConfiguracion = async () => {
    if (!nuevaConfig.tipo_herramienta_id || !nuevaConfig.cantidad_minima) {
      toast.error('Selecciona un tipo de herramienta y define la cantidad mínima');
      return;
    }

    if (nuevaConfig.cantidad_minima <= 0) {
      toast.error('La cantidad mínima debe ser mayor a 0');
      return;
    }

    // Verificar si ya existe una configuración para este tipo
    const yaExiste = stocksConfigurados.some(
      stock => stock.tipo_herramienta_id === parseInt(nuevaConfig.tipo_herramienta_id)
    );

    if (yaExiste) {
      toast.error('Ya existe una configuración para este tipo de herramienta');
      return;
    }

    try {
      setGuardando(true);

      const response = await camionetasService.configurarStockMinimo(camioneta.id, {
        tipo_herramienta_id: parseInt(nuevaConfig.tipo_herramienta_id),
        cantidad_minima: parseInt(nuevaConfig.cantidad_minima),
        observaciones: nuevaConfig.observaciones
      });

      toast.success('Configuración agregada exitosamente');

      // Recargar stocks configurados
      await cargarDatos();

      // Limpiar formulario
      setNuevaConfig({
        tipo_herramienta_id: '',
        cantidad_minima: '',
        observaciones: ''
      });

      if (onActualizar) {
        onActualizar();
      }
    } catch (error) {
      console.error('Error al agregar configuración:', error);
      toast.error(error.message || 'Error al guardar configuración');
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

  const actualizarConfiguracion = async (stock) => {
    const nuevaCantidad = prompt(
      `Cantidad mínima para ${stock.tipoHerramienta.nombre}:`,
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

  const tiposDisponibles = tiposHerramientas.filter(
    tipo => !stocksConfigurados.some(stock => stock.tipo_herramienta_id === tipo.id)
  );

  if (!camioneta) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
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
        <div className="flex-1 overflow-y-auto p-6">
          {cargando ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Formulario para agregar nueva configuración */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-indigo-900 mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Agregar Herramienta al Stock Mínimo
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Herramienta *
                    </label>
                    <select
                      value={nuevaConfig.tipo_herramienta_id}
                      onChange={(e) => setNuevaConfig({ ...nuevaConfig, tipo_herramienta_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={guardando}
                    >
                      <option value="">Selecciona un tipo...</option>
                      {tiposDisponibles.map(tipo => (
                        <option key={tipo.id} value={tipo.id}>
                          {tipo.nombre} ({tipo.prefijo_codigo})
                        </option>
                      ))}
                    </select>
                    {tiposDisponibles.length === 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Todos los tipos de herramientas ya están configurados
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cantidad Mínima *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={nuevaConfig.cantidad_minima}
                      onChange={(e) => setNuevaConfig({ ...nuevaConfig, cantidad_minima: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="0"
                      disabled={guardando}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Observaciones (opcional)
                    </label>
                    <textarea
                      value={nuevaConfig.observaciones}
                      onChange={(e) => setNuevaConfig({ ...nuevaConfig, observaciones: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      rows="2"
                      placeholder="Notas adicionales sobre esta herramienta..."
                      disabled={guardando}
                    />
                  </div>
                </div>

                <button
                  onClick={agregarConfiguracion}
                  disabled={guardando || !nuevaConfig.tipo_herramienta_id || !nuevaConfig.cantidad_minima}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {guardando ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Agregar Configuración
                    </>
                  )}
                </button>
              </div>

              {/* Lista de stocks configurados */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Stock Mínimo Configurado ({stocksConfigurados.length})
                </h3>

                {stocksConfigurados.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No hay configuraciones de stock mínimo</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Agrega herramientas usando el formulario de arriba
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stocksConfigurados.map((stock) => (
                      <div
                        key={stock.id}
                        className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-gray-900">
                                {stock.tipoHerramienta.nombre}
                              </h4>
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-mono rounded">
                                {stock.tipoHerramienta.prefijo_codigo}
                              </span>
                            </div>

                            {stock.tipoHerramienta.descripcion && (
                              <p className="text-sm text-gray-600 mb-2">
                                {stock.tipoHerramienta.descripcion}
                              </p>
                            )}

                            <div className="flex items-center gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Cantidad mínima:</span>
                                <span className="ml-2 font-bold text-indigo-600 text-lg">
                                  {stock.cantidad_minima}
                                </span>
                              </div>
                            </div>

                            {stock.observaciones && (
                              <div className="mt-2 text-sm text-gray-600 bg-gray-50 rounded p-2">
                                <span className="font-medium">Nota:</span> {stock.observaciones}
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => actualizarConfiguracion(stock)}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Editar cantidad"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => eliminarConfiguracion(stock.id, stock.tipoHerramienta.nombre)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar configuración"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
