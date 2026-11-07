import React, { useState, useEffect } from 'react';
import camionetasService from '../../services/camionetas.service';
import toast from 'react-hot-toast';
import CajonInventarioEquipo from '../../rediseno2/gestion/CajonInventarioEquipo';

const InventarioCamionetaModal = ({ camioneta, onClose }) => {
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [errorR2, setErrorR2] = useState(null); // Rediseño 2: el error de la carga, para pintarlo con «Reintentar»

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
      setErrorR2(null);
    } catch (error) {
      console.error('Error al cargar resumen:', error);
      toast.error('Error al cargar inventario');
      setErrorR2(error?.response?.data?.message || error?.message || 'Error al cargar inventario');
    } finally {
      setCargando(false);
    }
  };

  if (!camioneta) return null;

  return <CajonInventarioEquipo camioneta={camioneta} onClose={onClose} resumen={resumen} cargando={cargando} error={errorR2} reintentar={cargarResumen} />;
};

export default InventarioCamionetaModal;
