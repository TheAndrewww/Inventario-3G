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
  ChevronUp,
  X,
  ZoomIn
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
  const [imagenModal, setImagenModal] = useState(null); // Para ver imagen grande

  // Cargar artículos, estado de cola e historial al iniciar
  useEffect(() => {
    fetchArticulos();
    fetchQueueStatus();
    fetchHistorial();
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
    <div className="h-full flex flex-col">
      {/* Header Compacto */}
      <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wand2 className="w-6 h-6 text-purple-600" />
          <h1 className="text-xl font-bold text-gray-900">Procesamiento Masivo con IA</h1>
        </div>
        <div className="flex items-center gap-2">
          {selectedArticulos.length > 0 && (
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
              {selectedArticulos.length} seleccionados
            </span>
          )}
          <Button
            onClick={handleSelectAll}
            size="sm"
            variant="outline"
          >
            {selectedArticulos.length === articulos.length ? 'Deseleccionar' : 'Seleccionar Todos'}
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

      {/* Layout Horizontal de 3 Columnas */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">

        {/* Columna 1: Estado de la Cola */}
        <div className="w-64 flex-shrink-0 bg-white rounded-lg shadow-md p-4 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              Estado
            </h2>
            <Button onClick={fetchQueueStatus} size="sm" variant="outline">
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>

          {queueStatus ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-yellow-50 p-2 rounded border border-yellow-200 text-center">
                  <div className="text-xl font-bold text-yellow-700">{queueStatus.stats.pendientes}</div>
                  <div className="text-xs text-yellow-600">Pendientes</div>
                </div>
                <div className="bg-blue-50 p-2 rounded border border-blue-200 text-center">
                  <div className="text-xl font-bold text-blue-700">{queueStatus.stats.procesando}</div>
                  <div className="text-xs text-blue-600">Procesando</div>
                </div>
                <div className="bg-green-50 p-2 rounded border border-green-200 text-center">
                  <div className="text-xl font-bold text-green-700">{queueStatus.stats.completados}</div>
                  <div className="text-xs text-green-600">Completados</div>
                </div>
                <div className="bg-red-50 p-2 rounded border border-red-200 text-center">
                  <div className="text-xl font-bold text-red-700">{queueStatus.stats.fallidos}</div>
                  <div className="text-xs text-red-600">Fallidos</div>
                </div>
              </div>

              {queueStatus.articuloActual && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    <span className="text-xs text-blue-600 font-medium">Procesando ahora</span>
                  </div>
                  <div className="text-sm font-semibold text-blue-900 truncate">
                    {queueStatus.articuloActual.articulo_nombre}
                  </div>
                  <div className="text-xs text-blue-600">
                    {Math.round(queueStatus.articuloActual.segundos_procesando)}s - Intento {queueStatus.articuloActual.intentos}
                  </div>
                </div>
              )}

              {autoRefresh && (
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Auto-refresh activo
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500 text-center py-4">
              Sin datos de cola
            </div>
          )}
        </div>

        {/* Columna 2: Selección de Artículos (Principal - Más Grande) */}
        <div className="flex-1 bg-white rounded-lg shadow-md p-4 flex flex-col overflow-hidden min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-purple-600" />
              Artículos ({articulos.length})
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {articulos.map(articulo => (
                <div
                  key={articulo.id}
                  onClick={() => handleSelectArticulo(articulo.id)}
                  className={`
                    rounded-lg border-2 cursor-pointer transition-all overflow-hidden
                    ${selectedArticulos.includes(articulo.id)
                      ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-300'
                      : 'border-gray-200 hover:border-purple-300 bg-white'
                    }
                  `}
                >
                  {/* Imagen Grande */}
                  <div className="relative aspect-square bg-gray-100 group">
                    {articulo.imagen_url ? (
                      <>
                        <img
                          src={articulo.imagen_url}
                          alt={articulo.nombre}
                          className="w-full h-full object-cover"
                        />
                        {/* Botón de zoom */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setImagenModal({ url: articulo.imagen_url, nombre: articulo.nombre });
                          }}
                          className="absolute bottom-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Ver imagen completa"
                        >
                          <ZoomIn className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-gray-300" />
                      </div>
                    )}
                    {/* Checkbox en esquina */}
                    <div className="absolute top-2 left-2">
                      <input
                        type="checkbox"
                        checked={selectedArticulos.includes(articulo.id)}
                        onChange={() => handleSelectArticulo(articulo.id)}
                        className="w-5 h-5 text-purple-600 rounded border-2 border-white shadow"
                      />
                    </div>
                    {/* Badge de seleccionado */}
                    {selectedArticulos.includes(articulo.id) && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle2 className="w-5 h-5 text-purple-600 bg-white rounded-full" />
                      </div>
                    )}
                  </div>
                  {/* Info del artículo */}
                  <div className="p-2">
                    <div className="text-sm font-medium text-gray-900 truncate" title={articulo.nombre}>
                      {articulo.nombre}
                    </div>
                    <div className="text-xs text-gray-500">ID: {articulo.id}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Columna 3: Historial */}
        <div className="w-80 flex-shrink-0 bg-white rounded-lg shadow-md p-4 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              Historial
            </h2>
            <div className="flex items-center gap-1">
              <Button
                onClick={handleLimpiarCola}
                size="sm"
                variant="outline"
                title="Limpiar cola antigua"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
              <Button
                onClick={fetchHistorial}
                size="sm"
                variant="outline"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
              </div>
            ) : historial.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                Sin historial
              </div>
            ) : (
              <div className="space-y-2">
                {historial.map(item => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border text-sm ${getEstadoColor(item.estado)}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate" title={item.articulo_nombre}>
                          {item.articulo_nombre}
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          ID: {item.articulo_id} | Intentos: {item.intentos}/{item.max_intentos}
                        </div>
                        {item.duracion_segundos && (
                          <div className="text-xs text-gray-500">
                            {Math.round(item.duracion_segundos)}s
                          </div>
                        )}
                        {item.error_message && (
                          <div className="text-xs text-red-600 mt-1 flex items-start gap-1">
                            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span className="truncate" title={item.error_message}>{item.error_message}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1">
                        {item.estado === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                        {item.estado === 'processing' && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
                        {item.estado === 'pending' && <Clock className="w-4 h-4 text-yellow-600" />}
                        {item.estado === 'failed' && (
                          <>
                            <XCircle className="w-4 h-4 text-red-600" />
                            <button
                              onClick={() => handleRetryItem(item.id)}
                              className="text-xs text-red-600 hover:text-red-800 underline"
                            >
                              Reintentar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal para ver imagen grande */}
      {imagenModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setImagenModal(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] m-4">
            {/* Botón cerrar */}
            <button
              onClick={() => setImagenModal(null)}
              className="absolute -top-10 right-0 p-2 text-white hover:text-gray-300 transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            {/* Nombre del artículo */}
            <div className="absolute -top-10 left-0 text-white font-medium truncate max-w-md">
              {imagenModal.nombre}
            </div>
            {/* Imagen */}
            <img
              src={imagenModal.url}
              alt={imagenModal.nombre}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcesamientoMasivoPage;
