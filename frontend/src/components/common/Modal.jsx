import React, { useEffect } from 'react';
import { Dialogo } from '../../rediseno2/fundacion/piezas/Dialogo';
import { ZonaHeredada } from '../../rediseno2/fundacion/piezas/Miniatura';

const Modal = ({ isOpen, onClose, title, children, size = 'md', closeOnBackdropClick = true }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Dialogo abierto titulo={title} tamano={size} alCerrar={onClose} cerrarConVelo={closeOnBackdropClick}>
      {/* El contenido de un Modal es marcado de siempre: se ve como hoy encendido (zona heredada), también dentro de una vista nueva */}
      <ZonaHeredada>{children}</ZonaHeredada>
    </Dialogo>
  );
};

export default Modal;
