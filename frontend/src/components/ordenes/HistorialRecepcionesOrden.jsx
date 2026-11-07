import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import ordenesCompraService from '../../services/ordenesCompra.service';
import HistorialRecepcionesR2 from '../../rediseno2/compras/HistorialRecepciones';

const HistorialRecepcionesOrden = ({ isOpen, onClose, orden, incrustado = false }) => {
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

      // Cargar historial de recepciones y progreso en paralelo
      const [historialRes, progresoRes] = await Promise.all([
        ordenesCompraService.obtenerHistorialRecepciones(orden.id),
        ordenesCompraService.obtenerProgresoRecepcion(orden.id)
      ]);

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

  if (!isOpen) return null;

  return (
    <HistorialRecepcionesR2 orden={orden} onClose={onClose} incrustado={incrustado} loading={loading} progreso={progreso}
      recepciones={recepciones} expandidos={expandidos} toggleExpandir={toggleExpandir} />
  );
};

export default HistorialRecepcionesOrden;
