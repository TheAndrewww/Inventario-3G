import React, { useState, useEffect } from 'react';
import movimientosService from '../services/movimientos.service';
import toast from 'react-hot-toast';
import { generateTicketPDF } from '../utils/pdfGenerator';
import VistaHistorial from '../rediseno2/tickets/VistaHistorial';

const HistorialPage = () => {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMovimiento, setSelectedMovimiento] = useState(null);
  const [showModal, setShowModal] = useState(false);
  // Rediseño 2: la vista nueva enseña el error de carga con «Reintentar» (el aviso flotante de siempre no cambia)
  const [errorCargaR2, setErrorCargaR2] = useState(null);

  useEffect(() => {
    fetchHistorial();
  }, []);

  const handleVerDetalles = (movimiento) => {
    setSelectedMovimiento(movimiento);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedMovimiento(null);
  };

  const fetchHistorial = async () => {
    try {
      setLoading(true);
      const data = await movimientosService.getHistorial();
      // Extraer el array de movimientos de la respuesta
      const movimientosArray = data?.data?.movimientos || data?.movimientos || data || [];
      setMovimientos(Array.isArray(movimientosArray) ? movimientosArray : []);
      setErrorCargaR2(null);
    } catch (error) {
      setErrorCargaR2(error);
      console.error('Error al cargar historial:', error);
      toast.error('Error al cargar el historial');
      setMovimientos([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredMovimientos = Array.isArray(movimientos) ? movimientos.filter((item) =>
    item.ticket_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.usuario?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.proyecto?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  return (
    <VistaHistorial h={{
      movimientos, filteredMovimientos, loading, searchTerm, setSearchTerm, fetchHistorial, errorCarga: errorCargaR2,
      selectedMovimiento, showModal, handleVerDetalles, handleCloseModal, descargarPDF: generateTicketPDF,
    }} />
  );
};

export default HistorialPage;
