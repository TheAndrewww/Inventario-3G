import React, { useState, useEffect } from 'react';
import ordenesCompraService from '../../services/ordenesCompra.service';
import toast from 'react-hot-toast';
import HistorialOrdenR2 from '../../rediseno2/compras/HistorialOrden';

const TimelineHistorial = ({ ordenId }) => {
  const [historial, setHistorial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mostrarArbolDependencias, setMostrarArbolDependencias] = useState(false);

  useEffect(() => {
    if (ordenId) {
      fetchHistorial();
    }
  }, [ordenId]);

  const fetchHistorial = async () => {
    try {
      setLoading(true);
      const response = await ordenesCompraService.obtenerHistorial(ordenId);
      setHistorial(response.data);
    } catch (error) {
      console.error('Error al cargar historial:', error);
      toast.error('Error al cargar el historial de trazabilidad');
    } finally {
      setLoading(false);
    }
  };

  return (
    <HistorialOrdenR2 loading={loading} historial={historial} recargar={fetchHistorial}
      mostrarArbol={mostrarArbolDependencias} setMostrarArbol={setMostrarArbolDependencias} />
  );
};

export default TimelineHistorial;
