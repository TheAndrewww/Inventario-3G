import React, { useState, useEffect, useCallback } from 'react';
import {
  Wand2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Trash2,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import articulosService from '../services/articulos.service';
import { Loader, Button } from '../components/common';
import toast from 'react-hot-toast';

const ProcesamientoMasivoPage = () => {
  const [articulos, setArticulos] = useState([]);
  const [selectedArticulos, setSelectedArticulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [queueStatus, setQueueStatus] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Cargar artículos con imagen
  useEffect(() => {
    fetchArticulos();
  }, []);

  // Auto-refresh del estado de la cola cada 3 segundos cuando hay procesamiento activo
  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchQueueStatus();
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchArticulos = async () => {
    try {
      setLoading(true);
      const data = await articulosService.buscar({ activo: true });
      // Filtrar solo artículos con imagen
      const articulosConImagen = data.filter(art => art.imagen_url);
      setArticulos(articulosConImagen);
    } catch (error) {
      console.error('Error al cargar artículos:', error);
      toast.error('Error al cargar artículos');
    } finally {
      setLoading(false);
    }
  };

  const fetchQueueStatus = useCallback(async () => {
    try {
      const status = await articulosService.getProcessingQueueStatus();
      setQueueStatus(status);

      // Detener auto-refresh si no hay nada pendiente ni procesando
      if (status.stats.pendientes === 0 && status.stats.procesando === 0) {
        setAutoRefresh(false);
        // Recargar historial cuando termina todo
        if (showHistory) {
          fetchHistorial();
        }
      }
    } catch (error) {
      console.error('Error al obtener estado de la cola:', error);
    }
  }, [showHistory]);

  const fetchHistorial = async () => {
    try {
      setLoadingHistory(true);
      const data = await articulosService.getProcessingQueueHistory(20, 0);
      setHistorial(data.historial || []);
    } catch (error) {
      console.error('Error al cargar historial:', error);
      toast.error('Error al cargar historial');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSelectArticulo = (articuloId) => {
    setSelectedArticulos(prev => {
      if (prev.includes(articuloId)) {
        return prev.filter(id => id !== articuloId);
      } else {
        return [...prev, articuloId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedArticulos.length === articulos.length) {
      setSelectedArticulos([]);
    } else {
      setSelectedArticulos(articulos.map(art => art.id));
    }
  };

  const handleProcesarSeleccionados = async () => {
    if (selectedArticulos.length === 0) {
      toast.error('Selecciona al menos un artículo');
      return;
    }

    try {
      setProcessing(true);
      const result = await articulosService.batchProcessImages(selectedArticulos);

      toast.success(
        `${result.data.agregados} artículo(s) agregado(s) a la cola de procesamiento`,
        { duration: 4000 }
      );

      if (result.data.omitidos > 0) {
        toast.error(
          `${result.data.omitidos} artículo(s) omitido(s)`,
          { duration: 4000 }
        );
      }

      // Activar auto-refresh y obtener estado inicial
      setAutoRefresh(true);
      await fetchQueueStatus();

      // Limpiar selección
      setSelectedArticulos([]);
    } catch (error) {
      console.error('Error al procesar artículos:', error);
      toast.error(error.message || 'Error al procesar artículos');
    } finally {
      setProcessing(false);
    }
  };

  const handleRetryItem = async (queueId) => {
    try {
      await articulosService.retryQueueItem(queueId);
      toast.success('Artículo agregado nuevamente a la cola');
      await fetchQueueStatus();
      await fetchHistorial();
    } catch (error) {
      console.error('Error al reintentar:', error);
      toast.error(error.message || 'Error al reintentar procesamiento');
    }
  };

  const handleLimpiarCola = async () => {
    if (!window.confirm('¿Eliminar artículos completados y fallidos de más de 7 días?')) {
      return;
    }

    try {
      await articulosService.cleanProcessingQueue(7);
      toast.success('Cola limpiada exitosamente');
      await fetchHistorial();
    } catch (error) {
      console.error('Error al limpiar cola:', error);
      toast.error(error.message || 'Error al limpiar cola');
    }
  };

  const toggleHistorial = () => {
    setShowHistory(!showHistory);
    if (!showHistory) {
      fetchHistorial();
    }
  };

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'processing':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getEstadoTexto = (estado) => {
    switch (estado) {
      case 'completed':
        return 'Completado';
      case 'processing':
        return 'Procesando';
      case 'pending':
        return 'Pendiente';
      case 'failed':
        return 'Fallido';
      default:
        return estado;
    }
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Wand2 className="w-8 h-8 text-purple-600" />
          Procesamiento Masivo con IA
        </h1>
        <p className="text-gray-600 mt-2">
          Mejora múltiples imágenes de artículos con Gemini AI
        </p>
      </div>

      {/* Estado de la Cola */}
      {queueStatus && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600" />
              Estado de la Cola
            </h2>
            <Button
              onClick={fetchQueueStatus}
              size="sm"
              variant="outline"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-700">
                {queueStatus.stats.pendientes}
              </div>
              <div className="text-sm text-yellow-600">Pendientes</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">
                {queueStatus.stats.procesando}
              </div>
              <div className="text-sm text-blue-600">Procesando</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-700">
                {queueStatus.stats.completados}
              </div>
              <div className="text-sm text-green-600">Completados</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="text-2xl font-bold text-red-700">
                {queueStatus.stats.fallidos}
              </div>
              <div className="text-sm text-red-600">Fallidos</div>
            </div>
          </div>

          {/* Artículo Actual */}
          {queueStatus.articuloActual && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <div>
                    <div className="font-semibold text-blue-900">
                      {queueStatus.articuloActual.articulo_nombre}
                    </div>
                    <div className="text-sm text-blue-600">
                      Procesando... {Math.round(queueStatus.articuloActual.segundos_procesando)}s
                    </div>
                  </div>
                </div>
                <div className="text-sm text-blue-600">
                  Intento {queueStatus.articuloActual.intentos}
                </div>
              </div>
            </div>
          )}

          {autoRefresh && (
            <div className="mt-4 text-sm text-gray-600 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Actualizando automáticamente cada 3 segundos...
            </div>
          )}
        </div>
      )}

      {/* Selección de Artículos */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-purple-600" />
            Seleccionar Artículos ({articulos.length} con imagen)
          </h2>
          <div className="flex gap-2">
            <Button
              onClick={handleSelectAll}
              size="sm"
              variant="outline"
            >
              {selectedArticulos.length === articulos.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
            </Button>
            <Button
              onClick={handleProcesarSeleccionados}
              disabled={selectedArticulos.length === 0 || processing}
              size="sm"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Procesar ({selectedArticulos.length})
                </>
              )}
            </Button>
          </div>
        </div>

        {selectedArticulos.length > 0 && (
          <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="text-sm text-purple-700">
              <strong>{selectedArticulos.length}</strong> artículo(s) seleccionado(s) para procesar
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
          {articulos.map(articulo => (
            <div
              key={articulo.id}
              onClick={() => handleSelectArticulo(articulo.id)}
              className={`
                p-4 rounded-lg border-2 cursor-pointer transition-all
                ${selectedArticulos.includes(articulo.id)
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300 bg-white'
                }
              `}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedArticulos.includes(articulo.id)}
                  onChange={() => handleSelectArticulo(articulo.id)}
                  className="mt-1 w-5 h-5 text-purple-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">
                    {articulo.nombre}
                  </div>
                  <div className="text-sm text-gray-600 truncate">
                    ID: {articulo.id}
                  </div>
                  {articulo.imagen_url && (
                    <img
                      src={articulo.imagen_url}
                      alt={articulo.nombre}
                      className="mt-2 w-full h-24 object-cover rounded"
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Historial */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={toggleHistorial}
        >
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-600" />
            Historial de Procesamiento
          </h2>
          <div className="flex items-center gap-2">
            {showHistory && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLimpiarCola();
                }}
                size="sm"
                variant="outline"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Limpiar Cola
              </Button>
            )}
            {showHistory ? (
              <ChevronUp className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-600" />
            )}
          </div>
        </div>

        {showHistory && (
          <div className="mt-4">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
              </div>
            ) : historial.length === 0 ? (
              <div className="text-center py-8 text-gray-600">
                No hay historial de procesamiento
              </div>
            ) : (
              <div className="space-y-3">
                {historial.map(item => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-lg border ${getEstadoColor(item.estado)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {item.articulo_nombre}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          ID: {item.articulo_id} | Intentos: {item.intentos}/{item.max_intentos}
                        </div>
                        {item.error_message && (
                          <div className="text-sm text-red-600 mt-2 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{item.error_message}</span>
                          </div>
                        )}
                        {item.duracion_segundos && (
                          <div className="text-sm text-gray-600 mt-1">
                            Duración: {Math.round(item.duracion_segundos)}s
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-semibold">
                          {getEstadoTexto(item.estado)}
                        </div>
                        {item.estado === 'completed' && (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        )}
                        {item.estado === 'processing' && (
                          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                        )}
                        {item.estado === 'pending' && (
                          <Clock className="w-5 h-5 text-yellow-600" />
                        )}
                        {item.estado === 'failed' && (
                          <>
                            <XCircle className="w-5 h-5 text-red-600" />
                            <Button
                              onClick={() => handleRetryItem(item.id)}
                              size="sm"
                              variant="outline"
                            >
                              <RefreshCw className="w-4 h-4 mr-1" />
                              Reintentar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProcesamientoMasivoPage;
