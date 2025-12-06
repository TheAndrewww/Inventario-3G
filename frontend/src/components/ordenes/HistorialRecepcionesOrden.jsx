import React, { useState, useEffect } from 'react';
import { X, Package, Clock, User, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import ordenesCompraService from '../../services/ordenesCompra.service';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const HistorialRecepcionesOrden = ({ isOpen, onClose, orden }) => {
  const [recepciones, setRecepciones] = useState([]);
  const [progreso, setProgreso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandidos, setExpandidos] = useState({});

  useEffect(() => {
    if (isOpen && orden) {
      cargarDatos();
    }
  }, [isOpen, orden]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      console.log('DEBUG: Cargando historial para orden:', orden?.id);

      // Cargar historial de recepciones y progreso en paralelo
      const [historialRes, progresoRes] = await Promise.all([
        ordenesCompraService.obtenerHistorialRecepciones(orden.id),
        ordenesCompraService.obtenerProgresoRecepcion(orden.id)
      ]);

      console.log('DEBUG: Historial:', historialRes);
      console.log('DEBUG: Progreso:', progresoRes);

      setRecepciones(historialRes.data.recepciones || []);
      setProgreso(progresoRes.data);

      // Expandir la primera recepción por defecto
      if (historialRes.data.recepciones.length > 0) {
        setExpandidos({ [historialRes.data.recepciones[0].id]: true });
      }
    } catch (error) {
      console.error('Error al cargar historial:', error);
      toast.error('Error al cargar el historial de recepciones');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpandir = (recepcionId) => {
    setExpandidos(prev => ({
      ...prev,
      [recepcionId]: !prev[recepcionId]
    }));
  };

  const formatearFecha = (fecha) => {
    try {
      return format(new Date(fecha), "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es });
    } catch (error) {
      return fecha;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-purple-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="text-purple-600" size={28} />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Historial de Recepciones
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Orden: {orden?.ticket_id} · Proveedor: {orden?.proveedor?.nombre}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white rounded-lg transition-colors"
            >
              <X size={24} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Cargando historial...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Resumen de progreso */}
              {progreso && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-5 border border-purple-200">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Package size={20} className="text-purple-600" />
                    Progreso de Recepción
                  </h3>

                  {/* Barra de progreso total */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Progreso total</span>
                      <span className="text-lg font-bold text-purple-600">
                        {progreso.resumen.porcentaje_total}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-blue-600 h-4 rounded-full transition-all duration-300"
                        style={{ width: `${progreso.resumen.porcentaje_total}%` }}
                      />
                    </div>
                  </div>

                  {/* Detalle por artículo */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {progreso.articulos.map((art) => (
                      <div key={art.detalle_id} className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-gray-900 text-sm flex-1">
                            {art.articulo}
                          </h4>
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${art.completo ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                            {art.porcentaje}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <span>{art.cantidad_recibida} / {art.cantidad_solicitada} {art.unidad}</span>
                          {!art.completo && (
                            <span className="text-yellow-600 font-medium">
                              (Pendiente: {art.pendiente})
                            </span>
                          )}
                        </div>
                        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${art.completo ? 'bg-green-500' : 'bg-yellow-500'
                              }`}
                            style={{ width: `${art.porcentaje}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1">Total Artículos</p>
                      <p className="text-xl font-bold text-gray-900">{progreso.resumen.total_articulos}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-green-200">
                      <p className="text-xs text-gray-600 mb-1">Completos</p>
                      <p className="text-xl font-bold text-green-600">{progreso.resumen.articulos_completos}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-yellow-200">
                      <p className="text-xs text-gray-600 mb-1">Pendientes</p>
                      <p className="text-xl font-bold text-yellow-600">{progreso.resumen.articulos_pendientes}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Lista de recepciones */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock size={20} className="text-gray-600" />
                  Historial de Recepciones ({recepciones.length})
                </h3>

                {recepciones.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Package size={48} className="mx-auto mb-4 text-gray-400" />
                    <p>No hay recepciones registradas aún</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recepciones.map((recepcion, index) => (
                      <div
                        key={recepcion.id}
                        className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                      >
                        {/* Header de la recepción */}
                        <button
                          onClick={() => toggleExpandir(recepcion.id)}
                          className="w-full px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-600 font-bold text-sm">
                              {index + 1}
                            </div>
                            <div className="text-left">
                              <p className="font-semibold text-gray-900">
                                {recepcion.ticket_id}
                              </p>
                              <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                                <span className="flex items-center gap-1">
                                  <Clock size={14} />
                                  {formatearFecha(recepcion.fecha_hora)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <User size={14} />
                                  {recepcion.usuario.nombre}
                                </span>
                                <span className="font-medium text-purple-600">
                                  {recepcion.total_piezas} unidades
                                </span>
                              </div>
                            </div>
                          </div>
                          {expandidos[recepcion.id] ? (
                            <ChevronDown size={20} className="text-gray-400" />
                          ) : (
                            <ChevronRight size={20} className="text-gray-400" />
                          )}
                        </button>

                        {/* Detalles expandidos */}
                        {expandidos[recepcion.id] && (
                          <div className="px-5 py-4 bg-white border-t border-gray-200">
                            {/* Observaciones generales */}
                            {recepcion.observaciones && (
                              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm text-gray-700 flex items-start gap-2">
                                  <FileText size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                                  <span><strong>Observaciones:</strong> {recepcion.observaciones}</span>
                                </p>
                              </div>
                            )}

                            {/* Artículos recibidos */}
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-gray-700 mb-2">
                                Artículos recibidos:
                              </p>
                              {recepcion.detalles.map((detalle) => (
                                <div
                                  key={detalle.id}
                                  className="flex items-start justify-between p-3 bg-gray-50 rounded-lg"
                                >
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">
                                      {detalle.articulo.nombre}
                                    </p>
                                    {detalle.observaciones && (
                                      <p className="text-xs text-gray-600 mt-1 italic">
                                        {detalle.observaciones}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p className="font-bold text-purple-600">
                                      {parseFloat(detalle.cantidad).toFixed(0)} {detalle.articulo.unidad}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistorialRecepcionesOrden;
