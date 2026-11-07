import React, { useEffect, useState } from 'react';
import { AvisoLecturaR2 } from '../../rediseno2/tickets/PiezasEscaner';

/**
 * Componente de notificación visual cuando se escanea y agrega un artículo exitosamente
 */
const ScanSuccessNotification = ({ articulo, onClose }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Auto-cerrar después de 3 segundos
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // Esperar animación antes de desmontar
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  if (!articulo) return null;

  return (
    <AvisoLecturaR2 articulo={articulo} visible={visible} alCerrar={() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }} />
  );
};

export default ScanSuccessNotification;
