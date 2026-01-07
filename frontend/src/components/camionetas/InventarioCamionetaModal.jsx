import React, { useState, useEffect } from 'react';
import { X, Package, AlertTriangle, CheckCircle, XCircle, Wrench } from 'lucide-react';
import camionetasService from '../../services/camionetas.service';
import toast from 'react-hot-toast';

const InventarioCamionetaModal = ({ camioneta, onClose }) => {
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (camioneta) {
      cargarResumen();
    }
  }, [camioneta]);

  const cargarResumen = async () => {
    try {
      setCargando(true);
      const response = await camionetasService.obtenerResumenInventario(camioneta.id);
      setResumen(response.data);
    } catch (error) {
      console.error('Error al cargar resumen:', error);
      toast.error('Error al cargar inventario');
    } finally {
      setCargando(false);
    }
  };

  const obtenerColorEstado = (estado) => {
    switch (estado) {
      case 'completo':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'incompleto':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'vacio':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'sin_configurar':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const obtenerIconoEstado = (estado) => {
    switch (estado) {
      case 'completo':
        return <CheckCircle className="w-5 h-5" />;
      case 'incompleto':
        return <AlertTriangle className="w-5 h-5" />;
      case 'vacio':
        return <XCircle className="w-5 h-5" />;
      default:
        return <Package className="w-5 h-5" />;
    }
  };

  const obtenerTextoEstado = (estado) => {
    switch (estado) {
      case 'completo':
        return 'Completo';
      case 'incompleto':
        return 'Incompleto';
      case 'vacio':
        return 'Vacío';
      case 'sin_configurar':
        return 'Sin configurar';
      default:
        return estado;
    }
  };

  if (!camioneta) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center gap-3 text-white">
            <Wrench className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">Inventario de {camioneta.nombre}</h2>
              <p className="text-sm text-blue-100">
                Encargado: {camioneta.encargado?.nombre || 'N/A'}
                {camioneta.matricula && ` • Matrícula: ${camioneta.matricula}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-800 rounded-lg p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {cargando ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : resumen ? (
            <div className="space-y-6">
              {/* Estadísticas */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-700">{resumen.estadisticas.total_unidades}</div>
                  <div className="text-sm text-blue-600">Total Unidades</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-700">{resumen.estadisticas.tipos_completos}</div>
                  <div className="text-sm text-green-600">Completos</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-yellow-700">{resumen.estadisticas.tipos_incompletos}</div>
                  <div className="text-sm text-yellow-600">Incompletos</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-red-700">{resumen.estadisticas.tipos_vacios}</div>
                  <div className="text-sm text-red-600">Vacíos</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-gray-700">{resumen.estadisticas.tipos_sin_configurar}</div>
                  <div className="text-sm text-gray-600">Sin Config.</div>
                </div>
              </div>

              {/* Lista de herramientas */}
              {resumen.resumen.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No hay stock mínimo configurado para esta camioneta</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {resumen.resumen.map((item, index) => (
                    <div
                      key={index}
                      className={`border rounded-lg p-4 ${obtenerColorEstado(item.estado)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="mt-1">
                            {obtenerIconoEstado(item.estado)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg">{item.tipo_herramienta.nombre}</h3>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${obtenerColorEstado(item.estado)}`}>
                                {obtenerTextoEstado(item.estado)}
                              </span>
                            </div>
                            {item.tipo_herramienta.descripcion && (
                              <p className="text-sm opacity-75 mb-2">{item.tipo_herramienta.descripcion}</p>
                            )}

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                              <div>
                                <div className="text-xs opacity-75">Cantidad Mínima</div>
                                <div className="font-bold text-lg">{item.cantidad_minima}</div>
                              </div>
                              <div>
                                <div className="text-xs opacity-75">Cantidad Actual</div>
                                <div className="font-bold text-lg">{item.cantidad_actual}</div>
                              </div>
                              {item.faltante > 0 && (
                                <div>
                                  <div className="text-xs opacity-75">Faltante</div>
                                  <div className="font-bold text-lg text-red-700">{item.faltante}</div>
                                </div>
                              )}
                            </div>

                            {item.observaciones_config && (
                              <div className="mt-3 text-sm opacity-75">
                                <span className="font-medium">Nota:</span> {item.observaciones_config}
                              </div>
                            )}

                            {/* Lista de unidades */}
                            {item.unidades.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                                <div className="text-xs font-medium opacity-75 mb-2">
                                  Unidades en camioneta ({item.unidades.length}):
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {item.unidades.map((unidad) => (
                                    <span
                                      key={unidad.id}
                                      className="px-2 py-1 bg-white bg-opacity-50 rounded text-xs font-mono"
                                      title={unidad.observaciones || unidad.estado}
                                    >
                                      {unidad.codigo_unico}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
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

export default InventarioCamionetaModal;
