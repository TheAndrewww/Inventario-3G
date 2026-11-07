import React, { useState, useEffect, useCallback } from 'react';
import articulosService from '../services/articulos.service';
import toast from 'react-hot-toast';
import { confirmarG3 } from '../diseno-3g/dialogosG3';
import VistaFotosIA from '../rediseno2/inventario/VistaFotosIA';

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
  const [errorCargaR2, setErrorCargaR2] = useState(null); // Rediseño 2: el error de carga para la vista nueva (el aviso de siempre no cambia)

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
      setErrorCargaR2(null);
    } catch (error) {
      console.error('Error al cargar artículos:', error);
      setErrorCargaR2(error?.response?.data?.message || error?.message || 'Error al cargar artículos');
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
    if (!(await confirmarG3({
      titulo: '¿Limpiar la cola?',
      aviso: 'Se eliminan de la cola los artículos completados y fallidos de más de 7 días.',
      confirmar: 'Limpiar cola', cancelar: 'No limpiar', peligro: true,
    }))) return;

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

  return (
    <VistaFotosIA f={{
      articulos, selectedArticulos, setSelectedArticulos, loading, processing, queueStatus, historial, loadingHistory, autoRefresh,
      handleSelectArticulo, handleSelectAll, handleProcesarSeleccionados, handleRetryItem, handleLimpiarCola, fetchQueueStatus, fetchHistorial,
      errorCargaR2, fetchArticulos,
    }} />
  );
};

export default ProcesamientoMasivoPage;
